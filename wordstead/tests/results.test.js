import test from 'node:test';
import assert from 'node:assert/strict';
import { getSessionResults, formatResultsShare } from '../src/core/results.js';
import { createSession, commitSessionWord, evaluateSessionPlacement, endSession, exchangeTiles } from '../src/core/session.js';
import { createEnclosureSession, ENCLOSURE_MOVES } from '../src/core/session-fixture.js';
import { createFarmSession } from '../src/core/farm-fixture.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { getPuzzleScore, placeFeature } from '../src/core/features.js';
import { claimTerritory, createTerritory, evaluateTerritory } from '../src/core/territory.js';
import { boardFromDiagram } from './fixtures.js';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function finish(state = createEnclosureSession(), moves = ENCLOSURE_MOVES) {
  for (const move of moves) {
    const result = commitSessionWord(freeze(state), move, demoDictionary);
    assert.equal(result.accepted, true);
    state = result.state;
  }
  return state;
}

test('actual enclosure victory derives every statistic with zero captured features', () => {
  const state = finish();
  assert.deepEqual(getSessionResults(state), {
    status: 'won', totalPoints: 1, basePoints: 1, cropPoints: 0, fertilityPoints: 0, bonusPoints: 0,
    target: 1, wordCount: 4, exchangeCount: 0, freeExchangesUsed: 0, chargedExchanges: 0, strokes: 4,
    captured: { crops: 0, fertile: 0, livestock: 0, buildings: 0 }, board: { rows: 7, columns: 7 },
  });
});

test('playing sessions and target-reaching previews never produce final results', () => {
  const state = finish(createEnclosureSession(), ENCLOSURE_MOVES.slice(0, 3));
  const preview = evaluateSessionPlacement(state, ENCLOSURE_MOVES[3], demoDictionary);
  assert.equal(preview.legal, true);
  assert.equal(evaluateTerritory(preview.proposedBoard, state.puzzle.territory).points, state.target);
  assert.equal(getSessionResults(freeze(state)), null);
  assert.equal(getSessionResults(createSession()), null);
});

test('ending a partial run retains actual points, counters and unfinished status', () => {
  const state = finish(createEnclosureSession(), ENCLOSURE_MOVES.slice(0, 2));
  const ended = endSession(freeze(state)).state;
  const results = getSessionResults(ended);
  assert.equal(results.status, 'ended');
  assert.equal(results.totalPoints, 0);
  assert.equal(results.target, 1);
  assert.equal(results.wordCount, 2);
  assert.equal(results.strokes, 2);
});

for (const [type, points, crops, fertile] of [['crop', 4, 1, 0], ['fertile', 2, 0, 1]]) {
  test(`${type} fixture uses captured bonus and its original victory target`, () => {
    const results = getSessionResults(finish(createFarmSession(type)));
    assert.equal(results.status, 'won');
    assert.equal(results.totalPoints, points);
    assert.equal(results.target, points);
    assert.equal(results.basePoints, 1);
    assert.equal(results.cropPoints, crops * 3);
    assert.equal(results.fertilityPoints, fertile);
    assert.equal(results.bonusPoints, points - 1);
    assert.equal(results.captured.crops, crops);
    assert.equal(results.captured.fertile, fertile);
  });
}

test('livestock/buildings count as captures; free and charged exchanges remain distinct', () => {
  const livestock = getSessionResults(endSession(finish(createFarmSession('livestock'))).state);
  assert.equal(livestock.captured.livestock, 1);
  assert.equal(livestock.totalPoints, 1);
  let state = finish(createFarmSession('building'));
  state = exchangeTiles(freeze(state), [state.rack[0].id]).state;
  state = exchangeTiles(freeze(state), [state.rack[1].id]).state;
  const results = getSessionResults(endSession(freeze(state)).state);
  assert.equal(results.exchangeCount, 2);
  assert.equal(results.freeExchangesUsed, 1);
  assert.equal(results.chargedExchanges, 1);
  assert.equal(results.strokes, 5);
  assert.equal(results.captured.buildings, 1);
  assert.equal(results.bonusPoints, 0);
  assert.match(formatResultsShare(results), /4 words · 2 exchanges · 5 strokes/);
});

test('multiple feature captures derive from claims; uncaptured features are excluded', () => {
  let board = boardFromDiagram(['#######', '#.....#', '#.....#', '#######']);
  for (const [row, column, type] of [[1, 1, 'crop'], [1, 2, 'crop'], [1, 3, 'fertile'],
    [1, 4, 'livestock'], [1, 5, 'building'], [2, 1, 'building']]) {
    board = placeFeature(board, row, column, type);
  }
  // One exterior feature provides an explicit negative capture case.
  board = { ...board, cells: [null, ...board.cells.slice(1)] };
  board = placeFeature(board, 0, 0, 'crop');
  const territory = claimTerritory(board, createTerritory(board)).territory;
  const state = { ...createSession({ rows: 4, columns: 7 }), status: 'ended',
    puzzle: { board, territory, wordCount: 0 } };
  const results = getSessionResults(freeze(state));
  assert.deepEqual(results.captured, { crops: 2, fertile: 1, livestock: 1, buildings: 2 });
  assert.deepEqual(results.board, { rows: 4, columns: 7 });
  assert.equal(results.basePoints, 10);
  assert.equal(results.cropPoints, 6);
  assert.equal(results.fertilityPoints, 1);
  assert.equal(results.bonusPoints, 7);
  assert.equal(results.totalPoints, 17);
  assert.deepEqual(getPuzzleScore(state.puzzle), { basePoints: 10, cropPoints: 6,
    fertilityPoints: 1, bonusPoints: 7, totalPoints: 17 });
});

test('definitive exhaustion follows the existing finite-bag transition, not a no-moves guess', () => {
  let state = createSession({ rows: 1, columns: 200, seed: 'results-drain' });
  let column = 100;
  while (state.status === 'playing') {
    const word = state.rack.map((tile) => tile.letter ?? 'A').join('');
    const next = commitSessionWord(freeze(state), { word, row: 0, column, orientation: 'horizontal' }, { has: () => true });
    assert.equal(next.accepted, true);
    column += word.length;
    state = next.state;
    if (state.status === 'playing') assert.equal(getSessionResults(state), null);
  }
  assert.equal(state.status, 'exhausted');
  const results = getSessionResults(state);
  assert.equal(results.wordCount, 15);
  assert.equal(results.strokes, 15);
  assert.equal(results.totalPoints, 0);
  assert.match(formatResultsShare(results), /^WORDSTEAD\nOut of Tiles\n/);
});

test('results and formatting are deterministic, deeply immutable and detached from the session', () => {
  const state = freeze(finish(createFarmSession('crop')));
  const before = JSON.stringify(state);
  const first = getSessionResults(state);
  const second = getSessionResults(state);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.ok(Object.isFrozen(first) && Object.isFrozen(first.captured) && Object.isFrozen(first.board));
  assert.throws(() => { first.captured.crops = 10; }, TypeError);
  assert.equal(formatResultsShare(first), formatResultsShare(second));
  assert.equal(JSON.stringify(state), before);
});

test('share text pins accurate values, plain-text newlines, URL and spoiler exclusion', () => {
  const text = formatResultsShare(getSessionResults(finish(createFarmSession('crop'))));
  assert.equal(text, 'WORDSTEAD\nHarvest Complete!\n\n4/4 farm points\n4 words · 0 exchanges · 4 strokes\n1 territory + 3 farm bonus points\n\nBuild a farm, one word at a time.\nhttps://games.regniwekim.com/wordstead/');
  assert.doesNotMatch(text, /CAR|CAB|RAT|BAT|enclosure-qa|tileId|undefined|null|\r/);
  const fertile = formatResultsShare(getSessionResults(finish(createFarmSession('fertile'))));
  assert.match(fertile, /1 territory \+ 1 farm bonus point\n/);
});

test('unfinished headings, zero statistics and singular counts are unambiguous', () => {
  const ended = getSessionResults(endSession(createSession()).state);
  assert.match(formatResultsShare(ended), /^WORDSTEAD\nFarm Unfinished\n\n0\/1 farm points\n0 words · 0 exchanges · 0 strokes/);
  const exchanged = exchangeTiles(createSession(), [createSession().rack[0].id]).state;
  assert.match(formatResultsShare(getSessionResults(endSession(exchanged).state)), /0 words · 1 exchange · 1 stroke/);
  assert.throws(() => formatResultsShare(null), TypeError);
});

test('restart/new construction removes results and terminal sessions reject all gameplay mutations', () => {
  for (const state of [finish(), endSession(createSession()).state]) {
    freeze(state);
    const before = JSON.stringify(state);
    getSessionResults(state);
    formatResultsShare(getSessionResults(state));
    const word = commitSessionWord(state, ENCLOSURE_MOVES[0], demoDictionary);
    assert.equal(word.accepted, false);
    assert.equal(word.state, state);
    assert.equal(exchangeTiles(state, [state.rack[0].id]).state, state);
    assert.equal(endSession(state).state, state);
    assert.equal(JSON.stringify(state), before);
  }
  assert.equal(getSessionResults(createEnclosureSession()), null);
  assert.equal(getSessionResults(createSession({ seed: 'new puzzle' })), null);
});
