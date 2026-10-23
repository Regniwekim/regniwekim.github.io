import test from 'node:test';
import assert from 'node:assert/strict';
import { LETTER_DISTRIBUTION, createStandardTiles, seedToState, nextRandom,
  shuffleTiles, createBag, replenishRack } from '../src/core/bag.js';

test('standard bag has exactly 100 unique physical tiles, expected multiplicities and two blanks', () => {
  const expected = { A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9,
    J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6,
    U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, '?': 2 };
  assert.deepEqual(LETTER_DISTRIBUTION, expected);
  const tiles = createStandardTiles();
  assert.equal(tiles.length, 100);
  assert.equal(new Set(tiles.map((tile) => tile.id)).size, 100);
  const counts = {};
  for (const tile of tiles) counts[tile.letter ?? '?'] = (counts[tile.letter ?? '?'] ?? 0) + 1;
  assert.deepEqual(counts, expected);
  assert.deepEqual(tiles.filter((tile) => tile.letter === null).map((tile) => tile.id), [98, 99]);
  assert.notEqual(createStandardTiles()[0], tiles[0]);
});

test('numeric and string seeds reproduce entire bags and RNG state; different seeds vary', () => {
  for (const seed of [0, -1, 42.5, Number.MAX_VALUE, '0', 'farm', '🌱', ' farm ']) {
    assert.deepEqual(createBag(seed), createBag(seed));
  }
  assert.notDeepEqual(createBag(42), createBag('42'));
  assert.notDeepEqual(createBag('a').bag, createBag('b').bag);
  assert.notDeepEqual(createBag(0).bag, createBag(1).bag);
});

test('Mulberry32 has a pinned unsigned output vector independent of Node/browser APIs', () => {
  assert.deepEqual(nextRandom(0), { rngState: 1831565813, value: 1144304738 });
  assert.equal(seedToState('farm'), 806770138);
});

test('shuffling frozen tiles conserves all identities without changing inputs', () => {
  const tiles = createStandardTiles().map(Object.freeze);
  Object.freeze(tiles);
  const before = JSON.stringify(tiles);
  const shuffled = shuffleTiles(tiles, seedToState('shuffle'));
  assert.deepEqual(shuffled.bag.map((tile) => tile.id).sort((a, b) => a - b), tiles.map((tile) => tile.id));
  assert.notDeepEqual(shuffled.bag, tiles);
  assert.equal(JSON.stringify(tiles), before);
  assert.deepEqual(shuffleTiles([], 0), { bag: [], rngState: 0 });
});

test('scripted orders must be a complete standard bag permutation', () => {
  const ids = createStandardTiles().map((tile) => tile.id).reverse();
  assert.deepEqual(createBag('qa', ids).bag.map((tile) => tile.id), ids);
  for (const bad of [[], ids.slice(1), [...ids.slice(1), 1], [...ids.slice(1), 100], 'letters']) {
    assert.throws(() => createBag('qa', bad), TypeError);
  }
  const sparse = ids.slice();
  delete sparse[0];
  assert.throws(() => createBag('qa', sparse), TypeError);
});

test('invalid seeds are rejected without coercion', () => {
  for (const seed of ['', '  ', NaN, Infinity, -Infinity, null, undefined, {}, [], true]) {
    assert.throws(() => createBag(seed), TypeError);
  }
});

test('draws cap at seven, handle low/empty bags and preserve physical tile identity', () => {
  const bag = Object.freeze(createStandardTiles());
  const initial = replenishRack(Object.freeze([]), bag);
  assert.equal(initial.rack.length, 7);
  assert.equal(initial.bag.length, 93);
  assert.deepEqual(initial.rack, bag.slice(0, 7));
  assert.deepEqual(replenishRack(initial.rack, initial.bag), initial);
  const partial = replenishRack(Object.freeze([bag[0]]), Object.freeze(bag.slice(1, 3)));
  assert.equal(partial.rack.length, 3);
  assert.deepEqual(partial.bag, []);
  assert.deepEqual(replenishRack(partial.rack, []), partial);
  assert.throws(() => replenishRack(bag.slice(0, 8), []), RangeError);
});
