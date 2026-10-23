import test from 'node:test';
import assert from 'node:assert/strict';
import { createLetterCell } from '../src/core/letters.js';
import { createDictionary } from '../src/core/dictionary.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { evaluatePlacement } from '../src/core/placement.js';
import { createPuzzle, commitWord } from '../src/core/puzzle.js';
import { evaluateTerritory, getTerritoryScore } from '../src/core/territory.js';
import { freezeBoard } from './fixtures.js';

const move = (word, row, column, orientation = 'horizontal') => ({ word, row, column, orientation });
const enclosureMoves = [move('CAR', 3, 3), move('CAB', 3, 3, 'vertical'),
  move('RAT', 3, 5, 'vertical'), move('BAT', 5, 3)];
function freezeState(state) {
  freezeBoard(state.board);
  Object.freeze(state.territory.claimed);
  Object.freeze(state.territory);
  return Object.freeze(state);
}
function completeEnclosure() {
  let state = createPuzzle({ rows: 7, columns: 7 });
  for (const proposal of enclosureMoves) state = commitWord(state, proposal, demoDictionary).state;
  return state;
}

test('puzzle state is independent, minimal, deterministic and has no redundant score', () => {
  const a = createPuzzle({ rows: 4, columns: 6 });
  const b = createPuzzle({ rows: 4, columns: 6 });
  assert.deepEqual(a, b);
  assert.notEqual(a.board.cells, b.board.cells);
  assert.notEqual(a.territory.claimed, b.territory.claimed);
  assert.deepEqual(Object.keys(a).sort(), ['board', 'territory', 'wordCount']);
  assert.equal(a.wordCount, 0);
  assert.equal(createPuzzle().board.rows, 15);
});

test('successful commit is immutable and increments exactly one placement', () => {
  const initial = freezeState(createPuzzle({ rows: 7, columns: 7 }));
  const result = commitWord(initial, enclosureMoves[0], demoDictionary);
  assert.equal(result.accepted, true);
  assert.equal(result.state.wordCount, 1);
  assert.equal(result.points, 0);
  assert.notEqual(result.state.board.cells, initial.board.cells);
  assert.notEqual(result.state.territory.claimed, initial.territory.claimed);
  assert.ok(initial.board.cells.every((cell) => cell === null));
  assert.equal(initial.wordCount, 0);
  assert.equal(getTerritoryScore(initial.territory), 0);
  assert.deepEqual(commitWord(initial, enclosureMoves[0], demoDictionary), result);
});

test('four legal CAR/CAB/RAT/BAT placements enclose exactly the center for one point', () => {
  let state = createPuzzle({ rows: 7, columns: 7 });
  const reused = [0, 1, 1, 2];
  for (const [i, proposal] of enclosureMoves.entries()) {
    freezeState(state);
    const preview = evaluatePlacement(state.board, proposal, demoDictionary);
    assert.equal(preview.legal, true);
    assert.equal(preview.reusedPositions.length, reused[i]);
    const claimPreview = evaluateTerritory(preview.proposedBoard, state.territory);
    assert.deepEqual(claimPreview.newlyClaimed, i === 3 ? [32] : []);
    assert.equal(getTerritoryScore(state.territory), 0);
    const result = commitWord(state, proposal, demoDictionary);
    assert.equal(result.accepted, true);
    assert.deepEqual(result.newlyClaimed, i === 3 ? [32] : []);
    assert.equal(result.points, i === 3 ? 1 : 0);
    assert.equal(result.state.wordCount, i + 1);
    for (let index = 0; index < state.board.cells.length; index += 1) {
      if (state.board.cells[index]) assert.equal(result.state.board.cells[index], state.board.cells[index]);
    }
    state = result.state;
  }
  assert.deepEqual([3, 4, 5].map((r) => [3, 4, 5].map((c) => state.board.cells[r * 7 + c]?.letter ?? '.').join('')), ['CAR', 'A.A', 'BAT']);
  assert.equal(state.board.cells[32], null);
  assert.equal(getTerritoryScore(state.territory), 1);
  assert.equal(state.wordCount, 4);
});

test('invalid attempts preserve the exact board, claims, word counter and score', () => {
  const state = freezeState(completeEnclosure());
  const before = JSON.stringify(state);
  for (const proposal of [move('ZZZ', 0, 0), move('CAT', 3, 3), move('CAR', 3, 3),
    move('CAT', 0, 0), move('ZZZ', 3, 6), move('AT', 6, 6), move('A', -1, 0)]) {
    const result = commitWord(state, proposal, demoDictionary);
    assert.equal(result.accepted, false);
    assert.equal(result.state, state);
    assert.deepEqual(result.newlyClaimed, []);
    assert.equal(result.points, 0);
    assert.equal(result.state.wordCount, 4);
    assert.equal(getTerritoryScore(result.state.territory), 1);
    assert.equal(JSON.stringify(state), before);
  }
});

test('previewing a closing move repeatedly cannot claim cells or increment word count', () => {
  let state = createPuzzle({ rows: 7, columns: 7 });
  for (const proposal of enclosureMoves.slice(0, 3)) state = commitWord(state, proposal, demoDictionary).state;
  freezeState(state);
  for (let i = 0; i < 3; i += 1) {
    const preview = evaluatePlacement(state.board, enclosureMoves[3], demoDictionary);
    assert.equal(evaluateTerritory(preview.proposedBoard, state.territory).points, 1);
    assert.equal(state.board.cells[39], null);
    assert.equal(state.territory.claimed[32], false);
    assert.equal(state.wordCount, 3);
  }
});

test('unknown closing word rejects whole transaction even when it would enclose land', () => {
  let state = createPuzzle({ rows: 7, columns: 7 });
  for (const proposal of enclosureMoves.slice(0, 3)) state = commitWord(state, proposal, demoDictionary).state;
  freezeState(state);
  const result = commitWord(state, enclosureMoves[3], createDictionary(['CAR', 'CAB', 'RAT']));
  assert.equal(result.evaluation.reason.code, 'UNKNOWN_WORD');
  assert.equal(result.state, state);
  assert.equal(result.points, 0);
  assert.equal(state.territory.claimed[32], false);
  assert.equal(state.board.cells[39], null);
});

test('later valid moves cannot score previously claimed cells again or remove letters', () => {
  const state = freezeState(completeEnclosure());
  const next = commitWord(state, move('S', 3, 6), demoDictionary);
  assert.equal(next.accepted, true);
  assert.deepEqual(next.evaluation.words.map((run) => run.text), ['CARS']);
  assert.deepEqual(next.newlyClaimed, []);
  assert.equal(next.points, 0);
  assert.equal(next.state.wordCount, 5);
  assert.equal(getTerritoryScore(next.state.territory), 1);
  assert.equal(next.state.territory.claimed[32], true);
  for (const [index, cell] of state.board.cells.entries()) {
    if (cell) assert.equal(next.state.board.cells[index], cell);
  }
});

test('multiple words formed by one new letter count as one accepted placement', () => {
  const state = createPuzzle({ rows: 5, columns: 7 });
  for (const [row, column, letter] of [[1, 3, 'B'], [2, 2, 'C'], [2, 4, 'T'], [3, 3, 'T']]) {
    state.board.cells[row * 7 + column] = createLetterCell(letter);
  }
  const result = commitWord(freezeState(state), move('A', 2, 3), demoDictionary);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.evaluation.words.map((run) => run.text), ['CAT', 'BAT']);
  assert.equal(result.state.wordCount, 1);
  assert.equal(result.points, 0);
});

test('commit revalidates current state rather than accepting an earlier legal preview', () => {
  const state = createPuzzle({ rows: 7, columns: 7 });
  const proposal = enclosureMoves[0];
  assert.equal(evaluatePlacement(state.board, proposal, demoDictionary).legal, true);
  const first = commitWord(state, proposal, demoDictionary);
  const repeated = commitWord(first.state, proposal, demoDictionary);
  assert.equal(repeated.evaluation.reason.code, 'NO_NEW_LETTERS');
  assert.equal(repeated.state, first.state);
  const changedDictionary = commitWord(state, proposal, createDictionary([]));
  assert.equal(changedDictionary.accepted, false);
  assert.equal(changedDictionary.state, state);
});

test('playable CAT / AT / TO sequence forms two distinct valid TO occurrences', () => {
  let state = createPuzzle({ rows: 7, columns: 7 });
  for (const proposal of [move('CAT', 3, 3), move('AT', 3, 4, 'vertical')]) {
    const result = commitWord(freezeState(state), proposal, demoDictionary);
    assert.equal(result.accepted, true);
    state = result.state;
  }
  const result = commitWord(freezeState(state), move('TO', 4, 4), demoDictionary);
  assert.equal(result.accepted, true);
  assert.equal(result.evaluation.newPositions.length, 1);
  assert.equal(result.evaluation.reusedPositions.length, 1);
  assert.deepEqual(result.evaluation.words.map((run) => [run.text, run.orientation]), [['TO', 'horizontal'], ['TO', 'vertical']]);
  assert.equal(result.state.wordCount, 3);
});
