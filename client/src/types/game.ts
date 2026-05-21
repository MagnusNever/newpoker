export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type RoomPhase = 'lobby' | 'waiting' | 'playing' | 'hand_result';

export interface PlayerPublic {
  playerId: string;
  nickname: string;
  seatIndex: number | null;
  connected: boolean;
  winsInRoom: number;
  readyForNextHand: boolean;
  handCardCount: number;
}

export interface HandRanking {
  playerId: string;
  nickname: string;
  seatIndex: number;
  rank: number;
  handLabel: string;
  bestCards: Card[];
  holeCards: Card[];
  unusedStashCards: Card[];
}

export interface GameLastAction {
  id: number;
  kind: 'turn_started' | 'turn_advanced' | 'hand_completed';
  round: number;
  playerId?: string;
  actionType?: TurnAction['type'];
  toPlayerId: string | null;
  publicDiscardCardId?: string;
  swappedCommunityCardId?: string;
}

export interface PublicGameInfo {
  communityCards: Card[];
  publicDiscards: Card[];
  privateDiscardCount: number;
  deckRemaining: number;
  turnRound: number;
  turnOrder: string[];
  currentPlayerId: string | null;
  turnDeadlineAt: number | null;
  rankings: HandRanking[];
  winnerIds: string[];
  matchComplete: boolean;
  lastAction: GameLastAction | null;
}

export interface PublicState {
  roomId: string;
  phase: Exclude<RoomPhase, 'lobby'>;
  hostPlayerId: string;
  matchHands: number;
  completedHands: number;
  maxSeats: number;
  players: PlayerPublic[];
  game: PublicGameInfo | null;
}

export interface PrivateState {
  playerId: string;
  holeCards: Card[];
  stashCards: Card[];
  availableActions: string[];
}

export type TurnAction =
  | { type: 'keep' }
  | { type: 'swap_hole'; stashCardId: string; holeCardId: string }
  | { type: 'swap_community'; stashCardId: string; communityCardId: string };

export interface GameState {
  phase: RoomPhase;
  roomId: string | null;
  myPlayerId: string | null;
  publicState: PublicState | null;
  privateState: PrivateState | null;
  errorMessage: string | null;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_COLORS: Record<Suit, 'black' | 'red'> = {
  spades: 'black',
  clubs: 'black',
  hearts: 'red',
  diamonds: 'red',
};
