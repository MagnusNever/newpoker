import test from 'node:test';
import assert from 'node:assert/strict';
import { getShowdownRevealState } from '../src/utils/showdownReveal.ts';

const rankings = [
  { playerId: 'p1', rank: 1 },
  { playerId: 'p2', rank: 2 },
  { playerId: 'p3', rank: 3 },
];

test('showdown reveal leaves one beat after the last player before final ranking', () => {
  assert.deepEqual(getShowdownRevealState(rankings, 0).visibleEntries, []);
  assert.equal(getShowdownRevealState(rankings, 0).isFinalRanking, false);

  assert.deepEqual(getShowdownRevealState(rankings, 1).visibleEntries.map((entry) => entry.playerId), ['p1']);
  assert.equal(getShowdownRevealState(rankings, 1).isFinalRanking, false);

  const lastPlayerBeat = getShowdownRevealState(rankings, rankings.length);
  assert.deepEqual(lastPlayerBeat.visibleEntries.map((entry) => entry.playerId), ['p1', 'p2', 'p3']);
  assert.equal(lastPlayerBeat.isFinalRanking, false);

  const finalRankingBeat = getShowdownRevealState(rankings, rankings.length + 1);
  assert.deepEqual(finalRankingBeat.visibleEntries.map((entry) => entry.playerId), ['p1', 'p2', 'p3']);
  assert.equal(finalRankingBeat.isFinalRanking, true);
});
