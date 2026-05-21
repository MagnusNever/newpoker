const test = require('node:test');
const assert = require('node:assert/strict');

const { createDeck, shuffleDeck, drawCard } = require('../build/poker/deck');
const { evaluateSevenCards, rankPlayers } = require('../build/poker/hand-evaluator');

function c(id) {
  const suitMap = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
  return { id, rank: id.slice(0, -1), suit: suitMap[id.slice(-1)] };
}

test('creates a unique 52-card deck without jokers', () => {
  const deck = createDeck();
  const ids = new Set(deck.map((card) => card.id));

  assert.equal(deck.length, 52);
  assert.equal(ids.size, 52);
  assert.equal(deck.some((card) => card.rank === 'joker'), false);
});

test('six players can complete initial deal plus five draw rounds without exhausting the deck', () => {
  let deck = shuffleDeck(createDeck(), () => 0.42);

  for (let i = 0; i < 12; i += 1) {
    const drawn = drawCard(deck);
    deck = drawn.deck;
  }

  for (let i = 0; i < 5; i += 1) {
    const drawn = drawCard(deck);
    deck = drawn.deck;
  }

  for (let i = 0; i < 30; i += 1) {
    const drawn = drawCard(deck);
    deck = drawn.deck;
  }

  assert.equal(deck.length, 5);
});

test('evaluates standard holdem hand strength in rank order', () => {
  const straightFlush = evaluateSevenCards([c('AS'), c('KS'), c('QS'), c('JS'), c('10S'), c('2C'), c('3D')]);
  const fullHouse = evaluateSevenCards([c('AH'), c('AD'), c('AC'), c('KH'), c('KD'), c('2S'), c('3C')]);
  const flush = evaluateSevenCards([c('AH'), c('JH'), c('9H'), c('6H'), c('3H'), c('2S'), c('KD')]);

  assert.equal(straightFlush.label, '皇家同花顺');
  assert.equal(fullHouse.label, '葫芦');
  assert.equal(flush.label, '同花');
  assert.equal(straightFlush.score.category > fullHouse.score.category, true);
  assert.equal(fullHouse.score.category > flush.score.category, true);
});

test('ranks players and returns all exact-tie winners', () => {
  const communityCards = [c('AH'), c('KH'), c('QH'), c('JH'), c('10H')];
  const players = [
    { playerId: 'p1', holeCards: [c('2C'), c('3D')] },
    { playerId: 'p2', holeCards: [c('4C'), c('5D')] },
    { playerId: 'p3', holeCards: [c('AS'), c('AD')] },
  ];

  const ranking = rankPlayers(players, communityCards);

  assert.deepEqual(ranking.winnerIds, ['p1', 'p2', 'p3']);
  assert.equal(ranking.rankings.length, 3);
  assert.equal(ranking.rankings.every((entry) => entry.rank === 1), true);
});
