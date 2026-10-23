import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VOCABULARY } from '../src/vocabulary/manifest.js';
import { parseVocabulary } from '../src/vocabulary/format.js';
import { createDictionary } from '../src/core/dictionary.js';
import { createSession, evaluateSessionPlacement, exchangeTiles, getRackCapacity,
  getExchangeCredits, getStrokes } from '../src/core/session.js';
import { createStandardTiles } from '../src/core/bag.js';
import { createDraft, placeDraftTile, returnDraftTile, undoDraft, assignDraftBlank,
  evaluateDraft, commitSessionDraft } from '../src/core/draft.js';
import { createEnclosureSession, ENCLOSURE_MOVES } from '../src/core/session-fixture.js';
import { createFarmSession } from '../src/core/farm-fixture.js';
import { getPuzzleScore } from '../src/core/features.js';
import { createPuzzle, commitWord } from '../src/core/puzzle.js';
import { evaluatePlacement } from '../src/core/placement.js';

const dictionary = createDictionary(parseVocabulary(readFileSync(
  new URL(`../vocabulary/${VOCABULARY.file}`, import.meta.url), 'utf8'), VOCABULARY));
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
function withRack(letters) {
  const remaining = createStandardTiles();
  const prefix = [...letters].map((letter) => {
    const index = remaining.findIndex((tile) => tile.letter === (letter === '?' ? null : letter));
    assert.ok(index >= 0);
    return remaining.splice(index, 1)[0];
  });
  return createSession({ rows: 15, columns: 15, target: 100, seed: 'vocabulary-test',
    bagOrder: [...prefix, ...remaining].map((tile) => tile.id) });
}
function draftFor(state, proposal) {
  const evaluation = evaluateSessionPlacement(state, proposal, dictionary);
  assert.equal(evaluation.legal, true, evaluation.reason?.message);
  let draft = createDraft();
  for (const { row, column, letter, tile } of evaluation.rack.allocations) {
    const placed = placeDraftTile(state, draft, { row, column, tileId: tile.id,
      assignedLetter: tile.letter === null ? letter : undefined });
    assert.equal(placed.accepted, true);
    draft = placed.draft;
  }
  return draft;
}
function conserve(state) {
  const ids = [...state.rack, ...state.bag].map((tile) => tile.id)
    .concat(state.puzzle.board.cells.filter((cell) => cell?.kind === 'letter').map((cell) => cell.tileId));
  assert.deepEqual(ids.sort((a, b) => a - b), Array.from({ length: 100 }, (_, id) => id));
}

test('expanded words preserve direct tile movement, draft editing, blank choice and atomic commitment', () => {
  const state = freeze(withRack('G?RDENS'));
  let draft = draftFor(state, { word: 'GARDENS', row: 7, column: 4, orientation: 'horizontal' });
  const blank = draft.tiles.find((tile) => tile.assignedLetter);
  assert.equal(blank.letter, 'A');
  const moved = placeDraftTile(state, draft, { tileId: blank.tileId, row: 7, column: 5 });
  assert.equal(moved.accepted, true);
  assert.equal(moved.draft.tiles.at(-1).assignedLetter, 'A');
  assert.equal(returnDraftTile(draft, blank.tileId).tiles.length, 6);
  assert.equal(undoDraft(draft).tiles.length, 6);
  const invalid = assignDraftBlank(state, draft, blank.tileId, 'Z').draft;
  const rejected = commitSessionDraft(state, freeze(invalid), dictionary);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.state, state);
  assert.equal(rejected.draft, invalid);
  assert.equal(rejected.evaluation.reason.code, 'UNKNOWN_WORD');
  draft = freeze(draft);
  const before = JSON.stringify({ state, draft });
  for (let repeat = 0; repeat < 5; repeat += 1) assert.equal(evaluateDraft(state, draft, dictionary).legal, true);
  assert.equal(JSON.stringify({ state, draft }), before);
  const result = commitSessionDraft(state, draft, dictionary);
  assert.equal(result.accepted, true);
  assert.equal(result.state.puzzle.wordCount, 1);
  const cell = result.state.puzzle.board.cells[7 * 15 + 5];
  assert.equal(cell.letter, 'A');
  assert.equal(cell.blank, true);
  assert.equal(cell.tileId, blank.tileId);
  conserve(result.state);
});

test('expanded membership checks every complete cross-word and preserves rejection atomicity', () => {
  const move = (word, row, column, orientation = 'horizontal') => ({ word, row, column, orientation });
  let state = commitWord(createPuzzle({ rows: 7, columns: 7 }), move('CAT', 3, 3), dictionary).state;
  const rejected = commitWord(freeze(state), move('BAR', 4, 3), dictionary);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.state, state);
  assert.equal(rejected.evaluation.reason.code, 'UNKNOWN_WORD');
  assert.ok(rejected.evaluation.words.some((run) => run.text === 'BAR' && run.valid));
  assert.ok(rejected.evaluation.words.some((run) => !run.valid));
  state = commitWord(state, move('AT', 3, 4, 'vertical'), dictionary).state;
  const preview = evaluatePlacement(state.board, move('TO', 4, 4), dictionary);
  assert.equal(preview.legal, true);
  assert.deepEqual(preview.words.map((run) => run.text), ['TO', 'TO']);
  const result = commitWord(state, move('TO', 4, 4), dictionary);
  assert.equal(result.accepted, true);
  assert.equal(result.state.wordCount, 3);
});

test('expanded dictionary preserves all four-word territory and farm rewards, rack growth and credits', () => {
  for (const type of [null, 'crop', 'fertile', 'livestock', 'building']) {
    let state = type ? createFarmSession(type) : createEnclosureSession();
    for (const [index, proposal] of ENCLOSURE_MOVES.entries()) {
      const draft = freeze(draftFor(state, proposal));
      state = freeze(state);
      const before = JSON.stringify(state);
      for (let repeat = 0; repeat < 3; repeat += 1) assert.equal(evaluateDraft(state, draft, dictionary).legal, true);
      assert.equal(JSON.stringify(state), before);
      const result = commitSessionDraft(state, draft, dictionary);
      assert.equal(result.accepted, true);
      assert.deepEqual(result.newlyClaimed, index === 3 ? [32] : []);
      state = result.state;
      conserve(state);
    }
    assert.equal(state.puzzle.wordCount, 4);
    assert.equal(getStrokes(state), 4);
    assert.equal(getPuzzleScore(state.puzzle).totalPoints, type === 'crop' ? 4 : type === 'fertile' ? 2 : 1);
    assert.equal(getRackCapacity(state), type === 'livestock' ? 8 : 7);
    assert.equal(state.bag.length, type === 'livestock' ? 84 : 85);
    if (type === 'building') {
      assert.equal(getExchangeCredits(state), 1);
      const exchange = exchangeTiles(state, [state.rack[0].id]);
      assert.equal(exchange.freeExchange, true);
      assert.equal(getStrokes(exchange.state), 4);
      assert.equal(getExchangeCredits(exchange.state), 0);
      conserve(exchange.state);
    } else if (type !== 'livestock') {
      assert.equal(state.status, 'won');
      assert.equal(exchangeTiles(state, [state.rack[0].id]).accepted, false);
    }
  }
});

test('repeated dictionary previews cannot affect seeded farms, racks or exchange randomness', () => {
  const config = { seed: 'blank-qa-636', farmSeed: 'vocabulary-farm', rows: 7, columns: 7, target: 100 };
  const first = createSession(config), second = createSession(config);
  assert.deepEqual(first, second);
  const proposal = { word: 'CHAT', row: 3, column: 2, orientation: 'horizontal' };
  const draft = draftFor(first, proposal);
  for (let repeat = 0; repeat < 10; repeat += 1) evaluateDraft(first, draft, dictionary);
  const a = commitSessionDraft(first, draft, dictionary).state;
  const b = commitSessionDraft(second, draftFor(second, proposal), dictionary).state;
  assert.deepEqual(a, b);
  assert.deepEqual(exchangeTiles(a, [a.rack[0].id]), exchangeTiles(b, [b.rack[0].id]));
});
