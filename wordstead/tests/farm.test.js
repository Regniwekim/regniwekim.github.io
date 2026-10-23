import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../src/core/board.js';
import { isLetterCell, createLetterCell } from '../src/core/letters.js';
import { analyzeEnclosure } from '../src/core/enclosure.js';
import { createTerritory, claimTerritory, evaluateTerritory, getTerritoryScore } from '../src/core/territory.js';
import { FEATURE_TYPES, createFeatureCell, isFeatureCell, placeFeature, getPuzzleScore, summarizeFeatures } from '../src/core/features.js';
import { generateFarm } from '../src/core/farm-layout.js';
import { getStartingSquare, evaluatePlacement } from '../src/core/placement.js';
import { createSession, commitSessionWord, evaluateSessionPlacement, exchangeTiles, getStrokes,
  getRackCapacity, getExchangeCredits, getChargedExchanges } from '../src/core/session.js';
import { createDraft, placeDraftTile, commitSessionDraft, evaluateDraft } from '../src/core/draft.js';
import { createStandardTiles, replenishRack } from '../src/core/bag.js';
import { createFarmSession } from '../src/core/farm-fixture.js';
import { createEnclosureSession, ENCLOSURE_MOVES } from '../src/core/session-fixture.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const anyWord = { has: () => true }; // Controlled geometry/resource tests only.
function conserve(state) {
  const letters = state.puzzle.board.cells.filter(isLetterCell);
  const ids = [...state.rack, ...state.bag].map((tile) => tile.id).concat(letters.map((cell) => cell.tileId));
  assert.deepEqual(ids.sort((a, b) => a - b), createStandardTiles().map((tile) => tile.id));
  for (const cell of letters) {
    const tile = createStandardTiles()[cell.tileId];
    assert.equal(cell.blank, tile.letter === null);
    if (!cell.blank) assert.equal(cell.letter, tile.letter);
  }
}
function playDraft(state, proposal, dictionary = demoDictionary) {
  const ev = evaluateSessionPlacement(state, proposal, dictionary);
  assert.equal(ev.legal, true, ev.reason?.message);
  let draft = createDraft();
  for (const { tile, row, column, letter } of ev.rack.allocations) {
    const result = placeDraftTile(state, draft, { tileId: tile.id, row, column,
      assignedLetter: tile.letter === null ? letter : undefined });
    assert.equal(result.accepted, true);
    draft = result.draft;
  }
  return { draft, result: commitSessionDraft(freeze(state), freeze(draft), dictionary) };
}
function finishFixture(type, options = {}) {
  let state = { ...createFarmSession(type), ...options };
  let result;
  for (const proposal of ENCLOSURE_MOVES) {
    ({ result } = playDraft(state, proposal));
    assert.equal(result.accepted, true);
    state = result.state;
    conserve(state);
  }
  return result;
}

// Prepared geometry uses real physical tiles, removing each from the finite bag.
function prepared(lines, features) {
  const state = createSession({ rows: lines.length, columns: lines[0].length, seed: 'prepared', target: 100 });
  const remaining = createStandardTiles();
  let board = state.puzzle.board;
  board = { ...board, cells: lines.join('').split('').map((symbol) => {
    if (symbol !== '#') return null;
    const tile = remaining.shift();
    return { ...createLetterCell(tile.letter ?? 'A'), tileId: tile.id, blank: tile.letter === null };
  }) };
  for (const [row, column, type] of features) board = placeFeature(board, row, column, type);
  const rack = remaining.splice(0, 7);
  return { ...state, rack, bag: remaining, puzzle: { ...state.puzzle, board } };
}
function close(state, row, column) {
  const tile = state.rack[0];
  const drop = placeDraftTile(state, createDraft(), { tileId: tile.id, row, column, assignedLetter: 'A' });
  assert.equal(drop.accepted, true);
  const result = commitSessionDraft(freeze(state), freeze(drop.draft), anyWord);
  assert.equal(result.accepted, true);
  conserve(result.state);
  return result;
}

test('four explicit feature types validate and remain non-letter land', () => {
  for (const type of Object.keys(FEATURE_TYPES)) {
    const feature = createFeatureCell(type);
    assert.deepEqual(feature, { kind: 'feature', type });
    assert.equal(isFeatureCell(feature), true);
    assert.equal(isLetterCell(feature), false);
    assert.equal(isLetterCell({ ...feature, letter: 'A' }), false);
  }
  for (const type of ['tree', '', 'toString', null, undefined, 42, ['crop'], { toString: () => 'crop' }]) assert.throws(() => createFeatureCell(type), TypeError);
  for (const cell of [null, {}, { kind: 'feature', type: 'tree' }, createLetterCell('A')]) assert.equal(isFeatureCell(cell), false);
});

test('immutable rectangular feature placement validates boundaries and occupancy', () => {
  const board = freeze(createBoard({ rows: 3, columns: 9 }));
  const next = placeFeature(board, 1, 7, 'building');
  assert.equal(board.cells[16], null);
  assert.equal(next.cells[16].type, 'building');
  assert.throws(() => placeFeature(next, 1, 7, 'crop'), RangeError);
  assert.throws(() => placeFeature(board, 3, 0, 'crop'), RangeError);
  assert.throws(() => placeFeature(board, 0, 9, 'crop'), RangeError);
});

test('farm metadata never blocks exterior traversal or becomes a fence', () => {
  let board = createBoard({ rows: 5, columns: 7 });
  for (let column = 0; column < 7; column += 1) board = placeFeature(board, 2, column, 'crop');
  assert.equal(analyzeEnclosure(freeze(board)).exterior.length, 35);
  assert.deepEqual(analyzeEnclosure(board).enclosed, []);
  assert.equal(claimTerritory(board, createTerritory(board)).points, 0);
});

test('draft and typed word placement cannot overwrite a farm cell, captured or otherwise', () => {
  for (const captured of [false, true]) {
    const state = createFarmSession('crop');
    state.puzzle.territory.claimed[32] = captured;
    const before = JSON.stringify(state);
    freeze(state);
    const drop = placeDraftTile(state, createDraft(), { tileId: state.rack[0].id, row: 4, column: 4 });
    assert.equal(drop.accepted, false);
    assert.equal(drop.reason.code, 'CELL_OCCUPIED');
    const proposal = { word: 'CAR', row: 4, column: 3, orientation: 'horizontal' };
    assert.equal(evaluatePlacement(state.puzzle.board, proposal, demoDictionary).reason.code, 'CELL_OCCUPIED');
    const result = commitSessionWord(state, proposal, demoDictionary);
    assert.equal(result.state, state);
    assert.equal(JSON.stringify(state), before);
  }
});

for (const [type, bonus, score, capacity] of [['crop', 3, 4, 7], ['fertile', 1, 2, 7], ['livestock', 0, 1, 8], ['building', 0, 1, 7]]) {
  test(`${type}: four-word physical draft fixture captures once with atomic reward and refill`, () => {
    let state = createFarmSession(type);
    const feature = state.puzzle.board.cells[32];
    for (const [index, proposal] of ENCLOSURE_MOVES.entries()) {
      const before = JSON.stringify(state);
      const { draft, result } = playDraft(state, proposal);
      for (let i = 0; i < 3; i += 1) {
        const preview = evaluateDraft(state, draft, demoDictionary);
        assert.equal(preview.legal, true);
        assert.equal(evaluateTerritory(preview.proposedBoard, state.puzzle.territory).points, index === 3 ? 1 : 0);
        assert.equal(JSON.stringify(state), before);
        assert.equal(getPuzzleScore(state.puzzle).totalPoints, 0);
        assert.equal(getRackCapacity(state), 7);
        assert.equal(getExchangeCredits(state), 0);
      }
      assert.equal(result.accepted, true);
      assert.equal(JSON.stringify(state), before);
      assert.deepEqual(result.newlyClaimed, index === 3 ? [32] : []);
      assert.equal(result.points, index === 3 ? score : 0);
      assert.equal(result.farmRewards.bonusPoints, index === 3 ? bonus : 0);
      assert.equal(result.state.puzzle.board.cells[32], feature);
      state = result.state;
      conserve(state);
    }
    assert.equal(getTerritoryScore(state.puzzle.territory), 1);
    assert.equal(getPuzzleScore(state.puzzle).totalPoints, score);
    assert.equal(getRackCapacity(state), capacity);
    assert.equal(state.rack.length, capacity);
    assert.equal(state.bag.length, type === 'livestock' ? 84 : 85);
    assert.equal(state.status, type === 'crop' || type === 'fertile' ? 'won' : 'playing');
    assert.equal(getExchangeCredits(state), Number(type === 'building'));
    const again = claimTerritory(state.puzzle.board, state.puzzle.territory);
    assert.equal(again.points, 0);
    assert.deepEqual(summarizeFeatures(state.puzzle.board, again.newlyClaimed).features, []);
    assert.equal(getPuzzleScore({ ...state.puzzle, territory: again.territory }).totalPoints, score);
  });
}

test('invalid dictionary, stale allocation and thrown errors cannot activate closing farm effects', () => {
  for (const type of Object.keys(FEATURE_TYPES)) {
    let state = createFarmSession(type);
    for (const proposal of ENCLOSURE_MOVES.slice(0, 3)) state = playDraft(state, proposal).result.state;
    const before = JSON.stringify(state);
    const { draft } = playDraft(state, ENCLOSURE_MOVES[3]);
    freeze(state);
    const result = commitSessionDraft(state, draft, { has: () => false });
    assert.equal(result.state, state); assert.equal(result.draft, draft); assert.equal(result.points, 0);
    assert.throws(() => commitSessionDraft(state, draft, { has() { throw Error('dictionary offline'); } }), /offline/);
    const stale = { tiles: draft.tiles.map((tile) => ({ ...tile, tileId: 999 })) };
    assert.equal(commitSessionDraft(state, stale, demoDictionary).state, state);
    assert.equal(JSON.stringify(state), before);
    assert.equal(getPuzzleScore(state.puzzle).totalPoints, 0);
    assert.equal(getRackCapacity(state), 7);
    assert.equal(getExchangeCredits(state), 0);
    conserve(state);
  }
});

test('mixed enclosure: three ordinary cells, crop and fertile give 5 base + 3 crop + 1 fertile = 9', () => {
  const state = prepared(['.........', '.##.####.', '.#.....#.', '.#######.', '.........'], [[2, 3, 'crop'], [2, 4, 'fertile']]);
  const before = JSON.stringify(state);
  const result = close(state, 1, 3);
  assert.equal(JSON.stringify(state), before);
  assert.equal(result.points, 9);
  assert.equal(result.basePoints, 5);
  assert.equal(result.farmRewards.features.length, 2);
  assert.deepEqual(getPuzzleScore(result.state.puzzle), { basePoints: 5, cropPoints: 3, fertilityPoints: 1, bonusPoints: 4, totalPoints: 9 });
  const repeated = claimTerritory(result.state.puzzle.board, result.state.puzzle.territory);
  assert.equal(repeated.points, 0);
  assert.deepEqual(repeated.newlyClaimed, []);
  assert.equal(getPuzzleScore(result.state.puzzle).totalPoints, 9);
});

test('independent enclosures preserve historical captures and award only the next feature', () => {
  let state = prepared(['...........', '.#.#...#.#.', '.#.#...#.#.', '.###...###.', '...........'], [[2, 2, 'crop'], [2, 8, 'fertile']]);
  const a = close(state, 1, 2);
  assert.equal(a.points, 4);
  assert.equal(a.state.puzzle.territory.claimed[24], true);
  assert.equal(a.state.puzzle.territory.claimed[30], false);
  state = a.state;
  const b = close(state, 1, 8);
  assert.equal(b.points, 2);
  assert.equal(b.farmRewards.features.length, 1);
  assert.equal(getPuzzleScore(b.state.puzzle).totalPoints, 6);
  assert.equal(b.state.puzzle.territory.claimed[24], true);
});

test('utility rewards apply together, livestock cap at nine, and additional livestock still score base', () => {
  const features = [[2, 2, 'livestock'], [2, 3, 'livestock'], [2, 4, 'livestock'], [2, 5, 'building'], [2, 6, 'building']];
  const state = prepared(['.........', '.##.####.', '.#.....#.', '.#######.', '.........'], features);
  const result = close(state, 1, 3);
  assert.equal(result.points, 5);
  assert.equal(result.farmRewards.livestock, 3);
  assert.equal(result.farmRewards.rackCapacityGained, 2);
  assert.equal(getRackCapacity(result.state), 9);
  assert.equal(result.state.rack.length, 9);
  assert.equal(getExchangeCredits(result.state), 2);
  let next = result.state;
  for (const expected of [1, 0, 0]) {
    const before = getStrokes(next);
    const exchanged = exchangeTiles(freeze(next), [next.rack[0].id]);
    assert.equal(exchanged.accepted, true);
    assert.equal(getExchangeCredits(exchanged.state), expected);
    assert.equal(getStrokes(exchanged.state), before + Number(!exchanged.freeExchange));
    next = exchanged.state;
    conserve(next);
  }
  assert.equal(next.exchangeCount, 3);
  assert.equal(next.freeExchangesUsed, 2);
  assert.equal(getChargedExchanges(next), 1);
  assert.equal(getStrokes(next), next.puzzle.wordCount + 1);
});

test('capacity persists into subsequent words and does not fabricate tiles on partial or empty refill', () => {
  let state = finishFixture('livestock').state;
  const beforeBag = state.bag.length;
  const result = close(state, 3, 6); // Extends CAR with a real rack letter, controlled membership.
  assert.equal(getRackCapacity(result.state), 8);
  assert.equal(result.state.rack.length, 8);
  assert.equal(result.state.bag.length, beforeBag - 1);
  for (const count of [0, 1]) {
    // Drain real resources into an exterior row, leaving the closing tile in rack.
    let low = createFarmSession('livestock');
    for (const move of ENCLOSURE_MOVES.slice(0, 3)) low = playDraft(low, move).result.state;
    const closing = low.rack.find((tile) => tile.letter === 'A');
    const available = [...low.rack, ...low.bag].filter((tile) => tile.id !== closing.id);
    const bag = available.splice(0, count);
    const old = low.puzzle.board;
    const board = createBoard({ rows: old.rows + 1, columns: Math.max(100, old.columns) });
    for (let row = 0; row < old.rows; row += 1) for (let column = 0; column < old.columns; column += 1) {
      board.cells[row * board.columns + column] = old.cells[row * old.columns + column];
    }
    available.forEach((tile, column) => { board.cells[7 * board.columns + column] = {
      ...createLetterCell(tile.letter ?? 'A'), tileId: tile.id, blank: tile.letter === null };
    });
    low = { ...low, rack: [closing], bag, puzzle: { ...low.puzzle, board, territory: createTerritory(board) } };
    const capture = close(low, 5, 4);
    assert.equal(getRackCapacity(capture.state), 8);
    assert.equal(capture.state.rack.length, count);
    assert.equal(capture.state.bag.length, 0);
    assert.equal(capture.state.status, count ? 'playing' : 'exhausted');
    conserve(capture.state);
  }
});

test('building credit survives failed exchanges, is spent once on success and preserves original exchange count', () => {
  const state = freeze(finishFixture('building').state);
  const before = JSON.stringify(state);
  for (const ids of [[], [999], [state.rack[0].id, state.rack[0].id]]) {
    assert.equal(exchangeTiles(state, ids).state, state);
    assert.equal(getExchangeCredits(state), 1);
  }
  const noBag = freeze({ ...state, bag: [] });
  const failed = exchangeTiles(noBag, [state.rack[0].id]);
  assert.equal(failed.state, noBag);
  assert.equal(failed.reason.code, 'INSUFFICIENT_BAG');
  assert.equal(getExchangeCredits(noBag), 1);
  const free = exchangeTiles(state, [state.rack[0].id]);
  assert.equal(free.state.exchangeCount, 1);
  assert.equal(getStrokes(free.state), 4);
  assert.equal(getExchangeCredits(free.state), 0);
  const charged = exchangeTiles(free.state, [free.state.rack[0].id]);
  assert.equal(charged.state.exchangeCount, 2);
  assert.equal(getStrokes(charged.state), 5);
  assert.equal(getChargedExchanges(charged.state), 1);
  assert.equal(JSON.stringify(state), before);
  conserve(charged.state);
});

test('default seven-slot draw remains unchanged; explicit eight/nine draws are finite and validate overflow', () => {
  const tiles = createStandardTiles();
  assert.equal(getRackCapacity(createSession()), 7);
  for (const capacity of [7, 8, 9]) {
    const result = replenishRack([], freeze(tiles), capacity);
    assert.equal(result.rack.length, capacity);
    assert.deepEqual([...result.rack, ...result.bag], tiles);
    assert.equal(replenishRack([], tiles.slice(0, 3), capacity).rack.length, 3);
  }
  for (const capacity of [6, 10, 8.5, null]) assert.throws(() => replenishRack([], tiles, capacity), RangeError);
  assert.throws(() => replenishRack(tiles.slice(0, 9), [], 8), RangeError);
});

test('farm layouts reproduce across rectangular boards, protect perimeter/start neighbors, and never overlap', () => {
  for (const [rows, columns] of [[15, 15], [6, 20], [20, 6], [1, 1], [2, 8], [8, 2], [3, 3], [3, 4]]) {
    const board = freeze(createBoard({ rows, columns }));
    const a = generateFarm(board, { seed: 'farm', density: 0.25 });
    assert.deepEqual(a, generateFarm(board, { seed: 'farm', density: 0.25 }));
    const start = getStartingSquare(board);
    for (let index = 0; index < board.cells.length; index += 1) {
      assert.equal(board.cells[index], null);
      if (!a.cells[index]) continue;
      const row = Math.floor(index / columns); const column = index % columns;
      assert.ok(row > 0 && row < rows - 1 && column > 0 && column < columns - 1);
      assert.ok(Math.abs(start.row - row) + Math.abs(start.column - column) > 1);
      assert.ok(isFeatureCell(a.cells[index]));
    }
    if (rows <= 2 || columns <= 2 || rows === 3 && columns === 3) assert.ok(a.cells.every((cell) => cell === null));
  }
});

test('density and weights control exact count and distribution; invalid settings reject', () => {
  const board = createBoard(); // 169 interior cells minus protected cross of five.
  for (const density of [0, 0.08, 0.25, 1]) {
    assert.equal(generateFarm(board, { density }).cells.filter(isFeatureCell).length, Math.floor(164 * density));
  }
  const weights = { crop: 0, livestock: 0, building: 1, fertile: 0 };
  assert.ok(generateFarm(board, { weights }).cells.filter(isFeatureCell).every((cell) => cell.type === 'building'));
  const types = new Set();
  for (let seed = 0; seed < 30; seed += 1) generateFarm(board, { seed }).cells.filter(isFeatureCell).forEach((cell) => types.add(cell.type));
  assert.deepEqual([...types].sort(), Object.keys(FEATURE_TYPES).sort());
  assert.notDeepEqual(generateFarm(board, { seed: 'one' }), generateFarm(board, { seed: 'two' }));
  for (const density of [-1, 1.1, NaN, '0.1']) assert.throws(() => generateFarm(board, { density }), RangeError);
  for (const weights of [null, {}, { ...FEATURE_TYPES }, { crop: 0, livestock: 0, building: 0, fertile: 0 },
    { crop: -1, livestock: 1, building: 1, fertile: 1 }, { crop: Infinity, livestock: 1, building: 1, fertile: 1 }]) {
    assert.throws(() => generateFarm(board, { weights }));
  }
  assert.throws(() => generateFarm(board, { seed: '' }), TypeError);
});

test('layout generation preserves occupied cells, and complete sessions are reproducible without letter RNG coupling', () => {
  const occupied = placeFeature(createBoard(), 1, 1, 'building');
  assert.equal(generateFarm(freeze(occupied), { density: 1 }).cells[16], occupied.cells[16]);
  const config = { rows: 11, columns: 19, seed: 'letters', farmSeed: 'farm-A', farmDensity: 0.1, target: 25 };
  const a = freeze(createSession(config));
  assert.deepEqual(a, createSession(config));
  const b = createSession({ ...config, farmSeed: 'farm-B', farmDensity: 0.2 });
  const c = createSession({ ...config, farmSeed: null });
  for (const other of [b, c]) {
    assert.deepEqual(a.rack, other.rack); assert.deepEqual(a.bag, other.bag); assert.equal(a.rngState, other.rngState);
    const exchangedA = exchangeTiles(a, [a.rack[0].id]).state;
    const exchangedB = exchangeTiles(other, [other.rack[0].id]).state;
    assert.deepEqual(exchangedA.rack, exchangedB.rack); assert.deepEqual(exchangedA.bag, exchangedB.bag);
    assert.equal(exchangedA.rngState, exchangedB.rngState);
  }
  assert.notDeepEqual(a.puzzle.board, b.puzzle.board);
  const differentLetters = createSession({ ...config, seed: 'different-letters' });
  assert.deepEqual(a.puzzle.board, differentLetters.puzzle.board);
  assert.notDeepEqual(a.rack, differentLetters.rack);
  conserve(a);
});

test('original four-word fixture remains feature-free and wins with exactly one point', () => {
  let state = createEnclosureSession();
  for (const move of ENCLOSURE_MOVES) state = playDraft(state, move).result.state;
  assert.equal(state.puzzle.board.cells[32], null);
  assert.equal(state.bag.length, 85);
  assert.equal(getRackCapacity(state), 7);
  assert.equal(getExchangeCredits(state), 0);
  assert.equal(getPuzzleScore(state.puzzle).totalPoints, 1);
  assert.equal(state.status, 'won');
  conserve(state);
});
