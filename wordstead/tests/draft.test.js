import test from 'node:test';
import assert from 'node:assert/strict';
import { createStandardTiles } from '../src/core/bag.js';
import { createSession, commitSessionWord, evaluateSessionPlacement, endSession, getStrokes } from '../src/core/session.js';
import { createDraft, placeDraftTile, returnDraftTile, undoDraft, inspectDraft,
  assignDraftBlank, evaluateDraft, commitSessionDraft } from '../src/core/draft.js';
import { createEnclosureSession, ENCLOSURE_MOVES } from '../src/core/session-fixture.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { createDictionary } from '../src/core/dictionary.js';
import { setLetter } from '../src/core/letters.js';
import { getTerritoryScore } from '../src/core/territory.js';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function withRack(letters = 'CATAS??') {
  const remaining = createStandardTiles();
  const prefix = [...letters].map((letter) => {
    const index = remaining.findIndex((tile) => tile.letter === (letter === '?' ? null : letter));
    assert.ok(index >= 0);
    return remaining.splice(index, 1)[0];
  });
  return createSession({ rows: 7, columns: 7, seed: 'draft-test', target: 99,
    bagOrder: [...prefix, ...remaining].map((tile) => tile.id) });
}
function put(state, draft, slot, row, column, assignedLetter) {
  const result = placeDraftTile(state, draft, { tileId: state.rack[slot].id, row, column, assignedLetter });
  assert.equal(result.accepted, true, result.reason?.message);
  return result.draft;
}
function cat(state = withRack()) {
  let draft = createDraft();
  for (const [slot, column] of [[0, 3], [1, 4], [2, 5]]) draft = put(state, draft, slot, 3, column);
  return draft;
}
function withLetters(state, entries) {
  let board = state.puzzle.board;
  for (const [row, column, letter] of entries) board = setLetter(board, row, column, letter);
  return { ...state, puzzle: { ...state.puzzle, board, wordCount: 1 } };
}
function rejectDrop(state, draft, slot, row, column, code) {
  const result = placeDraftTile(freeze(state), freeze(draft), { tileId: state.rack[slot].id, row, column });
  assert.equal(result.accepted, false);
  assert.equal(result.draft, draft);
  assert.equal(result.reason.code, code);
}
function rejectCommit(state, draft, code, dictionary = demoDictionary) {
  const before = JSON.stringify({ state, draft });
  const result = commitSessionDraft(freeze(state), freeze(draft), dictionary);
  assert.equal(result.accepted, false);
  assert.equal(result.state, state);
  assert.equal(result.draft, draft);
  assert.equal(result.evaluation.reason.code, code);
  assert.equal(JSON.stringify({ state, draft }), before);
  assert.deepEqual(result.newlyClaimed, []);
  assert.equal(result.points, 0);
}

test('first tile is orientation-free anywhere; second locks either axis without dictionary checks', () => {
  const state = freeze(withRack());
  const draft = put(state, createDraft(), 0, 0, 0);
  assert.deepEqual(inspectDraft(state.puzzle.board, draft), { coherent: true, orientation: null, reason: null });
  assert.equal(inspectDraft(state.puzzle.board, put(state, draft, 1, 0, 1)).orientation, 'horizontal');
  assert.equal(inspectDraft(state.puzzle.board, put(state, draft, 1, 1, 0)).orientation, 'vertical');
  rejectCommit(state, draft, 'FIRST_WORD_TOO_SHORT');
  rejectCommit(state, put(state, draft, 1, 0, 1), 'START_SQUARE_REQUIRED');
});

test('aligned additions work; branches, diagonals, empty gaps, collisions and out-of-board drops do not', () => {
  const state = withRack();
  let draft = put(state, createDraft(), 0, 3, 3);
  rejectDrop(state, draft, 1, 4, 4, 'DRAFT_AXIS');
  rejectDrop(state, draft, 1, 3, 5, 'DRAFT_GAP');
  rejectDrop(state, draft, 1, 3, 3, 'DRAFT_OCCUPIED');
  rejectDrop(state, draft, 1, -1, 3, 'OUT_OF_BOUNDS');
  rejectDrop(state, draft, 1, 7, 3, 'OUT_OF_BOUNDS');
  rejectDrop(state, draft, 1, 3.5, 3, 'OUT_OF_BOUNDS');
  draft = put(state, draft, 1, 3, 4);
  rejectDrop(state, draft, 2, 4, 4, 'DRAFT_AXIS');
  draft = put(state, draft, 2, 3, 5);
  assert.equal(draft.tiles.length, 3);
  const occupied = withLetters(state, [[2, 3, 'C']]);
  rejectDrop(occupied, createDraft(), 0, 2, 3, 'CELL_OCCUPIED');
});

test('committed letters bridge draft tiles and extend the inferred complete run', () => {
  const state = withLetters(withRack('CASTA??'), [[3, 2, 'S'], [3, 4, 'A'], [3, 6, 'S']]);
  let draft = put(state, createDraft(), 0, 3, 3);
  draft = put(state, draft, 3, 3, 5);
  const result = evaluateDraft(state, draft, createDictionary(['SCATS']));
  assert.equal(result.legal, true);
  assert.equal(result.proposal.word, 'SCATS');
  assert.equal(result.newPositions.length, 2);
  assert.equal(result.reusedPositions.length, 3);
  assert.equal(result.rack.allocations.length, 2);
});

test('temporary dictionary incompleteness never prevents construction', () => {
  const state = withRack();
  const dictionary = createDictionary(['CAT']);
  let draft = put(state, createDraft(), 0, 3, 3);
  draft = put(state, draft, 1, 3, 4);
  assert.equal(evaluateDraft(state, draft, dictionary).reason.code, 'UNKNOWN_WORD');
  assert.equal(inspectDraft(state.puzzle.board, draft).coherent, true);
  rejectCommit(state, draft, 'UNKNOWN_WORD', dictionary);
  draft = put(state, draft, 2, 3, 5);
  assert.equal(evaluateDraft(state, draft, dictionary).legal, true);
});

test('single new tile infers CAT to CATS; vertical extensions and two-axis cross-words count once', () => {
  const initial = withRack();
  const accepted = commitSessionDraft(initial, cat(initial), demoDictionary);
  const state = accepted.state;
  const s = state.rack.find((tile) => tile.letter === 'S');
  const draft = placeDraftTile(state, createDraft(), { tileId: s.id, row: 3, column: 6 }).draft;
  const extension = commitSessionDraft(state, draft, demoDictionary);
  assert.equal(extension.accepted, true);
  assert.equal(extension.evaluation.proposal.word, 'CATS');
  assert.equal(extension.consumedTiles[0].id, s.id);
  assert.equal(extension.state.puzzle.wordCount, 2);
  for (const [entries, row, column, words] of [
    [[[2, 4, 'A']], 3, 4, ['AT']],
    [[[3, 3, 'A'], [2, 4, 'A']], 3, 4, ['AT', 'AT']],
  ]) {
    const crossed = withLetters(withRack(), entries);
    const one = put(crossed, createDraft(), 2, row, column);
    const result = commitSessionDraft(crossed, one, demoDictionary);
    assert.equal(result.accepted, true);
    assert.deepEqual(result.evaluation.words.map((word) => word.text), words);
    assert.equal(result.state.puzzle.wordCount, 2);
  }
});

test('all perpendicular words are checked; any unknown cross-word rejects the full draft', () => {
  const state = withLetters(withRack(), [[2, 3, 'A'], [2, 4, 'A'], [2, 5, 'A']]);
  const draft = cat(state);
  const dictionary = createDictionary(['CAT', 'AC', 'AA']);
  const preview = evaluateDraft(state, draft, dictionary);
  assert.deepEqual(preview.words.map((word) => [word.text, word.valid]),
    [['CAT', true], ['AC', true], ['AA', true], ['AT', false]]);
  rejectCommit(state, draft, 'UNKNOWN_WORD', dictionary);
  assert.equal(commitSessionDraft(state, draft, createDictionary(['CAT', 'AC', 'AA', 'AT'])).accepted, true);
});

test('undo, arbitrary return, move and clear preserve rack slots; split removal remains repairable', () => {
  const state = freeze(withRack());
  const original = freeze(cat(state));
  const before = JSON.stringify(state);
  let draft = undoDraft(original);
  assert.equal(draft.tiles.length, 2);
  draft = returnDraftTile(original, state.rack[1].id);
  assert.equal(inspectDraft(state.puzzle.board, draft).reason.code, 'DRAFT_GAP');
  rejectCommit(state, draft, 'DRAFT_GAP');
  draft = put(state, draft, 1, 3, 4);
  assert.equal(evaluateDraft(state, draft, demoDictionary).legal, true);
  const one = returnDraftTile(undoDraft(original), state.rack[0].id);
  assert.equal(inspectDraft(state.puzzle.board, one).orientation, null);
  assert.equal(inspectDraft(state.puzzle.board, put(state, one, 2, 4, 4)).orientation, 'vertical');
  const moved = put(state, one, 1, 0, 0);
  assert.deepEqual(moved.tiles[0], { tileId: state.rack[1].id, letter: 'A', assignedLetter: null, row: 0, column: 0 });
  rejectDrop(state, original, 1, 0, 0, 'DRAFT_AXIS'); // Canceled invalid drag restores EXACT draft.
  assert.equal(returnDraftTile(original, -1), original);
  assert.deepEqual(createDraft(), { tiles: [] });
  assert.equal(undoDraft(createDraft()).tiles.length, 0);
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.rack[1].id, original.tiles[1].tileId);
});

test('duplicate A tiles retain distinct IDs and moving never duplicates a physical tile', () => {
  const state = withRack();
  let draft = put(state, createDraft(), 1, 3, 3);
  draft = put(state, draft, 3, 3, 4);
  assert.notEqual(draft.tiles[0].tileId, draft.tiles[1].tileId);
  draft = put(state, draft, 1, 3, 5);
  assert.equal(draft.tiles.length, 2);
  assert.equal(new Set(draft.tiles.map((tile) => tile.tileId)).size, 2);
  const returned = returnDraftTile(draft, state.rack[1].id);
  assert.equal(returned.tiles[0].tileId, state.rack[3].id);
});

test('blank assignment, movement and reassignment preserve identity and explicit provenance', () => {
  const state = withRack();
  const id = state.rack[5].id;
  const rejected = placeDraftTile(state, createDraft(), { tileId: id, row: 3, column: 3 });
  assert.equal(rejected.reason.code, 'BLANK_ASSIGNMENT');
  for (const assignedLetter of ['', 'a', '?', 'AA', null, 'ß', { toString: () => 'A' }]) {
    assert.equal(placeDraftTile(state, createDraft(), { tileId: id, row: 3, column: 3, assignedLetter }).accepted, false);
  }
  let draft = put(state, createDraft(), 0, 3, 3);
  draft = put(state, draft, 5, 3, 4, 'O');
  draft = assignDraftBlank(state, draft, id, 'A').draft;
  draft = put(state, draft, 2, 3, 5);
  assert.equal(assignDraftBlank(state, draft, state.rack[0].id, 'A').accepted, false);
  const moved = put(state, put(state, createDraft(), 5, 0, 0, 'A'), 5, 1, 1);
  assert.equal(moved.tiles[0].assignedLetter, 'A');
  const result = commitSessionDraft(freeze(state), freeze(draft), demoDictionary);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.state.puzzle.board.cells[25], { kind: 'letter', letter: 'A', tileId: id, blank: true });
  assert.ok(result.state.rack.some((tile) => tile.id === state.rack[1].id)); // Matching A deliberately NOT consumed.
  assert.ok(result.state.rack.some((tile) => tile.id === state.rack[3].id));
  assert.ok(!result.state.rack.some((tile) => tile.id === id));
});

test('previews and arbitrary draft edits never spend, draw, claim, count or advance RNG', () => {
  const state = freeze(withRack());
  const before = JSON.stringify(state);
  const draft = freeze(cat(state));
  for (let i = 0; i < 20; i += 1) {
    evaluateDraft(state, draft, demoDictionary);
    undoDraft(draft);
    returnDraftTile(draft, state.rack[0].id);
    createDraft();
  }
  assert.equal(JSON.stringify(state), before);
  const committed = commitSessionDraft(state, draft, demoDictionary);
  assert.equal(committed.accepted, true);
  assert.equal(committed.state.rack.length, 7);
  assert.equal(committed.state.bag.length, 90);
  assert.equal(committed.state.rngState, state.rngState);
  assert.deepEqual(committed.state.rack, [...state.rack.slice(3), ...state.bag.slice(0, 3)]);
  assert.deepEqual(committed.draft, createDraft());
  assert.equal(committed.state.puzzle.wordCount, 1);
});

test('first-square, subsequent connectivity, empty draft and stale allocations revalidate on commit', () => {
  const state = withRack();
  rejectCommit(state, createDraft(), 'EMPTY_DRAFT');
  const initial = cat(state);
  const shifted = { tiles: initial.tiles.map((tile) => ({ ...tile, row: 0, column: tile.column - 3 })) };
  rejectCommit(state, shifted, 'START_SQUARE_REQUIRED');
  const elsewhere = withLetters(state, [[0, 0, 'A']]);
  rejectCommit(elsewhere, initial, 'DISCONNECTED');
  assert.equal(evaluateDraft(state, initial, demoDictionary).legal, true);
  rejectCommit({ ...state, rack: state.rack.slice(1) }, initial, 'INVALID_TILE_ALLOCATION');
  rejectCommit(state, { tiles: initial.tiles.map((tile) => ({ ...tile, tileId: 1000 + tile.tileId })) }, 'INVALID_TILE_ALLOCATION');
  const overwritten = withLetters(state, [[3, 3, 'C']]);
  rejectCommit(overwritten, initial, 'INVALID_DRAFT');
  rejectCommit(state, { tiles: [initial.tiles[0], { ...initial.tiles[1], tileId: initial.tiles[0].tileId }] }, 'INVALID_DRAFT');
});

test('explicit allocation rejects missing, duplicate, foreign, extra, wrong-letter and invalid blank supplies atomically', () => {
  const state = freeze(withRack());
  const assignments = cat(state).tiles;
  const proposal = { word: 'CAT', row: 3, column: 3, orientation: 'horizontal' };
  const invalid = [null, [], assignments.slice(1), [...assignments, assignments[0]],
    assignments.map((item) => ({ ...item, row: 4 })),
    assignments.map((item, index) => index === 0 ? { ...item, tileId: state.rack[2].id } : item),
    assignments.map((item, index) => index === 1 ? { ...item, tileId: state.rack[0].id } : item),
    assignments.map((item, index) => index === 1 ? { ...item, tileId: state.rack[5].id } : item),
    assignments.map((item, index) => index === 1 ? { ...item, letter: 'O' } : item),
    assignments.map((item, index) => index === 1 ? { ...item, assignedLetter: 'A' } : item)];
  for (const assignment of invalid) {
    const result = commitSessionWord(state, proposal, demoDictionary, assignment);
    assert.equal(result.accepted, false);
    assert.equal(result.evaluation.reason.code, 'INVALID_TILE_ALLOCATION');
    assert.equal(result.state, state);
  }
  const selectedSecondA = assignments.map((item, index) => index === 1 ? { ...item, tileId: state.rack[3].id } : item);
  const result = commitSessionWord(state, proposal, demoDictionary, selectedSecondA);
  assert.equal(result.accepted, true);
  assert.equal(result.state.puzzle.board.cells[25].tileId, state.rack[3].id);
  assert.ok(result.state.rack.some((tile) => tile.id === state.rack[1].id));
  assert.equal(evaluateSessionPlacement(state, proposal, demoDictionary).rack.allocations[1].tile.id, state.rack[1].id);
});

test('dictionary and territory exceptions cannot publish partial state or clear the draft', () => {
  const state = freeze(withRack());
  const draft = freeze(cat(state));
  const before = JSON.stringify({ state, draft });
  assert.throws(() => commitSessionDraft(state, draft, { has() { throw new Error('dictionary failed'); } }), /dictionary failed/);
  const broken = freeze({ ...state, puzzle: { ...state.puzzle, territory: { ...state.puzzle.territory, rows: 1 } } });
  assert.throws(() => commitSessionDraft(broken, draft, demoDictionary), RangeError);
  assert.equal(JSON.stringify({ state, draft }), before);
});

test('commit-time dictionary rejections retain draft structure and cannot trust the first legal evaluation', () => {
  const state = freeze(withRack());
  const draft = freeze(cat(state));
  for (const rejectAt of [2, 3]) {
    let calls = 0;
    const dictionary = { has: () => ++calls < rejectAt };
    const result = commitSessionDraft(state, draft, dictionary);
    assert.equal(result.accepted, false);
    assert.equal(result.state, state);
    assert.equal(result.draft, draft);
    assert.equal(result.evaluation.structural.coherent, true);
    assert.equal(result.evaluation.reason.code, 'UNKNOWN_WORD');
  }
});

test('scripted enclosure runs exclusively through physical drafts, reuses corners, wins, locks and restarts', () => {
  let state = freeze(createEnclosureSession());
  const firstRack = state.rack;
  for (let moveIndex = 0; moveIndex < ENCLOSURE_MOVES.length; moveIndex += 1) {
    const move = ENCLOSURE_MOVES[moveIndex];
    let draft = createDraft();
    const used = new Set();
    for (let offset = 0; offset < move.word.length; offset += 1) {
      const row = move.row + (move.orientation === 'vertical' ? offset : 0);
      const column = move.column + (move.orientation === 'horizontal' ? offset : 0);
      if (state.puzzle.board.cells[row * 7 + column] !== null) continue;
      const slot = state.rack.findIndex((tile) => tile.letter === move.word[offset] && !used.has(tile.id));
      used.add(state.rack[slot].id);
      draft = put(state, draft, slot, row, column);
    }
    const before = JSON.stringify(state);
    for (let i = 0; i < 3; i += 1) assert.equal(evaluateDraft(state, draft, demoDictionary).legal, true);
    assert.equal(JSON.stringify(state), before);
    const result = commitSessionDraft(state, freeze(draft), demoDictionary);
    assert.equal(result.accepted, true);
    assert.deepEqual(new Set(result.consumedTiles.map((tile) => tile.id)), used);
    assert.equal(result.points, moveIndex === 3 ? 1 : 0);
    assert.equal(result.state.bag.length, [90, 88, 86, 85][moveIndex]);
    state = freeze(result.state);
  }
  assert.equal(state.status, 'won');
  assert.equal(state.puzzle.wordCount, 4);
  assert.equal(state.exchangeCount, 0);
  assert.equal(getStrokes(state), 4);
  assert.equal(getTerritoryScore(state.puzzle.territory), 1);
  assert.deepEqual(state.puzzle.territory.claimed.flatMap((claimed, index) => claimed ? [index] : []), [32]);
  const ids = [...state.rack, ...state.bag].map((tile) => tile.id)
    .concat(state.puzzle.board.cells.filter(Boolean).map((cell) => cell.tileId));
  assert.deepEqual(ids.sort((a, b) => a - b), createStandardTiles().map((tile) => tile.id));
  rejectCommit(state, createDraft(), 'RUN_FINISHED');
  rejectDrop(state, createDraft(), 0, 0, 0, 'RUN_FINISHED');
  assert.deepEqual(createEnclosureSession().rack, firstRack);
});

test('ended and exhausted sessions reject drafts and placements without mutation', () => {
  const initial = withRack();
  for (const state of [endSession(initial).state, { ...initial, status: 'exhausted', rack: [], bag: [] }]) {
    rejectCommit(state, cat(initial), 'RUN_FINISHED');
    const result = placeDraftTile(state, createDraft(), { tileId: initial.rack[0].id, row: 0, column: 0 });
    assert.equal(result.reason.code, 'RUN_FINISHED');
  }
});
