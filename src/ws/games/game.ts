import { Card, Rank, Suit, cardFromString, fulldeck, shuffle } from './cards';
import { Table } from '../table';
import { WebSocket } from 'ws';

export interface Game {
  table: Table;
  turn: number;
  handleMsg(msg: any, user: string): void;
}

interface StartGame {
  readonly type: 'startGame';
}

interface PlayCard {
  readonly type: 'playCard';
  card: string;
}

interface DrawCard {
  readonly type: 'drawCard';
}

interface Pass {
  readonly type: 'pass';
}

interface SuitMsg {
  readonly type: 'suit';
  suit: string;
}

interface RankMsg {
  readonly type: 'rank';
  rank: string;
}

export type CardGameClientMessage =
  | StartGame
  | PlayCard
  | DrawCard
  | Pass
  | SuitMsg
  | RankMsg;

interface ServerMessage {
  readonly type: string;
}

class ServerState implements ServerMessage {
  readonly type = 'gameState';
  turn: number;
  playedCards: Card[];
  hands: number[];
  hand?: { card: Card; playable?: boolean }[];
  toDraw: number;
  repeatingTurn: boolean;
  demand?: Rank | Suit;
  actions?: string;
  winner: number;
  blocks: number[];
  toBlock: number;
  constructor(
    turn: number,
    playedCards: Card[],
    hands: Card[][],
    toDraw: number,
    repeatingTurn: boolean,
    winner: number,
    blocks: number[],
    toBlock: number,
    demand?: Rank | Suit,
    hand?: { card: Card; playable?: boolean }[],
    actions?: string,
  ) {
    this.turn = turn;
    this.playedCards = playedCards;
    this.hands = hands.map((h) => h.length);
    this.hand = hand;
    this.toDraw = toDraw;
    this.repeatingTurn = repeatingTurn;
    this.demand = demand;
    this.winner = winner;
    this.actions = actions;
    this.blocks = blocks;
    this.toBlock = toBlock;
  }
}

interface CardGame extends Game {
  hands: Card[][];
  stock: Card[];
  playedCards: Card[];
}

interface SuitDemand {
  readonly type: 'suit';
  demand: Suit;
  turnsLeft: number;
}
interface RankDemand {
  readonly type: 'rank';
  demand: Rank;
  turnsLeft: number;
}

export class Makao implements CardGame {
  table: Table;
  turn: number = -1;
  hands: Card[][] = [];
  stock: Card[] = [];
  playedCards: Card[] = [];
  drawnCard?: Card;
  repeatTurn: boolean = false;
  demand?: SuitDemand | RankDemand;
  toDraw: number = 0;
  winner: number = -1;
  blocks: number[] = [];
  toBlock: number = 0;

  constructor(table: Table) {
    this.table = table;
  }

  sendMsg(msg: ServerMessage, ...sockets: WebSocket[]) {
    const json = JSON.stringify(msg);
    sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(json);
    });
  }

  handleMsg(msg: CardGameClientMessage, user: string) {
    if (msg.type == 'startGame') {
      if (this.table.operator == user) this.startGame();
      return;
    }
    if (this.winner != -1 || this.table.seats[this.turn] != user) return;

    switch (msg.type) {
      case 'playCard': {
        if (this.blocks[this.turn] > 0) return;
        const card = cardFromString(msg.card);
        let cardI = -1;
        this.hands[this.turn].forEach((c, i) => {
          if (c.rank == card.rank && c.suit == card.suit) cardI = i;
        });
        if (cardI === -1) return;

        if (this.drawnCard && this.drawnCard != this.hands[this.turn][cardI]) {
          return;
        }

        if (this.canPlay(card)) {
          this.hands[this.turn].splice(cardI, 1);
          this.playedCards.push(card);
          this.drawnCard = undefined;
          if (card.rank == Rank.Two) this.toDraw += 2;
          else if (card.rank == Rank.Three) this.toDraw += 3;
          else if (
            card.rank == Rank.King &&
            (card.suit == Suit.Hearts || card.suit == Suit.Spades)
          )
            this.toDraw += 5;
          else if (card.rank == Rank.Four) this.toBlock++;

          if (this.demand) {
            this.demand.turnsLeft--;
            if (this.demand.turnsLeft <= 0) this.demand = undefined;
          }

          if (this.hands[this.turn].length == 0) {
            this.winner = this.turn;
          } else {
            this.repeatTurn = true;
            let canPlayAgain = false;
            for (const card of this.hands[this.turn]) {
              if (this.canPlay(card)) {
                canPlayAgain = true;
                break;
              }
            }

            if (
              !canPlayAgain &&
              card.rank != Rank.Ace &&
              card.rank != Rank.Jack
            ) {
              this.nextPlayer();
            }
          }

          for (const user of this.table.users.keys()) {
            this.sendState(user);
          }
        }

        break;
      }
      case 'drawCard': {
        if (this.blocks[this.turn] > 0 || this.toBlock > 0) return;
        const card = this.drawCard();

        if (this.canPlay(card)) {
          this.drawnCard = card;
        } else {
          for (let i = 0; i < this.toDraw - 1; i++) {
            this.drawCard();
          }
          this.toDraw = 0;
          if (this.demand?.type == 'rank') {
            this.demand.turnsLeft--;
          }
          this.turn = (this.turn + 1) % 2;
        }

        for (const user of this.table.users.keys()) {
          this.sendState(user);
        }
        break;
      }
      case 'pass': {
        if (this.repeatTurn) {
          this.demand == undefined;
        } else if (this.drawnCard) {
          for (let i = 0; i < this.toDraw - 1; i++) {
            this.drawCard();
          }
          this.toDraw = 0;
        } else if (this.toBlock > 0) {
          this.blocks[this.turn] = this.toBlock;
          this.toBlock = 0;
        } else if (this.blocks[this.turn] == 0) {
          return;
        } else if (this.blocks[this.turn] > 0) {
          this.blocks[this.turn]--;
        }

        this.nextPlayer();
        for (const user of this.table.users.keys()) {
          this.sendState(user);
        }
        break;
      }
      case 'suit': {
        if (this.blocks[this.turn] > 0) return;
        if (!this.repeatTurn) return;
        const lastCard = this.playedCards[this.playedCards.length - 1];
        if (lastCard.rank != Rank.Ace) return;

        const suit = msg.suit as Suit;
        if (!suit) return;

        this.demand = { type: 'suit', demand: suit, turnsLeft: 1 };
        this.nextPlayer();

        for (const user of this.table.users.keys()) {
          this.sendState(user);
        }
        break;
      }
      case 'rank': {
        if (this.blocks[this.turn] > 0) return;
        if (!this.repeatTurn) return;
        const lastCard = this.playedCards[this.playedCards.length - 1];
        if (lastCard.rank != Rank.Jack) return;

        const rank = msg.rank as Rank;
        if (!rank) return;

        this.demand = { type: 'rank', demand: rank, turnsLeft: 2 };
        this.nextPlayer();

        for (const user of this.table.users.keys()) {
          this.sendState(user);
        }

        break;
      }
    }
  }

  canPlay(card: Card) {
    const lastCard = this.playedCards[this.playedCards.length - 1];

    let canPlay;

    if (this.blocks[this.turn] > 0) canPlay = false;
    else if (this.toBlock > 0) canPlay = card.rank == Rank.Four;
    else if (this.repeatTurn) canPlay = card.rank == lastCard.rank;
    else if (this.demand)
      canPlay =
        (this.demand.type == 'rank' && card.rank == Rank.Jack) ||
        (this.demand.type == 'suit' && card.rank == Rank.Ace) ||
        card.rank === this.demand.demand ||
        card.suit === this.demand.demand;
    else if (
      this.toDraw > 0 &&
      card.rank != Rank.Two &&
      card.rank != Rank.Three &&
      !(
        card.rank == Rank.King &&
        (card.suit == Suit.Hearts || card.suit == Suit.Spades)
      )
    ) {
      canPlay = false;
    } else canPlay = lastCard.rank == card.rank || lastCard.suit == card.suit;

    return canPlay;
  }

  nextPlayer() {
    this.drawnCard = undefined;
    this.repeatTurn = false;
    this.turn = (this.turn + 1) % 2;
    if (this.blocks[this.turn] > 0) {
      this.blocks[this.turn]--;
    }
  }

  drawCard() {
    if (this.stock.length == 0) this.restock();
    const card = this.stock.pop()!;
    this.hands[this.turn].push(card);
    return card;
  }

  restock() {
    //TODO: what if there are no cards
    const lastCard = this.playedCards.pop()!;
    this.stock.push(...this.playedCards.slice(0, -2));
    this.playedCards = [lastCard];
    shuffle(this.stock);
  }

  startGame() {
    this.hands = [[], []];
    this.playedCards = [];
    this.stock = fulldeck(false);
    this.drawnCard = undefined;
    this.turn = 0;
    this.toDraw = 0;
    this.demand = undefined;
    this.repeatTurn = false;
    this.winner = -1;
    this.blocks = [0, 0];
    this.toBlock = 0;
    shuffle(this.stock);

    for (let i = 0; i < 5; i++) {
      this.table.seats.forEach((seat, j) => {
        if (seat) {
          this.hands[j].push(this.stock.pop()!);
        }
      });
    }

    while (this.playedCards.length == 0) {
      const card = this.stock.pop()!;
      if (
        [
          Rank.Ace,
          Rank.Two,
          Rank.Three,
          Rank.Four,
          Rank.Jack,
          Rank.Joker,
        ].includes(card.rank) ||
        (card.rank === Rank.King &&
          [Suit.Spades, Suit.Hearts].includes(card.suit))
      ) {
        this.stock.unshift(card);
      } else {
        this.playedCards.push(card);
      }
    }

    for (const user of this.table.users.keys()) {
      this.sendState(user);
    }
  }

  sendState(name: string, ws?: WebSocket) {
    const user = this.table.users.get(name);
    if (!user) return;
    const msg = new ServerState(
      this.turn,
      this.playedCards,
      this.hands,
      this.toDraw,
      this.repeatTurn,
      this.winner,
      this.blocks,
      this.toBlock,
      this.demand?.demand,
    );
    const seat = this.table.seats.indexOf(user.name);
    if (seat >= 0) {
      let playable = 0;
      msg.hand = this.hands[seat].map((c) => {
        const o: { card: Card; playable?: boolean } = {
          card: c,
        };
        if (this.turn == seat) {
          o.playable = this.canPlay(c);
          if (o.playable) playable++;
        }
        return o;
      });
      if (this.drawnCard) msg.actions = 'play,pass';
      else if (this.repeatTurn) {
        const lastCard = this.playedCards[this.playedCards.length - 1];
        if (lastCard.rank == Rank.Ace) {
          msg.actions = 'suit';
        }
        if (lastCard.rank == Rank.Jack) {
          msg.actions = 'rank';
        }
        msg.actions += ',pass';
      } else if (this.toBlock == 0) {
        msg.actions = 'draw';
      } else msg.actions = 'pass';
      if (playable > 0) msg.actions += ',play';
    }
    if (ws) this.sendMsg(msg, ws);
    else this.sendMsg(msg, ...user.ws);
  }
}
