import { Injectable } from '@nestjs/common';
import { createDeck, drawCard, shuffleDeck } from '../poker/deck';
import { rankPlayers } from '../poker/hand-evaluator';
import { Card, PlayerRanking } from '../poker/types';

const ROOM_ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 6;
const MAX_SEATS = 6;
const TURN_MS = 30_000;

export type RoomPhase = 'waiting' | 'playing' | 'hand_result';
export type TurnAction =
  | { type: 'keep' }
  | { type: 'swap_hole'; stashCardId: string; holeCardId: string }
  | { type: 'swap_community'; stashCardId: string; communityCardId: string };

interface GameLastAction {
  id: number;
  kind: 'turn_started' | 'turn_advanced' | 'hand_completed';
  round: number;
  playerId?: string;
  actionType?: TurnAction['type'];
  toPlayerId: string | null;
  publicDiscardCardId?: string;
  swappedCommunityCardId?: string;
}

export interface Player {
  playerId: string;
  socketId: string;
  nickname: string;
  seatIndex: number | null;
  connected: boolean;
  winsInRoom: number;
  readyForNextHand: boolean;
}

interface PlayerHandState {
  holeCards: Card[];
  stashCards: Card[];
  privateDiscardCount: number;
}

interface HandRanking extends PlayerRanking {
  nickname: string;
  seatIndex: number;
  holeCards: Card[];
  unusedStashCards: Card[];
}

interface PokerGame {
  deck: Card[];
  communityCards: Card[];
  publicDiscards: Card[];
  privateDiscardCount: number;
  playersById: Record<string, PlayerHandState>;
  turnOrder: string[];
  currentTurnIndex: number;
  currentPlayerId: string | null;
  turnRound: number;
  turnDeadlineAt: number | null;
  rankings: HandRanking[];
  winnerIds: string[];
  matchComplete: boolean;
  lastAction: GameLastAction | null;
  actionSeq: number;
}

export interface Room {
  roomId: string;
  hostPlayerId: string;
  matchHands: number;
  completedHands: number;
  phase: RoomPhase;
  players: Player[];
  game: PokerGame | null;
}

type ServiceResult<T = unknown> = { ok: true; value?: T } | { ok: false; message: string };

@Injectable()
export class RoomService {
  private rooms = new Map<string, Room>();

  createRoom(socketId: string, nickname: string, matchHands = 1): Room {
    const roomId = this.generateRoomId();
    const host: Player = {
      playerId: socketId,
      socketId,
      nickname,
      seatIndex: null,
      connected: true,
      winsInRoom: 0,
      readyForNextHand: false,
    };
    const room: Room = {
      roomId,
      hostPlayerId: host.playerId,
      matchHands: this.clampMatchHands(matchHands),
      completedHands: 0,
      phase: 'waiting',
      players: [host],
      game: null,
    };
    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, socketId: string, nickname: string): ServiceResult<{ room: Room; player: Player }> {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      return { ok: false, message: '房间不存在' };
    }
    if (room.phase !== 'waiting') {
      return { ok: false, message: '游戏已经开始' };
    }
    if (room.players.length >= MAX_SEATS) {
      return { ok: false, message: '房间已满' };
    }
    if (room.players.some((player) => player.socketId === socketId)) {
      return { ok: false, message: '你已经在房间中' };
    }

    const player: Player = {
      playerId: socketId,
      socketId,
      nickname,
      seatIndex: null,
      connected: true,
      winsInRoom: 0,
      readyForNextHand: false,
    };
    room.players.push(player);
    return { ok: true, value: { room, player } };
  }

  selectSeat(roomId: string, playerId: string, seatIndex: number): ServiceResult<Room> {
    const room = this.getRoom(roomId);
    const player = room?.players.find((item) => item.playerId === playerId);
    if (!room || !player) {
      return { ok: false, message: '你不在该房间中' };
    }
    if (room.phase !== 'waiting') {
      return { ok: false, message: '只有等待阶段可以选择座位' };
    }
    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= MAX_SEATS) {
      return { ok: false, message: '座位编号无效' };
    }
    const occupied = room.players.some((item) => item.playerId !== playerId && item.seatIndex === seatIndex);
    if (occupied) {
      return { ok: false, message: '该座位已被选择' };
    }
    player.seatIndex = seatIndex;
    return { ok: true, value: room };
  }

  setMatchHands(roomId: string, playerId: string, matchHands: number): ServiceResult<Room> {
    const room = this.getRoom(roomId);
    if (!room) {
      return { ok: false, message: '房间不存在' };
    }
    if (room.hostPlayerId !== playerId) {
      return { ok: false, message: '只有房主可以设置游戏次数' };
    }
    if (room.phase !== 'waiting') {
      return { ok: false, message: '只有等待阶段可以设置游戏次数' };
    }
    room.matchHands = this.clampMatchHands(matchHands);
    return { ok: true, value: room };
  }

  startMatch(roomId: string, playerId: string): ServiceResult<Room> {
    const room = this.getRoom(roomId);
    if (!room) {
      return { ok: false, message: '房间不存在' };
    }
    if (room.hostPlayerId !== playerId) {
      return { ok: false, message: '只有房主可以开始游戏' };
    }
    const seatedPlayers = this.getSeatedPlayers(room);
    if (seatedPlayers.length < 2) {
      return { ok: false, message: '至少需要 2 名已选座玩家' };
    }
    if (seatedPlayers.some((player) => player.seatIndex === null)) {
      return { ok: false, message: '所有玩家必须先选择座位' };
    }

    room.completedHands = 0;
    this.startHand(room);
    return { ok: true, value: room };
  }

  submitTurnAction(roomId: string, playerId: string, action: TurnAction): ServiceResult<Room> {
    const room = this.getRoom(roomId);
    if (!room || !room.game || room.phase !== 'playing') {
      return { ok: false, message: '当前没有可行动的游戏' };
    }
    if (room.game.currentPlayerId !== playerId) {
      return { ok: false, message: '还没有轮到你行动' };
    }

    const handState = room.game.playersById[playerId];
    if (!handState) {
      return { ok: false, message: '玩家手牌状态不存在' };
    }

    const actionRound = room.game.turnRound;
    const applied = this.applyAction(room.game, handState, action);
    if (!applied.ok) {
      return applied;
    }
    if (!applied.value) {
      return { ok: false, message: '行动结果缺失' };
    }

    this.advanceTurn(room, playerId, applied.value, actionRound);
    return { ok: true, value: room };
  }

  continueNextHand(roomId: string, playerId: string): ServiceResult<Room> {
    const room = this.getRoom(roomId);
    const player = room?.players.find((item) => item.playerId === playerId);
    if (!room || !player) {
      return { ok: false, message: '你不在该房间中' };
    }
    if (room.phase !== 'hand_result') {
      return { ok: false, message: '当前不在结算阶段' };
    }
    player.readyForNextHand = true;
    const onlinePlayers = this.getOnlineSeatedPlayers(room);
    if (!onlinePlayers.every((item) => item.readyForNextHand)) {
      return { ok: true, value: room };
    }

    for (const item of room.players) {
      item.readyForNextHand = false;
    }

    if (room.completedHands >= room.matchHands) {
      room.phase = 'waiting';
      room.game = null;
      return { ok: true, value: room };
    }

    this.startHand(room);
    return { ok: true, value: room };
  }

  disconnectPlayer(socketId: string): { room: Room | null; cancelledHand: boolean } {
    const room = this.getRoomBySocketId(socketId);
    if (!room) {
      return { room: null, cancelledHand: false };
    }
    const player = room.players.find((item) => item.socketId === socketId);
    if (!player) {
      return { room, cancelledHand: false };
    }

    if (room.phase === 'waiting') {
      room.players = room.players.filter((item) => item.socketId !== socketId);
      if (room.hostPlayerId === player.playerId && room.players.length > 0) {
        room.hostPlayerId = room.players[0].playerId;
      }
      if (room.players.length === 0) {
        this.rooms.delete(room.roomId);
        return { room, cancelledHand: false };
      }
      return { room, cancelledHand: false };
    }

    player.connected = false;
    const onlinePlayers = this.getOnlineSeatedPlayers(room);
    if (onlinePlayers.length <= 1) {
      room.phase = 'waiting';
      room.game = null;
      for (const item of room.players) {
        item.readyForNextHand = false;
      }
      return { room, cancelledHand: true };
    }
    return { room, cancelledHand: false };
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId.toUpperCase()) || null;
  }

  getRoomBySocketId(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.some((player) => player.socketId === socketId)) {
        return room;
      }
    }
    return null;
  }

  getPublicState(room: Room) {
    const game = room.game;
    return {
      roomId: room.roomId,
      phase: room.phase,
      hostPlayerId: room.hostPlayerId,
      matchHands: room.matchHands,
      completedHands: room.completedHands,
      maxSeats: MAX_SEATS,
      players: [...room.players]
        .sort((a, b) => (a.seatIndex ?? 99) - (b.seatIndex ?? 99))
        .map((player) => ({
          playerId: player.playerId,
          nickname: player.nickname,
          seatIndex: player.seatIndex,
          connected: player.connected,
          winsInRoom: player.winsInRoom,
          readyForNextHand: player.readyForNextHand,
          handCardCount: game?.playersById[player.playerId]?.holeCards.length || 0,
        })),
      game: game
        ? {
            communityCards: game.communityCards,
            publicDiscards: game.publicDiscards,
            privateDiscardCount: game.privateDiscardCount,
            deckRemaining: game.deck.length,
            turnRound: game.turnRound,
            turnOrder: game.turnOrder,
            currentPlayerId: game.currentPlayerId,
            turnDeadlineAt: game.turnDeadlineAt,
            rankings: game.rankings,
            winnerIds: game.winnerIds,
            matchComplete: game.matchComplete,
            lastAction: game.lastAction,
          }
        : null,
    };
  }

  getPrivateState(room: Room, playerId: string) {
    const state = room.game?.playersById[playerId] || null;
    return {
      playerId,
      holeCards: state?.holeCards || [],
      stashCards: state?.stashCards || [],
      availableActions: room.game?.currentPlayerId === playerId ? ['keep', 'swap_hole', 'swap_community'] : [],
    };
  }

  private startHand(room: Room): void {
    const seatedPlayers = this.getSeatedPlayers(room);
    let deck = shuffleDeck(createDeck());
    const playersById: Record<string, PlayerHandState> = {};

    for (const player of seatedPlayers) {
      playersById[player.playerId] = { holeCards: [], stashCards: [], privateDiscardCount: 0 };
      for (let i = 0; i < 2; i += 1) {
        const drawn = drawCard(deck);
        deck = drawn.deck;
        playersById[player.playerId].holeCards.push(drawn.card);
      }
    }

    const communityCards: Card[] = [];
    for (let i = 0; i < 5; i += 1) {
      const drawn = drawCard(deck);
      deck = drawn.deck;
      communityCards.push(drawn.card);
    }

    const turnOrder = this.buildTurnOrder(seatedPlayers);
    room.phase = 'playing';
    room.game = {
      deck,
      communityCards,
      publicDiscards: [],
      privateDiscardCount: 0,
      playersById,
      turnOrder,
      currentTurnIndex: 0,
      currentPlayerId: turnOrder[0],
      turnRound: 1,
      turnDeadlineAt: null,
      rankings: [],
      winnerIds: [],
      matchComplete: false,
      lastAction: null,
      actionSeq: 0,
    };
    this.beginCurrentTurn(room);
    this.setLastAction(room.game, {
      kind: 'turn_started',
      round: 1,
      toPlayerId: room.game.currentPlayerId,
    });
  }

  private beginCurrentTurn(room: Room): void {
    const game = room.game;
    if (!game || !game.currentPlayerId) {
      return;
    }
    const handState = game.playersById[game.currentPlayerId];
    const drawn = drawCard(game.deck);
    game.deck = drawn.deck;
    handState.stashCards.push(drawn.card);
    game.turnDeadlineAt = Date.now() + TURN_MS;
  }

  private applyAction(
    game: PokerGame,
    handState: PlayerHandState,
    action: TurnAction,
  ): ServiceResult<{
    actionType: TurnAction['type'];
    publicDiscardCardId?: string;
    swappedCommunityCardId?: string;
  }> {
    if (action.type === 'keep') {
      return { ok: true, value: { actionType: 'keep' } };
    }

    const stashIndex = handState.stashCards.findIndex((card) => card.id === action.stashCardId);
    if (stashIndex < 0) {
      return { ok: false, message: '暂存区中没有这张牌' };
    }
    const [stashCard] = handState.stashCards.splice(stashIndex, 1);

    if (action.type === 'swap_hole') {
      const holeIndex = handState.holeCards.findIndex((card) => card.id === action.holeCardId);
      if (holeIndex < 0) {
        handState.stashCards.push(stashCard);
        return { ok: false, message: '手牌中没有这张牌' };
      }
      handState.holeCards[holeIndex] = stashCard;
      handState.privateDiscardCount += 1;
      game.privateDiscardCount += 1;
      return { ok: true, value: { actionType: 'swap_hole' } };
    }

    const communityIndex = game.communityCards.findIndex((card) => card.id === action.communityCardId);
    if (communityIndex < 0) {
      handState.stashCards.push(stashCard);
      return { ok: false, message: '公共牌中没有这张牌' };
    }
    const oldCommunity = game.communityCards[communityIndex];
    game.communityCards[communityIndex] = stashCard;
    game.publicDiscards.push(oldCommunity);
    return {
      ok: true,
      value: {
        actionType: 'swap_community',
        publicDiscardCardId: oldCommunity.id,
        swappedCommunityCardId: stashCard.id,
      },
    };
  }

  private advanceTurn(
    room: Room,
    playerId: string,
    actionOutcome: {
      actionType: TurnAction['type'];
      publicDiscardCardId?: string;
      swappedCommunityCardId?: string;
    },
    actionRound: number,
  ): void {
    const game = room.game;
    if (!game) {
      return;
    }
    if (game.currentTurnIndex < game.turnOrder.length - 1) {
      game.currentTurnIndex += 1;
      game.currentPlayerId = game.turnOrder[game.currentTurnIndex];
      this.beginCurrentTurn(room);
      this.setLastAction(game, {
        kind: 'turn_advanced',
        round: game.turnRound,
        playerId,
        actionType: actionOutcome.actionType,
        toPlayerId: game.currentPlayerId,
        publicDiscardCardId: actionOutcome.publicDiscardCardId,
        swappedCommunityCardId: actionOutcome.swappedCommunityCardId,
      });
      return;
    }
    if (game.turnRound < 5) {
      game.turnRound += 1;
      game.currentTurnIndex = 0;
      game.currentPlayerId = game.turnOrder[0];
      this.beginCurrentTurn(room);
      this.setLastAction(game, {
        kind: 'turn_advanced',
        round: game.turnRound,
        playerId,
        actionType: actionOutcome.actionType,
        toPlayerId: game.currentPlayerId,
        publicDiscardCardId: actionOutcome.publicDiscardCardId,
        swappedCommunityCardId: actionOutcome.swappedCommunityCardId,
      });
      return;
    }
    this.finishHand(room, playerId, actionOutcome, actionRound);
  }

  private finishHand(
    room: Room,
    playerId?: string,
    actionOutcome?: {
      actionType: TurnAction['type'];
      publicDiscardCardId?: string;
      swappedCommunityCardId?: string;
    },
    actionRound?: number,
  ): void {
    const game = room.game;
    if (!game) {
      return;
    }
    const rankingInput = game.turnOrder.map((playerId) => ({
      playerId,
      holeCards: game.playersById[playerId].holeCards,
    }));
    const result = rankPlayers(rankingInput, game.communityCards);
    game.rankings = result.rankings.map((entry) => {
      const player = room.players.find((item) => item.playerId === entry.playerId);
      return {
        ...entry,
        nickname: player?.nickname || entry.playerId,
        seatIndex: player?.seatIndex ?? -1,
        holeCards: game.playersById[entry.playerId].holeCards,
        unusedStashCards: game.playersById[entry.playerId].stashCards,
      };
    });
    game.winnerIds = result.winnerIds;
    for (const winnerId of result.winnerIds) {
      const player = room.players.find((item) => item.playerId === winnerId);
      if (player) {
        player.winsInRoom += 1;
      }
    }
    room.completedHands += 1;
    game.matchComplete = room.completedHands >= room.matchHands;
    game.currentPlayerId = null;
    game.turnDeadlineAt = null;
    this.setLastAction(game, {
      kind: 'hand_completed',
      round: actionRound || game.turnRound,
      playerId,
      actionType: actionOutcome?.actionType,
      toPlayerId: null,
      publicDiscardCardId: actionOutcome?.publicDiscardCardId,
      swappedCommunityCardId: actionOutcome?.swappedCommunityCardId,
    });
    room.phase = 'hand_result';
  }

  private setLastAction(game: PokerGame, action: Omit<GameLastAction, 'id'>): void {
    game.actionSeq += 1;
    game.lastAction = {
      id: game.actionSeq,
      ...action,
    };
  }

  private getSeatedPlayers(room: Room): Player[] {
    return room.players
      .filter((player) => player.seatIndex !== null)
      .sort((a, b) => (a.seatIndex as number) - (b.seatIndex as number));
  }

  private getOnlineSeatedPlayers(room: Room): Player[] {
    return this.getSeatedPlayers(room).filter((player) => player.connected);
  }

  private buildTurnOrder(players: Player[]): string[] {
    const ordered = [...players].sort((a, b) => (a.seatIndex as number) - (b.seatIndex as number));
    const startIndex = Math.floor(Math.random() * ordered.length);
    return [...ordered.slice(startIndex), ...ordered.slice(0, startIndex)].map((player) => player.playerId);
  }

  private clampMatchHands(matchHands: number): number {
    return Math.max(1, Math.min(5, Math.floor(matchHands || 1)));
  }

  private generateRoomId(): string {
    let roomId = '';
    do {
      roomId = Array.from({ length: ROOM_ID_LENGTH }, () => ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)]).join('');
    } while (this.rooms.has(roomId));
    return roomId;
  }
}
