const test = require('node:test');
const assert = require('node:assert/strict');

const { RoomService } = require('../build/game/room.service');

function c(id) {
  const suitMap = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
  return { id, rank: id.slice(0, -1), suit: suitMap[id.slice(-1)] };
}

test('starts a poker hand only after players choose seats', () => {
  const rooms = new RoomService();
  const room = rooms.createRoom('host-socket', 'Host', 3);
  const join = rooms.joinRoom(room.roomId, 'guest-socket', 'Guest');

  assert.equal(join.ok, true);
  assert.equal(rooms.startMatch(room.roomId, 'host-socket').ok, false);

  assert.equal(rooms.selectSeat(room.roomId, 'host-socket', 0).ok, true);
  assert.equal(rooms.selectSeat(room.roomId, 'guest-socket', 1).ok, true);

  const started = rooms.startMatch(room.roomId, 'host-socket');
  assert.equal(started.ok, true);
  assert.equal(room.phase, 'playing');
  assert.equal(room.game.communityCards.length, 5);
  assert.equal(room.game.playersById['host-socket'].holeCards.length, 2);
  assert.equal(room.game.playersById['guest-socket'].holeCards.length, 2);
});

test('submitting any turn action automatically advances to the next player', () => {
  const rooms = new RoomService();
  const room = rooms.createRoom('p1', 'One', 1);
  rooms.joinRoom(room.roomId, 'p2', 'Two');
  rooms.selectSeat(room.roomId, 'p1', 0);
  rooms.selectSeat(room.roomId, 'p2', 1);
  rooms.startMatch(room.roomId, 'p1');

  const firstPlayer = room.game.currentPlayerId;
  const result = rooms.submitTurnAction(room.roomId, firstPlayer, { type: 'keep' });

  assert.equal(result.ok, true);
  assert.notEqual(room.game.currentPlayerId, firstPlayer);
});

test('public state exposes turn start and action transition summaries', () => {
  const rooms = new RoomService();
  const room = rooms.createRoom('p1', 'One', 1);
  rooms.joinRoom(room.roomId, 'p2', 'Two');
  rooms.selectSeat(room.roomId, 'p1', 0);
  rooms.selectSeat(room.roomId, 'p2', 1);
  rooms.startMatch(room.roomId, 'p1');

  const firstPlayer = room.game.currentPlayerId;
  let state = rooms.getPublicState(room);

  assert.equal(state.game.lastAction.kind, 'turn_started');
  assert.equal(state.game.lastAction.toPlayerId, firstPlayer);
  assert.equal(state.game.lastAction.round, 1);

  const result = rooms.submitTurnAction(room.roomId, firstPlayer, { type: 'keep' });
  assert.equal(result.ok, true);

  state = rooms.getPublicState(room);
  assert.equal(state.game.lastAction.kind, 'turn_advanced');
  assert.equal(state.game.lastAction.playerId, firstPlayer);
  assert.equal(state.game.lastAction.actionType, 'keep');
  assert.equal(state.game.lastAction.toPlayerId, room.game.currentPlayerId);
  assert.equal(Object.hasOwn(state.game.lastAction, 'card'), false);
});

test('cancels the current hand without wins when only one player remains online', () => {
  const rooms = new RoomService();
  const room = rooms.createRoom('p1', 'One', 1);
  rooms.joinRoom(room.roomId, 'p2', 'Two');
  rooms.selectSeat(room.roomId, 'p1', 0);
  rooms.selectSeat(room.roomId, 'p2', 1);
  rooms.startMatch(room.roomId, 'p1');

  const result = rooms.disconnectPlayer('p2');

  assert.equal(result.cancelledHand, true);
  assert.equal(room.phase, 'waiting');
  assert.equal(room.players.find((player) => player.playerId === 'p1').winsInRoom, 0);
  assert.equal(room.completedHands, 0);
});

test('rejects joining after a hand has started', () => {
  const rooms = new RoomService();
  const room = rooms.createRoom('p1', 'One', 1);
  rooms.joinRoom(room.roomId, 'p2', 'Two');
  rooms.selectSeat(room.roomId, 'p1', 0);
  rooms.selectSeat(room.roomId, 'p2', 1);
  rooms.startMatch(room.roomId, 'p1');

  const result = rooms.joinRoom(room.roomId, 'p3', 'Three');

  assert.equal(result.ok, false);
});

test('public seat state hides stash counts during play', () => {
  const rooms = new RoomService();
  const room = rooms.createRoom('p1', 'One', 1);
  rooms.joinRoom(room.roomId, 'p2', 'Two');
  rooms.selectSeat(room.roomId, 'p1', 0);
  rooms.selectSeat(room.roomId, 'p2', 1);
  rooms.startMatch(room.roomId, 'p1');

  const state = rooms.getPublicState(room);

  assert.equal(Object.hasOwn(state.players[0], 'stashCardCount'), false);
});

test('hand result exposes unused stash separately from scoring cards', () => {
  const rooms = new RoomService();
  const room = rooms.createRoom('p1', 'One', 1);
  rooms.joinRoom(room.roomId, 'p2', 'Two');
  rooms.selectSeat(room.roomId, 'p1', 0);
  rooms.selectSeat(room.roomId, 'p2', 1);
  rooms.startMatch(room.roomId, 'p1');

  room.game.communityCards = [c('4C'), c('5D'), c('6H'), c('9S'), c('KD')];
  room.game.playersById.p1.holeCards = [c('2C'), c('3D')];
  room.game.playersById.p1.stashCards = [c('AS')];
  room.game.playersById.p2.holeCards = [c('AH'), c('QD')];
  room.game.playersById.p2.stashCards = [c('AC')];

  while (room.phase === 'playing') {
    rooms.submitTurnAction(room.roomId, room.game.currentPlayerId, { type: 'keep' });
  }

  const p1Ranking = room.game.rankings.find((entry) => entry.playerId === 'p1');

  assert.equal(Object.hasOwn(p1Ranking, 'unusedStashCards'), true);
  assert.equal(p1Ranking.unusedStashCards.some((card) => card.id === 'AS'), true);
  assert.equal(p1Ranking.bestCards.some((card) => card.id === 'AS'), false);
});
