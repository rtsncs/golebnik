export enum Suit {
  Clubs = 'C',
  Diamonds = 'D',
  Hearts = 'H',
  Spades = 'S',
  Joker = 'J',
}

export enum Rank {
  Ace = 'A',
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Joker = 'JOKER',
}

export class Card {
  suit: Suit;
  rank: Rank;

  constructor(suit: Suit, rank: Rank) {
    this.suit = suit;
    this.rank = rank;
  }

  toJSON() {
    return this.suit + this.rank;
  }
}

export function fulldeck(jokers: boolean) {
  const deck = [];
  for (const rank in Rank) {
    if (rank == 'Joker') continue;
    for (const suit in Suit) {
      if (suit == 'Joker') continue;
      deck.push(
        new Card(
          Suit[suit as keyof typeof Suit],
          Rank[rank as keyof typeof Rank],
        ),
      );
    }
  }
  if (jokers) {
    deck.push(new Card(Suit.Joker, Rank.Joker));
    deck.push(new Card(Suit.Joker, Rank.Joker));
  }
  return deck;
}

export function shuffle(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
