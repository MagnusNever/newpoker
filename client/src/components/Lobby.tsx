import { useState } from 'react';
import { useGame } from '../context/GameContext';

export function Lobby() {
  const {
    phase,
    roomId,
    myPlayerId,
    publicState,
    createRoom,
    joinRoom,
    selectSeat,
    setMatchConfig,
    startGame,
    returnToLobby,
  } = useGame();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [matchHands, setMatchHands] = useState(1);

  if (phase === 'waiting' && publicState && roomId && myPlayerId) {
    const me = publicState.players.find((player) => player.playerId === myPlayerId);
    const isHost = publicState.hostPlayerId === myPlayerId;
    const seatedPlayers = publicState.players.filter((player) => player.seatIndex !== null);
    const canStart = isHost && seatedPlayers.length >= 2;

    return (
      <section className="panel lobby-panel">
        <div className="room-header">
          <div>
            <h1>德扑 PK</h1>
            <p>房间号</p>
          </div>
          <strong className="room-code">{roomId}</strong>
        </div>

        <div className="seat-grid" aria-label="座位选择">
          {Array.from({ length: publicState.maxSeats }, (_, seatIndex) => {
            const occupant = publicState.players.find((player) => player.seatIndex === seatIndex);
            const isMine = occupant?.playerId === myPlayerId;
            return (
              <button
                key={seatIndex}
                className={`seat-card ${occupant ? 'occupied' : 'empty'} ${isMine ? 'mine' : ''}`}
                onClick={() => selectSeat(seatIndex)}
                disabled={Boolean(occupant && !isMine)}
              >
                {occupant && <span className={`seat-badge ${isMine ? 'mine' : ''}`}>{isMine ? '我的座位' : '已入座'}</span>}
                <span className="seat-number">座位 {seatIndex + 1}</span>
                <span className="seat-name">{occupant ? occupant.nickname : '空座'}</span>
                <span className="seat-note">{occupant ? `${occupant.winsInRoom} 胜` : '点击入座'}</span>
              </button>
            );
          })}
        </div>

        <div className="waiting-bar">
          <span>逆时针行动顺序按座位编号 1 → 6 编排</span>
          <span>已入座 {seatedPlayers.length}/6</span>
        </div>

        {isHost && (
          <div className="host-controls">
            <label>
              游戏次数
              <select
                value={publicState.matchHands}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setMatchHands(value);
                  setMatchConfig(value);
                }}
              >
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count} 次
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-btn" onClick={startGame} disabled={!canStart}>
              开始游戏
            </button>
          </div>
        )}

        {!isHost && <p className="waiting-copy">等待房主开始。当前身份：{me?.nickname || '玩家'}</p>}
        <button className="ghost-btn" onClick={returnToLobby}>返回大厅</button>
      </section>
    );
  }

  if (mode === 'create') {
    return (
      <section className="panel lobby-panel narrow">
        <h1>创建房间</h1>
        <input
          className="text-input"
          placeholder="你的昵称"
          value={nickname}
          maxLength={20}
          onChange={(event) => setNickname(event.target.value)}
          autoFocus
        />
        <label className="stack-label">
          游戏次数
          <select value={matchHands} onChange={(event) => setMatchHands(Number(event.target.value))}>
            {[1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>
                {count} 次
              </option>
            ))}
          </select>
        </label>
        <button className="primary-btn" disabled={!nickname.trim()} onClick={() => createRoom(nickname, matchHands)}>
          创建
        </button>
        <button className="ghost-btn" onClick={() => setMode('choose')}>返回</button>
      </section>
    );
  }

  if (mode === 'join') {
    return (
      <section className="panel lobby-panel narrow">
        <h1>加入房间</h1>
        <input
          className="text-input"
          placeholder="你的昵称"
          value={nickname}
          maxLength={20}
          onChange={(event) => setNickname(event.target.value)}
          autoFocus
        />
        <input
          className="text-input code-input"
          placeholder="房间号"
          value={joinCode}
          maxLength={6}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
        />
        <button
          className="primary-btn"
          disabled={!nickname.trim() || !joinCode.trim()}
          onClick={() => joinRoom(joinCode, nickname)}
        >
          加入
        </button>
        <button className="ghost-btn" onClick={() => setMode('choose')}>返回</button>
      </section>
    );
  }

  return (
    <section className="panel lobby-panel hero">
      <p className="eyebrow">2-6 人 · 5 轮换牌 · 标准德扑 7 选 5</p>
      <h1>德扑 PK</h1>
      <div className="lobby-actions">
        <button className="primary-btn" onClick={() => setMode('create')}>创建房间</button>
        <button className="secondary-btn" onClick={() => setMode('join')}>加入房间</button>
      </div>
    </section>
  );
}
