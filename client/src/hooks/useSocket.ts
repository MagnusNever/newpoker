import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { TurnAction } from '../types/game';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://127.0.0.1:3000' : undefined);
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const getSocket = useCallback(() => {
    if (!socketRef.current) {
      throw new Error('Socket not initialized');
    }
    return socketRef.current;
  }, []);

  const createRoom = useCallback(
    (nickname: string, matchHands: number) => {
      getSocket().emit('create_room', { nickname, matchHands });
    },
    [getSocket],
  );

  const joinRoom = useCallback(
    (roomId: string, nickname: string) => {
      getSocket().emit('join_room', { roomId, nickname });
    },
    [getSocket],
  );

  const selectSeat = useCallback(
    (roomId: string, seatIndex: number) => {
      getSocket().emit('select_seat', { roomId, seatIndex });
    },
    [getSocket],
  );

  const setMatchConfig = useCallback(
    (roomId: string, matchHands: number) => {
      getSocket().emit('set_match_config', { roomId, matchHands });
    },
    [getSocket],
  );

  const startGame = useCallback(
    (roomId: string) => {
      getSocket().emit('start_game', { roomId });
    },
    [getSocket],
  );

  const submitTurnAction = useCallback(
    (roomId: string, action: TurnAction) => {
      getSocket().emit('submit_turn_action', { roomId, action });
    },
    [getSocket],
  );

  const continueNextHand = useCallback(
    (roomId: string) => {
      getSocket().emit('continue_next_hand', { roomId });
    },
    [getSocket],
  );

  return {
    socketRef,
    createRoom,
    joinRoom,
    selectSeat,
    setMatchConfig,
    startGame,
    submitTurnAction,
    continueNextHand,
  };
}
