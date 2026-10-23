import test from 'node:test';
import assert from 'node:assert/strict';
import { createStandardTiles } from '../src/core/bag.js';
import { createSession, evaluateSessionPlacement, commitSessionWord, exchangeTiles,
  endSession, getStrokes } from '../src/core/session.js';
import { createEnclosureSession, createEnclosureBagOrder, ENCLOSURE_MOVES } from '../src/core/session-fixture.js';
import { createDictionary } from '../src/core/dictionary.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { getTerritoryScore, evaluateTerritory } from '../src/core/territory.js';

const move = (word, row = 3, column = 3, orientation = 'horizontal') => ({ word, row, column, orientation });
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function withRack(letters, options = {}) {
  assert.equal(letters.length, 7);
  const remaining = createStandardTiles();
  const prefix = [...letters].map((letter) => {
    const index = remaining.findIndex((tile) => tile.letter === (letter === '?' ? null : letter));
    assert.ok(index >= 0, 'fixture must use real tiles');
    return remaining.splice(index, 1)[0];
  });
  return createSession({ rows: 7, columns: 7, seed: 'test', ...options,
    bagOrder: [...prefix, ...remaining].map((tile) => tile.id) });
}
function conserve(state) {
  const placed = state.puzzle.board.cells.filter((cell) => cell !== null);
  const ids = [...state.rack, ...state.bag].map((tile) => tile.id).concat(placed.map((cell) => cell.tileId));
  assert.deepEqual(ids.sort((a, b) => a - b), createStandardTiles().map((tile) => tile.id));
  for (const cell of placed) {
    const original = createStandardTiles()[cell.tileId];
    assert.equal(cell.blank, original.letter === null);
    if (!cell.blank) assert.equal(cell.letter, original.letter);
  }
}
function rejectedUnchanged(state, action, code, isWord = true) {
  freeze(state);
  const before = JSON.stringify(state);
  const result = action();
  assert.equal(result.accepted, false);
  assert.equal(result.state, state);
  assert.equal((isWord ? result.evaluation.reason : result.reason).code, code);
  assert.equal(JSON.stringify(state), before);
  conserve(state);
  return result;
}
const anyWord = { has: () => true }; // Controlled resource tests, not the browser vocabulary.
function nearEmptyBag(count) {
  let state = createSession({ rows: 1, columns: 200, seed: 'resource-drain' });
  let column = 100;
  while (state.bag.length > count) {
    const length = Math.min(7, state.bag.length - count);
    const word = state.rack.slice(0, length).map((tile) => tile.letter ?? 'A').join('');
    const result = commitSessionWord(freeze(state), move(word, 0, column), anyWord);
    assert.equal(result.accepted, true);
    state = result.state;
    column += length;
    conserve(state);
  }
  return { state, column };
}

test('session starts with seven tiles, 93 in bag, independent puzzle and no stored score or strokes', () => {
  const a = createSession({ seed: 7 });
  const b = createSession({ seed: 7 });
  assert.deepEqual(a, b);
  assert.notEqual(a.rack, b.rack);
  assert.notEqual(a.puzzle.board.cells, b.puzzle.board.cells);
  assert.equal(a.rack.length, 7);
  assert.equal(a.bag.length, 93);
  assert.equal(a.target, 1);
  assert.equal(a.status, 'playing');
  assert.equal(getStrokes(a), 0);
  assert.ok(!Object.hasOwn(a, 'score') && !Object.hasOwn(a, 'strokes'));
  conserve(a);
});

test('invalid targets, seeds and dimensions fail at construction', () => {
  for (const target of [0, -1, 1.2, NaN, Infinity, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createSession({ target }), RangeError);
  }
  for (const seed of ['', ' ', NaN, Infinity, {}, null]) assert.throws(() => createSession({ seed }), TypeError);
  assert.throws(() => createSession({ rows: 0 }), RangeError);
  assert.equal(createSession({ target: 10 }).target, 10);
});

test('repeated preview allocates new letters, lists reused positions, and never spends resources', () => {
  const state = freeze(createEnclosureSession());
  const before = JSON.stringify(state);
  for (let i = 0; i < 10; i += 1) {
    const evaluation = evaluateSessionPlacement(state, ENCLOSURE_MOVES[0], demoDictionary);
    assert.equal(evaluation.legal, true);
    assert.equal(evaluation.rack.allocations.length, 3);
    assert.deepEqual(evaluation.rack.missingLetters, []);
    assert.equal(JSON.stringify(state), before);
  }
});

test('new repeated letters consume distinct physical tiles and replenish exactly that count', () => {
  const state = freeze(withRack('AABCDEF'));
  const result = commitSessionWord(state, move('AA'), createDictionary(['AA']));
  assert.equal(result.accepted, true);
  assert.equal(result.consumedTiles.length, 2);
  assert.equal(new Set(result.consumedTiles.map((tile) => tile.id)).size, 2);
  assert.equal(result.state.rack.length, 7);
  assert.equal(result.state.bag.length, 91);
  assert.equal(result.state.rngState, state.rngState);
  conserve(result.state);
});

test('missing letters and insufficient multiplicity give structured rack reasons', () => {
  for (const [letters, word, missing] of [['CATEFGH', 'CAR', 'R'], ['ABCDEFG', 'AA', 'A']]) {
    const state = withRack(letters);
    const result = rejectedUnchanged(state, () => commitSessionWord(state, move(word), createDictionary([word])), 'MISSING_RACK_LETTERS');
    assert.deepEqual(result.evaluation.reason.missingLetters, [{ letter: missing, count: 1 }]);
    assert.equal(result.points, 0);
    assert.deepEqual(result.newlyClaimed, []);
  }
});

test('exact letters are preferred before blanks and blank assignments stay permanent on reuse', () => {
  const state = freeze(withRack('?ACTEFG'));
  const cat = commitSessionWord(state, move('CAT'), demoDictionary);
  assert.equal(cat.accepted, true);
  assert.ok(cat.state.rack.some((tile) => tile.letter === null));
  assert.ok(cat.evaluation.rack.allocations.every((allocation) => !allocation.blank));
  const blankState = freeze(withRack('?CTEFGH'));
  const result = commitSessionWord(blankState, move('CAT'), demoDictionary);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.evaluation.rack.allocations.filter((a) => a.blank).map((a) => a.letter), ['A']);
  const cell = result.state.puzzle.board.cells[25];
  assert.equal(cell.letter, 'A');
  assert.equal(cell.blank, true);
  assert.equal(cell.tileId, 98);
  const next = commitSessionWord(freeze(result.state), move('AT', 3, 4, 'vertical'), demoDictionary);
  // T was consumed by CAT and canonical refill is A: no new T is available.
  assert.equal(next.accepted, false);
  const reuse = evaluateSessionPlacement(result.state, move('AA', 3, 4, 'vertical'), createDictionary(['AA']));
  assert.equal(reuse.legal, true);
  assert.equal(reuse.reusedPositions.length, 1);
  assert.equal(reuse.rack.allocations.length, 1);
  const accepted = commitSessionWord(result.state, move('AA', 3, 4, 'vertical'), createDictionary(['AA']));
  assert.equal(accepted.state.puzzle.board.cells[25], cell);
  conserve(accepted.state);
});

test('a duplicate requirement can spend one exact A plus a blank; both blanks can be assigned', () => {
  for (const [letters, word, blankLetters] of [['A?BCDEF', 'AA', ['A']], ['??BCDEF', 'CAT', ['A', 'T']]]) {
    const state = freeze(withRack(letters));
    const result = commitSessionWord(state, move(word), createDictionary([word]));
    assert.equal(result.accepted, true);
    assert.deepEqual(result.evaluation.rack.allocations.filter((a) => a.blank).map((a) => a.letter), blankLetters);
    conserve(result.state);
  }
});

test('geometry and dictionary rejection semantics are preserved and entire frozen state is atomic', () => {
  const state = createEnclosureSession();
  for (const [proposal, code] of [[move('ZZZ'), 'UNKNOWN_WORD'], [move('CAR', 0, 0), 'START_SQUARE_REQUIRED'],
    [move('CAR', 3, 6), 'OUT_OF_BOUNDS'], [move('C'), 'FIRST_WORD_TOO_SHORT']]) {
    rejectedUnchanged(state, () => commitSessionWord(state, proposal, demoDictionary), code);
  }
  const after = commitSessionWord(state, ENCLOSURE_MOVES[0], demoDictionary).state;
  for (const [proposal, code] of [[move('CAT'), 'LETTER_CONFLICT'], [move('CAR', 0, 0), 'DISCONNECTED'], [move('CAR'), 'NO_NEW_LETTERS']]) {
    rejectedUnchanged(after, () => commitSessionWord(after, proposal, demoDictionary), code);
  }
  const cross = commitSessionWord(after, move('AT', 2, 4), createDictionary(['AT']));
  assert.equal(cross.accepted, false);
  assert.equal(cross.evaluation.reason.code, 'UNKNOWN_WORD');
  assert.ok(cross.evaluation.reason.words.some((word) => word.orientation === 'vertical'));
  assert.equal(cross.state, after);
});

test('stale previews are never authority after board, rack or dictionary changes', () => {
  const state = freeze(createEnclosureSession());
  assert.equal(evaluateSessionPlacement(state, ENCLOSURE_MOVES[0], demoDictionary).legal, true);
  const exchanged = exchangeTiles(state, state.rack.filter((tile) => tile.letter === 'R').map((tile) => tile.id)).state;
  rejectedUnchanged(exchanged, () => commitSessionWord(exchanged, ENCLOSURE_MOVES[0], demoDictionary), 'MISSING_RACK_LETTERS');
  const played = commitSessionWord(state, ENCLOSURE_MOVES[0], demoDictionary).state;
  rejectedUnchanged(played, () => commitSessionWord(played, ENCLOSURE_MOVES[0], demoDictionary), 'NO_NEW_LETTERS');
  rejectedUnchanged(state, () => commitSessionWord(state, ENCLOSURE_MOVES[0], createDictionary([])), 'UNKNOWN_WORD');
});

test('exceptions in dictionary or claiming cannot publish a partial transition', () => {
  const state = freeze(createEnclosureSession());
  const before = JSON.stringify(state);
  assert.throws(() => commitSessionWord(state, ENCLOSURE_MOVES[0], { has() { throw new Error('unavailable'); } }), /unavailable/);
  assert.equal(JSON.stringify(state), before);
  const badClaims = freeze({ ...state, puzzle: { ...state.puzzle, territory: { rows: 1, columns: 1, claimed: [false] } } });
  const badBefore = JSON.stringify(badClaims);
  assert.throws(() => commitSessionWord(badClaims, ENCLOSURE_MOVES[0], demoDictionary), RangeError);
  assert.equal(JSON.stringify(badClaims), badBefore);
});

test('single/multi exchanges draw first, return all selected identities, preserve board and charge once', () => {
  for (const count of [1, 3, 7]) {
    const state = freeze(createEnclosureSession());
    const ids = state.rack.slice(0, count).map((tile) => tile.id);
    const result = exchangeTiles(state, ids);
    assert.equal(result.accepted, true);
    assert.deepEqual(result.replacements, state.bag.slice(0, count));
    assert.ok(result.replacements.every((tile) => !ids.includes(tile.id)));
    assert.ok(ids.every((id) => result.state.bag.some((tile) => tile.id === id)));
    assert.equal(result.state.bag.length, 93);
    assert.equal(result.state.rack.length, 7);
    assert.equal(result.state.puzzle, state.puzzle);
    assert.equal(result.state.puzzle.wordCount, 0);
    assert.equal(getTerritoryScore(result.state.puzzle.territory), 0);
    assert.equal(result.state.exchangeCount, 1);
    assert.equal(getStrokes(result.state), 1);
    assert.deepEqual(result, exchangeTiles(state, ids));
    assert.deepEqual(result.state, exchangeTiles(state, ids.toReversed()).state);
    conserve(result.state);
  }
});

test('empty, duplicate, foreign and insufficient-bag exchanges are atomic', () => {
  const state = createEnclosureSession();
  for (const ids of [[], null, '0']) rejectedUnchanged(state, () => exchangeTiles(state, ids), 'EMPTY_EXCHANGE', false);
  for (const ids of [[state.rack[0].id, state.rack[0].id], [999], [state.bag[0].id], Array(1)]) {
    rejectedUnchanged(state, () => exchangeTiles(state, ids), 'INVALID_EXCHANGE_TILES', false);
  }
  const { state: low } = nearEmptyBag(1);
  rejectedUnchanged(low, () => exchangeTiles(low, low.rack.slice(0, 2).map((tile) => tile.id)), 'INSUFFICIENT_BAG', false);
  const result = exchangeTiles(low, [low.rack[0].id]);
  assert.equal(result.accepted, true);
  assert.equal(result.state.bag.length, 1);
  assert.equal(result.state.bag[0].id, low.rack[0].id);
  assert.equal(result.state.rack[0].id, low.bag[0].id);
  conserve(result.state);
});

test('exchanging after a scored word preserves claims and words while adding exactly one stroke', () => {
  let state = { ...createEnclosureSession(), target: 2 };
  for (const proposal of ENCLOSURE_MOVES) state = commitSessionWord(state, proposal, demoDictionary).state;
  freeze(state);
  const result = exchangeTiles(state, state.rack.slice(0, 2).map((tile) => tile.id));
  assert.equal(result.accepted, true);
  assert.equal(result.state.puzzle, state.puzzle);
  assert.equal(getTerritoryScore(result.state.puzzle.territory), 1);
  assert.equal(result.state.puzzle.wordCount, 4);
  assert.equal(result.state.exchangeCount, 1);
  assert.equal(getStrokes(result.state), 5);
  assert.equal(result.state.status, 'playing');
  conserve(result.state);
});

test('last refill may be partial; empty bag alone is not failure, empty rack plus bag is exhaustion', () => {
  const { state, column } = nearEmptyBag(1);
  const word = state.rack.slice(0, 3).map((tile) => tile.letter ?? 'A').join('');
  const result = commitSessionWord(freeze(state), move(word, 0, column), anyWord);
  assert.equal(result.accepted, true);
  assert.equal(result.state.bag.length, 0);
  assert.equal(result.state.rack.length, 5);
  assert.equal(result.state.status, 'playing');
  conserve(result.state);
  rejectedUnchanged(result.state, () => exchangeTiles(result.state, [result.state.rack[0].id]), 'INSUFFICIENT_BAG', false);
  const rest = result.state.rack.map((tile) => tile.letter ?? 'A').join('');
  const final = commitSessionWord(result.state, move(rest, 0, column + 3), anyWord);
  assert.equal(final.state.status, 'exhausted');
  assert.equal(final.state.rack.length, 0);
  assert.equal(final.state.bag.length, 0);
  conserve(final.state);
  rejectedUnchanged(final.state, () => commitSessionWord(final.state, move('A', 0, 199), anyWord), 'RUN_FINISHED');
});

test('scripted standard bag fixture wins only on fourth accepted word and consumes 3/2/2/1 tiles', () => {
  assert.equal(createEnclosureBagOrder().length, 100);
  let state = createEnclosureSession();
  assert.equal(state.rack.map((tile) => tile.letter).join(''), 'CARABTA');
  assert.equal(state.source, 'scripted');
  for (const [i, proposal] of ENCLOSURE_MOVES.entries()) {
    freeze(state);
    const evaluation = evaluateSessionPlacement(state, proposal, demoDictionary);
    assert.equal(evaluation.legal, true);
    assert.equal(evaluation.rack.allocations.length, [3, 2, 2, 1][i]);
    assert.equal(evaluation.reusedPositions.length, [0, 1, 1, 2][i]);
    assert.equal(evaluateTerritory(evaluation.proposedBoard, state.puzzle.territory).points, i === 3 ? 1 : 0);
    assert.equal(getTerritoryScore(state.puzzle.territory), 0);
    const result = commitSessionWord(state, proposal, demoDictionary);
    assert.equal(result.accepted, true);
    assert.equal(result.state.rack.length, 7);
    assert.equal(state.bag.length - result.state.bag.length, [3, 2, 2, 1][i]);
    assert.deepEqual(result.newlyClaimed, i === 3 ? [32] : []);
    assert.equal(result.state.status, i === 3 ? 'won' : 'playing');
    assert.equal(result.state.puzzle.wordCount, i + 1);
    assert.equal(result.state.exchangeCount, 0);
    assert.equal(getStrokes(result.state), i + 1);
    state = result.state;
    conserve(state);
  }
  assert.equal(getTerritoryScore(state.puzzle.territory), 1);
  assert.equal(state.puzzle.board.cells[32], null);
  rejectedUnchanged(state, () => commitSessionWord(state, move('S', 3, 6), demoDictionary), 'RUN_FINISHED');
  rejectedUnchanged(state, () => exchangeTiles(state, [state.rack[0].id]), 'RUN_FINISHED', false);
  rejectedUnchanged(state, () => endSession(state), 'RUN_FINISHED', false);
  const restart = ENCLOSURE_MOVES.reduce((s, proposal) => commitSessionWord(s, proposal, demoDictionary).state, createEnclosureSession());
  assert.deepEqual(state, restart);
});

test('unknown closing word cannot win or change claims; configurable higher target remains playing', () => {
  let state = createEnclosureSession();
  for (const proposal of ENCLOSURE_MOVES.slice(0, 3)) state = commitSessionWord(state, proposal, demoDictionary).state;
  const dictionary = createDictionary(['CAR', 'CAB', 'RAT']);
  rejectedUnchanged(state, () => commitSessionWord(state, ENCLOSURE_MOVES[3], dictionary), 'UNKNOWN_WORD');
  const higher = { ...state, target: 2 };
  const result = commitSessionWord(freeze(higher), ENCLOSURE_MOVES[3], demoDictionary);
  assert.equal(result.state.status, 'playing');
  assert.equal(getTerritoryScore(result.state.puzzle.territory), 1);
});

test('explicitly ending an unfinished run preserves resources/counters and blocks future actions', () => {
  const state = freeze(createEnclosureSession());
  const ended = endSession(state);
  assert.equal(ended.accepted, true);
  assert.deepEqual(ended.state, { ...state, status: 'ended' });
  rejectedUnchanged(ended.state, () => commitSessionWord(ended.state, ENCLOSURE_MOVES[0], demoDictionary), 'RUN_FINISHED');
  rejectedUnchanged(ended.state, () => exchangeTiles(ended.state, [ended.state.rack[0].id]), 'RUN_FINISHED', false);
});

test('same seeded actions reproduce placements, exchanges and RNG; independent restarts stay untouched', () => {
  function replay() {
    let state = createSession({ seed: 'repeat', rows: 7, columns: 7 });
    const word = state.rack.slice(0, 3).map((tile) => tile.letter ?? 'A').join('');
    state = commitSessionWord(state, move(word), anyWord).state;
    state = exchangeTiles(state, state.rack.slice(0, 2).map((tile) => tile.id)).state;
    state = exchangeTiles(state, [state.rack[0].id]).state;
    assert.equal(state.puzzle.wordCount, 1);
    assert.equal(state.exchangeCount, 2);
    assert.equal(getStrokes(state), 3);
    conserve(state);
    return state;
  }
  const untouched = createSession({ seed: 'repeat', rows: 7, columns: 7 });
  assert.deepEqual(replay(), replay());
  assert.deepEqual(untouched, createSession({ seed: 'repeat', rows: 7, columns: 7 }));
});
