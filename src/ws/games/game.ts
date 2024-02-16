import { Card, Rank, Suit, shuffle } from './cards';
import { Table } from '../table';

interface Game {
  table: Table;
  turn: number;
  handleMsg(msg: any): void;
}

interface CardGame extends Game {
  hands: Card[][];
  stock: Card[];
  playedCards: Card[];
}

export class Makao implements CardGame {
  table: Table;
  turn: number = 0;
  hands: Card[][];
  stock: Card[];
  playedCards: Card[];

  constructor(table: Table) {
    this.table = table;
    this.hands = Array(4).fill([]);
    this.stock = [];
    this.playedCards = [];
  }

  handleMsg(msg: any) {
    //TODO
  }

  startGame() {
    this.stock = [];
    for (const rank in Rank) {
      for (const suit in Suit) {
        this.stock.push(
          new Card(
            Suit[suit as keyof typeof Suit],
            Rank[rank as keyof typeof Rank],
          ),
        );
      }
    }
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

    // new Message(MessageKind.GameStarted, {
    //   startingCard: this.playedCards[0],
    //   startingPlayer: 0,
    // }).send(this.users.map((u) => u.ws).flat());
    //
    // this.seats.forEach((seat, i) => {
    //   if (seat) {
    //     new Message(MessageKind.Hand, this.hands[i]).send(seat.ws);
    //   }
    // });
  }
}
