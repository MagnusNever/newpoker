import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Room, RoomService, TurnAction } from './room.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private turnTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly roomService: RoomService) {}

  handleConnection(client: Socket): void {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    console.log(`Client disconnected: ${client.id}`);
    const result = this.roomService.disconnectPlayer(client.id);
    if (!result.room) {
      return;
    }
    client.leave(result.room.roomId);
    if (result.cancelledHand) {
      this.clearTurnTimer(result.room.roomId);
      this.server.to(result.room.roomId).emit('game_cancelled', {
        message: '只剩 1 名玩家在线，本次游戏已取消且不计胜场',
      });
    }
    this.broadcastRoom(result.room);
  }

  @SubscribeMessage('create_room')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { nickname: string; matchHands?: number },
  ): void {
    const room = this.roomService.createRoom(client.id, this.cleanNickname(payload.nickname), payload.matchHands || 1);
    client.join(room.roomId);
    client.emit('room_created', { roomId: room.roomId, playerId: client.id });
    this.broadcastRoom(room);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; nickname: string },
  ): void {
    const result = this.roomService.joinRoom(payload.roomId, client.id, this.cleanNickname(payload.nickname));
    if (!result.ok) {
      client.emit('error', { message: result.message });
      return;
    }
    const joined = result.value;
    if (!joined) {
      client.emit('error', { message: '加入房间失败' });
      return;
    }
    client.join(joined.room.roomId);
    client.emit('room_joined', { roomId: joined.room.roomId, playerId: client.id });
    this.broadcastRoom(joined.room);
  }

  @SubscribeMessage('select_seat')
  handleSelectSeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; seatIndex: number },
  ): void {
    this.handleRoomMutation(client, payload.roomId, (room) => this.roomService.selectSeat(room.roomId, client.id, payload.seatIndex));
  }

  @SubscribeMessage('set_match_config')
  handleSetMatchConfig(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; matchHands: number },
  ): void {
    this.handleRoomMutation(client, payload.roomId, (room) => this.roomService.setMatchHands(room.roomId, client.id, payload.matchHands));
  }

  @SubscribeMessage('start_game')
  handleStartGame(@ConnectedSocket() client: Socket, @MessageBody() payload: { roomId: string }): void {
    this.handleRoomMutation(client, payload.roomId, (room) => this.roomService.startMatch(room.roomId, client.id), true);
  }

  @SubscribeMessage('submit_turn_action')
  handleSubmitTurnAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; action: TurnAction },
  ): void {
    this.handleRoomMutation(client, payload.roomId, (room) => this.roomService.submitTurnAction(room.roomId, client.id, payload.action), true);
  }

  @SubscribeMessage('continue_next_hand')
  handleContinueNextHand(@ConnectedSocket() client: Socket, @MessageBody() payload: { roomId: string }): void {
    this.handleRoomMutation(client, payload.roomId, (room) => this.roomService.continueNextHand(room.roomId, client.id), true);
  }

  private handleRoomMutation(
    client: Socket,
    roomId: string,
    mutate: (room: Room) => ReturnType<RoomService['selectSeat']>,
    scheduleTurn = false,
  ): void {
    const room = this.roomService.getRoom(roomId);
    if (!room) {
      client.emit('error', { message: '房间不存在' });
      return;
    }
    const result = mutate(room);
    if (!result.ok) {
      client.emit('error', { message: result.message });
      return;
    }
    this.broadcastRoom(room);
    if (scheduleTurn) {
      this.scheduleTurnTimer(room);
    }
  }

  private broadcastRoom(room: Room): void {
    this.server.to(room.roomId).emit('public_state', this.roomService.getPublicState(room));
    for (const player of room.players) {
      if (player.connected) {
        this.server.to(player.socketId).emit('private_state', this.roomService.getPrivateState(room, player.playerId));
      }
    }
  }

  private scheduleTurnTimer(room: Room): void {
    this.clearTurnTimer(room.roomId);
    const currentPlayerId = room.game?.currentPlayerId;
    const deadline = room.game?.turnDeadlineAt;
    if (!currentPlayerId || !deadline || room.phase !== 'playing') {
      return;
    }
    const delay = Math.max(0, deadline - Date.now());
    const timer = setTimeout(() => {
      const activeRoom = this.roomService.getRoom(room.roomId);
      if (!activeRoom || activeRoom.phase !== 'playing' || activeRoom.game?.currentPlayerId !== currentPlayerId) {
        return;
      }
      this.roomService.submitTurnAction(activeRoom.roomId, currentPlayerId, { type: 'keep' });
      this.server.to(activeRoom.roomId).emit('turn_resolved', { playerId: currentPlayerId, action: { type: 'keep' }, auto: true });
      this.broadcastRoom(activeRoom);
      this.scheduleTurnTimer(activeRoom);
    }, delay);
    this.turnTimers.set(room.roomId, timer);
  }

  private clearTurnTimer(roomId: string): void {
    const timer = this.turnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(roomId);
    }
  }

  private cleanNickname(nickname: string): string {
    const cleaned = `${nickname || ''}`.trim().slice(0, 20);
    return cleaned || '玩家';
  }
}
