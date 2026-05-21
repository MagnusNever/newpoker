export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface HandScore {
  category: number;
  ranks: number[];
}

export interface HandEvaluation {
  label: string;
  score: HandScore;
  bestCards: Card[];
}

export interface PlayerHandInput {
  playerId: string;
  holeCards: Card[];
}

export interface PlayerRanking {
  playerId: string;
  rank: number;
  handLabel: string;
  bestCards: Card[];
  score: HandScore;
}

export interface RankingResult {
  rankings: PlayerRanking[];
  winnerIds: string[];
}
