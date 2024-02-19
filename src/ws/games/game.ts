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

export type CardGameClientMessage = StartGame | PlayCard | DrawCard | Pass;

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
  demand?: Demand;
  constructor(
    turn: number,
    playedCards: Card[],
    hands: Card[][],
    toDraw: number,
    repeatingTurn: boolean,
    demand?: Demand,
    hand?: { card: Card; playable?: boolean }[],
  ) {
    this.turn = turn;
    this.playedCards = playedCards;
    this.hands = hands.map((h) => h.length);
    this.hand = hand;
    this.toDraw = toDraw;
    this.repeatingTurn = repeatingTurn;
    this.demand = demand;
  }
}

interface CardGame extends Game {
  hands: Card[][];
  stock: Card[];
  playedCards: Card[];
}

interface Demand {
  suit?: Suit;
  rank?: Rank;
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
  suitDemand?: Suit;
  rankDemand?: Rank;
  toDraw: number = 0;

  constructor(table: Table) {
    this.table = table;
    this.hands = Array(4).fill([]);
  }

  sendMsg(msg: ServerMessage, ...sockets: WebSocket[]) {
    const json = JSON.stringify(msg);
    sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(json);
    });
  }

  handleMsg(msg: CardGameClientMessage, user: string) {
    switch (msg.type) {
      case 'startGame': {
        this.startGame();
        break;
      }
      case 'playCard': {
        if (this.table.seats[this.turn] != user) return;
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

          this.repeatTurn = true;
          let canPlayAgain = false;
          for (const card of this.hands[this.turn]) {
            if (this.canPlay(card)) {
              canPlayAgain = true;
              break;
            }
          }

          if (!canPlayAgain) {
            this.turn = (this.turn + 1) % 2;
            this.repeatTurn = false;
          }

          for (const user of this.table.users.keys()) {
            this.sendState(user);
          }
        }

        break;
      }
      case 'drawCard': {
        if (this.table.seats[this.turn] != user) return;
        const card = this.drawCard();

        if (this.canPlay(card)) {
          this.drawnCard = card;
        } else {
          for (let i = 0; i < this.toDraw - 1; i++) {
            this.drawCard();
          }
          this.toDraw = 0;
          this.turn = (this.turn + 1) % 2;
        }

        for (const user of this.table.users.keys()) {
          this.sendState(user);
        }
        break;
      }
      case 'pass': {
        if (this.table.seats[this.turn] != user) return;

        if (this.repeatTurn) {
          this.repeatTurn = false;
        } else if (this.drawnCard) {
          for (let i = 0; i < this.toDraw - 1; i++) {
            this.drawCard();
          }
          this.toDraw = 0;
          this.drawnCard = undefined;
        } else {
          return;
        }
        this.turn = (this.turn + 1) % 2;
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

    if (this.repeatTurn) canPlay = card.rank == lastCard.rank;
    else if (this.rankDemand) canPlay = card.rank == this.rankDemand;
    else if (this.suitDemand) canPlay = card.suit == this.suitDemand;
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
    this.hands = [[], [], [], []];
    this.playedCards = [];
    this.stock = fulldeck(true);
    this.drawnCard = undefined;
    this.turn = 0;
    this.toDraw = 0;
    this.suitDemand = undefined;
    this.rankDemand = undefined;
    this.repeatTurn = false;
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
        card.rank in
          [Rank.Ace, Rank.Two, Rank.Three, Rank.Four, Rank.Jack, Rank.Joker] ||
        (card.rank === Rank.King && card.suit in [Suit.Spades, Suit.Hearts])
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
    );
    const seat = this.table.seats.indexOf(user.name);
    if (seat >= 0) {
      msg.hand = this.hands[seat].map((c) => {
        const o: { card: Card; playable?: boolean } = { card: c };
        if (this.turn == seat) {
          o.playable = this.canPlay(c);
        }
        return o;
      });
    }
    if (ws) this.sendMsg(msg, ws);
    else this.sendMsg(msg, ...user.ws);
  }
}
