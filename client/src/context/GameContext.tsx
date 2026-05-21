import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { GameState, PublicState, PrivateState, RoomPhase, TurnAction } from '../types/game';
import { useSocket } from '../hooks/useSocket';

const initialState: GameState = {
  phase: 'lobby',
  roomId: null,
  myPlayerId: null,
  publicState: null,
  privateState: null,
  errorMessage: null,
};

interface GameContextValue extends GameState {
  createRoom: (nickname: string, matchHands: number) => void;
  joinRoom: (roomId: string, nickname: string) => void;
  selectSeat: (seatIndex: number) => void;
  setMatchConfig: (matchHands: number) => void;
  startGame: () => void;
  submitTurnAction: (action: TurnAction) => void;
  continueNextHand: () => void;
  returnToLobby: () => void;
  clearError: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const socketApi = useSocket();

  useEffect(() => {
    const socket = socketApi.socketRef.current;
    if (!socket) return;

    const applyRoomIdentity = (data: { roomId: string; playerId: string }) => {
      setState((prev) => ({
        ...prev,
        roomId: data.roomId,
        myPlayerId: data.playerId,
        phase: 'waiting',
      }));
    };

    const applyPublicState = (data: PublicState) => {
      setState((prev) => ({
        ...prev,
        publicState: data,
        roomId: data.roomId,
        phase: data.phase as RoomPhase,
      }));
    };

    const applyPrivateState = (data: PrivateState) => {
      setState((prev) => ({
        ...prev,
        privateState: data,
        myPlayerId: prev.myPlayerId || data.playerId,
      }));
    };

    socket.on('room_created', applyRoomIdentity);
    socket.on('room_joined', applyRoomIdentity);
    socket.on('public_state', applyPublicState);
    socket.on('private_state', applyPrivateState);
    socket.on('game_cancelled', (data: { message: string }) => {
      setState((prev) => ({ ...prev, errorMessage: data.message }));
    });
    socket.on('error', (data: { message: string }) => {
      setState((prev) => ({ ...prev, errorMessage: data.message }));
    });

    return () => {
      socket.off('room_created', applyRoomIdentity);
      socket.off('room_joined', applyRoomIdentity);
      socket.off('public_state', applyPublicState);
      socket.off('private_state', applyPrivateState);
      socket.off('game_cancelled');
      socket.off('error');
    };
  }, [socketApi.socketRef]);

  const requireRoomId = useCallback(() => {
    if (!state.roomId) {
      throw new Error('Room is not available');
    }
    return state.roomId;
  }, [state.roomId]);

  const createRoom = useCallback(
    (nickname: string, matchHands: number) => socketApi.createRoom(nickname, matchHands),
    [socketApi],
  );

  const joinRoom = useCallback(
    (roomId: string, nickname: string) => socketApi.joinRoom(roomId.trim().toUpperCase(), nickname),
    [socketApi],
  );

  const selectSeat = useCallback(
    (seatIndex: number) => socketApi.selectSeat(requireRoomId(), seatIndex),
    [requireRoomId, socketApi],
  );

  const setMatchConfig = useCallback(
    (matchHands: number) => socketApi.setMatchConfig(requireRoomId(), matchHands),
    [requireRoomId, socketApi],
  );

  const startGame = useCallback(() => socketApi.startGame(requireRoomId()), [requireRoomId, socketApi]);

  const submitTurnAction = useCallback(
    (action: TurnAction) => socketApi.submitTurnAction(requireRoomId(), action),
    [requireRoomId, socketApi],
  );

  const continueNextHand = useCallback(
    () => socketApi.continueNextHand(requireRoomId()),
    [requireRoomId, socketApi],
  );

  const returnToLobby = useCallback(() => setState(initialState), []);
  const clearError = useCallback(() => setState((prev) => ({ ...prev, errorMessage: null })), []);

  return (
    <GameContext.Provider
      value={{
        ...state,
        createRoom,
        joinRoom,
        selectSeat,
        setMatchConfig,
        startGame,
        submitTurnAction,
        continueNextHand,
        returnToLobby,
        clearError,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}
