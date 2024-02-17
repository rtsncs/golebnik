import { Card, Rank, Suit, fulldeck, shuffle } from './cards';
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
  card: Card;
}

interface DrawCard {
  readonly type: 'drawCard';
}

export type CardGameClientMessage = StartGame | PlayCard | DrawCard;

interface ServerMessage {
  readonly type: string;
}

class ServerState implements ServerMessage {
  readonly type = 'gameState';
  turn: number;
  playedCards: Card[];
  hands: number[];
  hand?: Card[];
  constructor(
    turn: number,
    playedCards: Card[],
    hands: Card[][],
    hand?: Card[],
  ) {
    this.turn = turn;
    this.playedCards = playedCards;
    this.hands = hands.map((h) => h.length);
    this.hand = hand;
  }
}

interface CardGame extends Game {
  hands: Card[][];
  stock: Card[];
  playedCards: Card[];
}

export class Makao implements CardGame {
  table: Table;
  turn: number = 0;
  hands: Card[][] = [];
  stock: Card[];
  playedCards: Card[] = [];

  constructor(table: Table) {
    this.table = table;
    this.hands = Array(4).fill([]);
    this.stock = [];
    this.playedCards = [];
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
        break;
      }
      case 'drawCard': {
        break;
      }
    }
  }

  startGame() {
    this.hands = [[], [], [], []];
    this.playedCards = [];
    this.stock = fulldeck(true);
    this.turn = 0;
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
        card.rank in [Rank.Ace, Rank.Two, Rank.Three, Rank.Four, Rank.Jack] ||
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
    const msg = new ServerState(this.turn, this.playedCards, this.hands);
    const seat = this.table.seats.indexOf(user.name);
    if (seat >= 0) {
      msg.hand = this.hands[seat];
    }
    if (ws) this.sendMsg(msg, ws);
    else this.sendMsg(msg, ...user.ws);
  }
}
