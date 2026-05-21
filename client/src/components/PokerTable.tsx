import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { Card, GameLastAction, HandRanking, PlayerPublic, SUIT_COLORS, SUIT_SYMBOLS, TurnAction } from '../types/game';
import { getShowdownRevealState } from '../utils/showdownReveal';

const SHOWDOWN_REVEAL_MS = 1300;

function CardView({ card, compact = false, motionClass = '' }: { card: Card; compact?: boolean; motionClass?: string }) {
  return (
    <span className={`playing-card ${SUIT_COLORS[card.suit]} ${compact ? 'compact' : ''} ${motionClass}`}>
      <span>{card.rank}</span>
      <span>{SUIT_SYMBOLS[card.suit]}</span>
    </span>
  );
}

function EmptyCard({ label }: { label: string }) {
  return <span className="playing-card empty-card">{label}</span>;
}

function flashIds(setter: (ids: Set<string>) => void, ids: string[], duration = 900) {
  if (ids.length === 0) {
    return undefined;
  }
  setter(new Set(ids));
  const timer = window.setTimeout(() => setter(new Set()), duration);
  return () => window.clearTimeout(timer);
}

function actionText(actionType?: TurnAction['type']) {
  if (actionType === 'swap_hole') {
    return '置换手牌';
  }
  if (actionType === 'swap_community') {
    return '置换公共牌';
  }
  return '不操作';
}

function playerName(players: PlayerPublic[], playerId?: string | null) {
  if (!playerId) {
    return '玩家';
  }
  return players.find((player) => player.playerId === playerId)?.nickname || '玩家';
}

function buildActionFeed(
  lastAction: GameLastAction | null,
  players: PlayerPublic[],
  currentPlayerName: string,
  isMyTurn: boolean,
) {
  if (!lastAction) {
    return {
      eyebrow: '牌局同步',
      title: `${currentPlayerName} 行动中`,
      detail: isMyTurn ? '轮到你操作，先选择暂存牌' : '等待当前玩家完成操作',
    };
  }

  if (lastAction.kind === 'turn_started') {
    const nextName = playerName(players, lastAction.toPlayerId);
    return {
      eyebrow: `第 ${lastAction.round}/5 轮`,
      title: `发牌完成，${nextName} 抽牌行动`,
      detail: nextName === currentPlayerName && isMyTurn ? '轮到你了，查看暂存区新牌' : '当前玩家已抽牌，等待选择动作',
    };
  }

  if (lastAction.kind === 'hand_completed') {
    return {
      eyebrow: '换牌结束',
      title: '所有行动完成，进入最终比拼',
      detail: `${playerName(players, lastAction.playerId)} 完成了${actionText(lastAction.actionType)}`,
    };
  }

  const actorName = playerName(players, lastAction.playerId);
  const nextName = playerName(players, lastAction.toPlayerId);
  const detail = lastAction.actionType === 'swap_community'
    ? '公共牌已更新，旧公共牌进入公开弃牌区'
    : lastAction.actionType === 'swap_hole'
      ? '手牌已置换，旧手牌进入私密弃牌区'
      : '暂存牌保留，行动交给下一位玩家';

  return {
    eyebrow: `第 ${lastAction.round}/5 轮`,
    title: `${actorName} ${actionText(lastAction.actionType)}，轮到 ${nextName}`,
    detail,
  };
}

export function PokerTable() {
  const { publicState, privateState, myPlayerId, submitTurnAction, continueNextHand } = useGame();
  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const [selectedHoleId, setSelectedHoleId] = useState<string | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [revealedCount, setRevealedCount] = useState(0);
  const [animatedCommunityIds, setAnimatedCommunityIds] = useState<Set<string>>(new Set());
  const [animatedDiscardIds, setAnimatedDiscardIds] = useState<Set<string>>(new Set());
  const [animatedHoleIds, setAnimatedHoleIds] = useState<Set<string>>(new Set());
  const [animatedStashIds, setAnimatedStashIds] = useState<Set<string>>(new Set());
  const previousCommunityIds = useRef<string[] | null>(null);
  const previousDiscardIds = useRef<string[] | null>(null);
  const previousHoleIds = useRef<string[] | null>(null);
  const previousStashIds = useRef<string[] | null>(null);
  const communityKey = publicState?.game?.communityCards.map((card) => card.id).join('|') || '';
  const discardKey = publicState?.game?.publicDiscards.map((card) => card.id).join('|') || '';
  const holeKey = privateState?.holeCards.map((card) => card.id).join('|') || '';
  const stashKey = privateState?.stashCards.map((card) => card.id).join('|') || '';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedStashId(null);
    setSelectedHoleId(null);
    setSelectedCommunityId(null);
  }, [publicState?.game?.currentPlayerId, publicState?.game?.turnRound]);

  useEffect(() => {
    if (publicState?.phase !== 'hand_result' || !publicState.game?.rankings.length) {
      setRevealedCount(0);
      return;
    }
    setRevealedCount(0);
    const timer = window.setInterval(() => {
      setRevealedCount((count) => {
        if (count >= publicState.game!.rankings.length + 1) {
          window.clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, SHOWDOWN_REVEAL_MS);
    return () => window.clearInterval(timer);
  }, [publicState?.phase, publicState?.completedHands, publicState?.game?.rankings.length]);

  useEffect(() => {
    if (!publicState?.game) {
      previousCommunityIds.current = null;
      setAnimatedCommunityIds(new Set());
      return;
    }

    const ids = publicState.game.communityCards.map((card) => card.id);
    const previous = previousCommunityIds.current;
    const changed = previous === null ? ids : ids.filter((id, index) => previous[index] !== id);
    previousCommunityIds.current = ids;
    return flashIds(setAnimatedCommunityIds, changed, 950);
  }, [communityKey, publicState?.game]);

  useEffect(() => {
    if (!publicState?.game) {
      previousDiscardIds.current = null;
      setAnimatedDiscardIds(new Set());
      return;
    }

    const ids = publicState.game.publicDiscards.map((card) => card.id);
    const previous = previousDiscardIds.current;
    const changed = previous === null ? [] : ids.filter((id) => !previous.includes(id));
    previousDiscardIds.current = ids;
    return flashIds(setAnimatedDiscardIds, changed, 1100);
  }, [discardKey, publicState?.game]);

  useEffect(() => {
    if (!privateState) {
      previousHoleIds.current = null;
      setAnimatedHoleIds(new Set());
      return;
    }

    const ids = privateState.holeCards.map((card) => card.id);
    const previous = previousHoleIds.current;
    const changed = previous === null ? ids : ids.filter((id) => !previous.includes(id));
    previousHoleIds.current = ids;
    return flashIds(setAnimatedHoleIds, changed, 950);
  }, [holeKey, privateState]);

  useEffect(() => {
    if (!privateState) {
      previousStashIds.current = null;
      setAnimatedStashIds(new Set());
      return;
    }

    const ids = privateState.stashCards.map((card) => card.id);
    const previous = previousStashIds.current;
    const changed = previous === null ? ids : ids.filter((id) => !previous.includes(id));
    previousStashIds.current = ids;
    return flashIds(setAnimatedStashIds, changed, 950);
  }, [stashKey, privateState]);

  const currentPlayer = useMemo(
    () => publicState?.players.find((player) => player.playerId === publicState.game?.currentPlayerId),
    [publicState],
  );
  const me = publicState?.players.find((player) => player.playerId === myPlayerId);
  const isMyTurn = Boolean(publicState?.game?.currentPlayerId && publicState.game.currentPlayerId === myPlayerId);
  const secondsLeft = Math.max(0, Math.ceil(((publicState?.game?.turnDeadlineAt || 0) - now) / 1000));

  if (!publicState || !publicState.game || !privateState) {
    return (
      <section className="panel">
        <h1>正在同步牌桌</h1>
      </section>
    );
  }

  const game = publicState.game;
  const rankingsByPlayerId = new Map(game.rankings.map((entry) => [entry.playerId, entry]));
  const showdownRankings = game.turnOrder
    .map((playerId) => rankingsByPlayerId.get(playerId))
    .filter((entry): entry is HandRanking => Boolean(entry));
  const orderedRevealRankings = showdownRankings.length ? showdownRankings : game.rankings;
  const revealState = getShowdownRevealState(orderedRevealRankings, revealedCount);
  const revealTotal = revealState.revealTotal;
  const revealComplete = publicState.phase !== 'hand_result' || revealState.isFinalRanking;
  const visibleRankings = publicState.phase === 'hand_result'
    ? (revealComplete ? game.rankings : revealState.visibleEntries)
    : game.rankings;
  const activeRevealPlayerId = !revealComplete && revealState.visibleEntries.length > 0
    ? revealState.visibleEntries[revealState.visibleEntries.length - 1].playerId
    : null;
  const actionFeed = buildActionFeed(game.lastAction, publicState.players, currentPlayer?.nickname || '玩家', isMyTurn);
  const submitKeep = () => submitTurnAction({ type: 'keep' });
  const submitSwapHole = () => {
    if (selectedStashId && selectedHoleId) {
      submitTurnAction({ type: 'swap_hole', stashCardId: selectedStashId, holeCardId: selectedHoleId });
    }
  };
  const submitSwapCommunity = () => {
    if (selectedStashId && selectedCommunityId) {
      submitTurnAction({ type: 'swap_community', stashCardId: selectedStashId, communityCardId: selectedCommunityId });
    }
  };

  return (
    <section className="table-shell">
      <header className="table-header panel">
        <div>
          <p className="eyebrow">房间 {publicState.roomId}</p>
          <h1>第 {publicState.completedHands + 1} / {publicState.matchHands} 次游戏</h1>
        </div>
        <div className="table-meta">
          <span key={`deck-${game.deckRemaining}`} className="meta-chip deck-chip">牌堆 {game.deckRemaining}</span>
          <span key={`private-${game.privateDiscardCount}`} className="meta-chip discard-chip">私密弃牌 {game.privateDiscardCount}</span>
          <span key={`public-${game.publicDiscards.length}`} className="meta-chip discard-chip">公开弃牌 {game.publicDiscards.length}</span>
          <button className="secondary-btn rules-trigger" type="button" onClick={() => setRulesOpen(true)}>玩法说明</button>
        </div>
      </header>

      {rulesOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setRulesOpen(false)}>
          <div className="rules-modal panel" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(event) => event.stopPropagation()}>
            <div className="rules-head">
              <div>
                <p className="eyebrow">快速规则</p>
                <h2 id="rules-title">德扑 PK 玩法说明</h2>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setRulesOpen(false)}>关闭</button>
            </div>
            <div className="rules-grid">
              <section>
                <strong>开局</strong>
                <p>每名玩家获得 2 张仅自己可见的手牌，桌面发出 5 张公共牌，剩余牌进入牌堆。</p>
              </section>
              <section>
                <strong>换牌</strong>
                <p>共 5 轮，从当前行动玩家开始依次操作。每次先抽 1 张进入暂存区，再选择不操作、置换手牌或置换公共牌。</p>
              </section>
              <section>
                <strong>暂存区</strong>
                <p>暂存区只在换牌阶段供你选择使用。最终结算时，未使用的暂存牌会公开展示，但不参与牌型组合。</p>
              </section>
              <section>
                <strong>比拼</strong>
                <p>最终用 2 张手牌 + 5 张公共牌按标准德州扑克 7 选 5 判定牌型；并列第一时，并列玩家都获得胜场。</p>
              </section>
            </div>
          </div>
        </div>
      )}

      <div className="seats-strip">
        {Array.from({ length: publicState.maxSeats }, (_, seatIndex) => {
          const player = publicState.players.find((item) => item.seatIndex === seatIndex);
          return (
            <div
              key={seatIndex}
              className={`table-seat ${player?.playerId === myPlayerId ? 'mine' : ''} ${player?.playerId === game.currentPlayerId ? 'active' : ''} ${player?.playerId === game.lastAction?.playerId ? 'acted' : ''} ${player?.playerId === game.lastAction?.toPlayerId ? 'turn-target' : ''}`}
            >
              <span>座位 {seatIndex + 1}</span>
              <strong>{player?.nickname || '空座'}</strong>
              <small>{player ? `${player.winsInRoom} 胜` : '逆时针编号'}</small>
            </div>
          );
        })}
      </div>

      <div className="panel table-panel">
        {publicState.phase === 'playing' && (
          <div key={game.lastAction?.id || `${game.currentPlayerId}-${game.turnRound}`} className={`action-feed ${isMyTurn ? 'mine' : ''}`} aria-live="polite">
            <span>{actionFeed.eyebrow}</span>
            <strong>{actionFeed.title}</strong>
            <small>{actionFeed.detail}</small>
          </div>
        )}

        <div className="community-area">
          <div className="section-title">
            <span>公共牌</span>
            {publicState.phase === 'playing' && <strong>第 {game.turnRound}/5 轮 · {currentPlayer?.nickname || '玩家'} 行动 · {secondsLeft}s</strong>}
          </div>
          <div className="card-row community-row">
            {game.communityCards.map((card) => (
              <button
                key={card.id}
                className={`card-button ${selectedCommunityId === card.id ? 'selected' : ''} ${animatedCommunityIds.has(card.id) ? 'card-button-motion' : ''}`}
                onClick={() => setSelectedCommunityId(card.id)}
                disabled={!isMyTurn}
              >
                <CardView card={card} motionClass={animatedCommunityIds.has(card.id) ? 'motion-community' : ''} />
              </button>
            ))}
          </div>
        </div>

        {publicState.phase === 'hand_result' && (
          <div className="result-panel">
            <h2>{game.matchComplete ? '本组游戏完成' : '本次结算'}</h2>
            <p className="reveal-status">
              {revealComplete
                ? '亮牌完成，结算如下'
                : revealedCount === 0
                  ? `准备按行动顺序亮牌 0/${revealTotal}`
                  : `按行动顺序亮牌 ${revealState.revealedCount}/${revealTotal}`}
            </p>
            {revealComplete && game.winnerIds.length > 0 && (
              <div className="winner-banner">
                <span>WINNER</span>
                <strong>
                  {game.rankings
                    .filter((entry) => game.winnerIds.includes(entry.playerId))
                    .map((entry) => entry.nickname)
                    .join(' / ')}
                </strong>
              </div>
            )}
            <div className="ranking-list">
              {!revealComplete && revealedCount === 0 && (
                <div className="showdown-waiting">系统正在按行动顺序准备亮牌...</div>
              )}
              {visibleRankings.map((entry, index) => (
                <div
                  key={entry.playerId}
                  className={`ranking-card revealed ${!revealComplete ? 'showdown-revealing' : ''} ${entry.playerId === activeRevealPlayerId ? 'spotlight' : ''} ${game.winnerIds.includes(entry.playerId) && revealComplete ? 'winner' : ''}`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="ranking-main">
                    {!revealComplete && entry.playerId === activeRevealPlayerId && <small className="reveal-badge">正在亮牌</small>}
                    <strong>#{entry.rank} {entry.nickname}</strong>
                    <span>{entry.handLabel}</span>
                  </div>
                  <div className="showdown-groups">
                    <div className="showdown-group">
                      <em>手牌</em>
                      <div className="card-row small">
                        {entry.holeCards.map((card) => <CardView key={card.id} card={card} compact />)}
                      </div>
                    </div>
                    <div className="showdown-group scoring">
                      <em>最佳五张</em>
                      <div className="card-row small">
                        {entry.bestCards.map((card) => <CardView key={card.id} card={card} compact />)}
                      </div>
                    </div>
                    <div className="showdown-group muted">
                      <em>未参与暂存牌</em>
                      <div className="card-row small">
                        {entry.unusedStashCards.length === 0 && <span className="mini-empty">无</span>}
                        {entry.unusedStashCards.map((card) => <CardView key={card.id} card={card} compact />)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="primary-btn" disabled={!revealComplete || me?.readyForNextHand} onClick={continueNextHand}>
              {game.matchComplete ? '确认回到座位页' : me?.readyForNextHand ? '等待其他玩家' : '继续下一次'}
            </button>
          </div>
        )}

        {publicState.phase === 'playing' && (
          <div className="player-console">
            <div className="hand-zone">
              <div>
                <div className="section-title"><span>你的手牌</span></div>
                <div className="card-row">
                  {privateState.holeCards.map((card) => (
                    <button
                      key={card.id}
                      className={`card-button ${selectedHoleId === card.id ? 'selected' : ''} ${animatedHoleIds.has(card.id) ? 'card-button-motion' : ''}`}
                      onClick={() => setSelectedHoleId(card.id)}
                      disabled={!isMyTurn}
                    >
                      <CardView card={card} motionClass={animatedHoleIds.has(card.id) ? 'motion-hole' : ''} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="section-title"><span>暂存区</span></div>
                <div className="card-row">
                  {privateState.stashCards.length === 0 && <EmptyCard label="待抽牌" />}
                  {privateState.stashCards.map((card) => (
                    <button
                      key={card.id}
                      className={`card-button ${selectedStashId === card.id ? 'selected' : ''} ${animatedStashIds.has(card.id) ? 'card-button-motion' : ''}`}
                      onClick={() => setSelectedStashId(card.id)}
                      disabled={!isMyTurn}
                    >
                      <CardView card={card} motionClass={animatedStashIds.has(card.id) ? 'motion-stash' : ''} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="action-bar">
              <button className="secondary-btn" disabled={!isMyTurn} onClick={submitKeep}>不操作</button>
              <button className="secondary-btn" disabled={!isMyTurn || !selectedStashId || !selectedHoleId} onClick={submitSwapHole}>
                置换手牌
              </button>
              <button className="secondary-btn" disabled={!isMyTurn || !selectedStashId || !selectedCommunityId} onClick={submitSwapCommunity}>
                置换公共牌
              </button>
            </div>
          </div>
        )}

        <div className="discard-area">
          <div className="section-title"><span>公开弃牌</span></div>
          <div className="card-row small">
            {game.publicDiscards.length === 0 && <EmptyCard label="无" />}
            {game.publicDiscards.map((card) => (
              <CardView key={card.id} card={card} compact motionClass={animatedDiscardIds.has(card.id) ? 'motion-discard' : ''} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
