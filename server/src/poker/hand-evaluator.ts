import { Card, HandEvaluation, HandScore, PlayerHandInput, PlayerRanking, RankingResult } from './types';

const RANK_VALUE: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const CATEGORY_LABELS: Record<number, string> = {
  8: '同花顺',
  7: '四条',
  6: '葫芦',
  5: '同花',
  4: '顺子',
  3: '三条',
  2: '两对',
  1: '一对',
  0: '高牌',
};

function compareScore(a: HandScore, b: HandScore): number {
  if (a.category !== b.category) {
    return a.category - b.category;
  }
  const length = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a.ranks[i] || 0) - (b.ranks[i] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function rankCounts(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of cards) {
    const value = RANK_VALUE[card.rank];
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

function sortedValues(cards: Card[]): number[] {
  return cards.map((card) => RANK_VALUE[card.rank]).sort((a, b) => b - a);
}

function straightHigh(values: number[]): number | null {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) {
    unique.push(1);
  }
  for (let i = 0; i <= unique.length - 5; i += 1) {
    const slice = unique.slice(i, i + 5);
    if (slice[0] - slice[4] === 4) {
      return slice[0];
    }
  }
  return null;
}

function evaluateFiveCards(cards: Card[]): HandEvaluation {
  const values = sortedValues(cards);
  const counts = rankCounts(cards);
  const groups = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straight = straightHigh(values);

  if (flush && straight) {
    const label = straight === 14 ? '皇家同花顺' : CATEGORY_LABELS[8];
    return { label, score: { category: 8, ranks: [straight] }, bestCards: cards };
  }

  const four = groups.find((group) => group.count === 4);
  if (four) {
    const kicker = values.find((value) => value !== four.value) || 0;
    return { label: CATEGORY_LABELS[7], score: { category: 7, ranks: [four.value, kicker] }, bestCards: cards };
  }

  const triple = groups.find((group) => group.count === 3);
  const pair = groups.find((group) => group.count === 2);
  if (triple && pair) {
    return { label: CATEGORY_LABELS[6], score: { category: 6, ranks: [triple.value, pair.value] }, bestCards: cards };
  }

  if (flush) {
    return { label: CATEGORY_LABELS[5], score: { category: 5, ranks: values }, bestCards: cards };
  }

  if (straight) {
    return { label: CATEGORY_LABELS[4], score: { category: 4, ranks: [straight] }, bestCards: cards };
  }

  if (triple) {
    const kickers = values.filter((value) => value !== triple.value).slice(0, 2);
    return { label: CATEGORY_LABELS[3], score: { category: 3, ranks: [triple.value, ...kickers] }, bestCards: cards };
  }

  const pairs = groups.filter((group) => group.count === 2).sort((a, b) => b.value - a.value);
  if (pairs.length === 2) {
    const kicker = values.find((value) => value !== pairs[0].value && value !== pairs[1].value) || 0;
    return { label: CATEGORY_LABELS[2], score: { category: 2, ranks: [pairs[0].value, pairs[1].value, kicker] }, bestCards: cards };
  }

  if (pairs.length === 1) {
    const kickers = values.filter((value) => value !== pairs[0].value).slice(0, 3);
    return { label: CATEGORY_LABELS[1], score: { category: 1, ranks: [pairs[0].value, ...kickers] }, bestCards: cards };
  }

  return { label: CATEGORY_LABELS[0], score: { category: 0, ranks: values }, bestCards: cards };
}

function combinations(cards: Card[], size: number): Card[][] {
  const result: Card[][] = [];
  const walk = (start: number, picked: Card[]) => {
    if (picked.length === size) {
      result.push(picked);
      return;
    }
    for (let i = start; i <= cards.length - (size - picked.length); i += 1) {
      walk(i + 1, [...picked, cards[i]]);
    }
  };
  walk(0, []);
  return result;
}

export function evaluateSevenCards(cards: Card[]): HandEvaluation {
  if (cards.length !== 7) {
    throw new Error('Texas Holdem evaluation requires exactly 7 cards');
  }

  return combinations(cards, 5)
    .map(evaluateFiveCards)
    .sort((a, b) => compareScore(b.score, a.score))[0];
}

export function compareHands(a: HandScore, b: HandScore): number {
  return compareScore(a, b);
}

export function rankPlayers(players: PlayerHandInput[], communityCards: Card[]): RankingResult {
  const evaluated = players.map((player) => ({
    playerId: player.playerId,
    evaluation: evaluateSevenCards([...player.holeCards, ...communityCards]),
  }));

  evaluated.sort((a, b) => compareScore(b.evaluation.score, a.evaluation.score));

  const rankings: PlayerRanking[] = [];
  let visibleRank = 1;
  for (let i = 0; i < evaluated.length; i += 1) {
    if (i > 0 && compareScore(evaluated[i].evaluation.score, evaluated[i - 1].evaluation.score) !== 0) {
      visibleRank = i + 1;
    }
    rankings.push({
      playerId: evaluated[i].playerId,
      rank: visibleRank,
      handLabel: evaluated[i].evaluation.label,
      bestCards: evaluated[i].evaluation.bestCards,
      score: evaluated[i].evaluation.score,
    });
  }

  return {
    rankings,
    winnerIds: rankings.filter((entry) => entry.rank === 1).map((entry) => entry.playerId),
  };
}
