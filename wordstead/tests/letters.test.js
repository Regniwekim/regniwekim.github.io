import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, getCell } from '../src/core/board.js';
import { createLetterCell, isLetterCell, setLetter } from '../src/core/letters.js';
import { freezeBoard } from './fixtures.js';

test('only explicit letters are fences', () => {
  assert.deepEqual(createLetterCell('W'), { kind: 'letter', letter: 'W' });
  assert.equal(isLetterCell(createLetterCell('A')), true);
  for (const cell of [null, undefined, 'A', 1, {}, { letter: 'A' }, { kind: 'feature' }]) {
    assert.equal(isLetterCell(cell), false);
  }
});

test('set, replace, and clear occupancy without changing input or other cells', () => {
  const empty = freezeBoard(createBoard({ rows: 2, columns: 3 }));
  const placed = freezeBoard(setLetter(empty, 1, 2, 'W'));
  const replaced = setLetter(placed, 1, 2, 'E');
  const cleared = setLetter(placed, 1, 2, null);
  assert.equal(getCell(empty, 1, 2), null);
  assert.deepEqual(getCell(placed, 1, 2), createLetterCell('W'));
  assert.deepEqual(getCell(replaced, 1, 2), createLetterCell('E'));
  assert.deepEqual(cleared, empty);
  assert.notEqual(cleared.cells, empty.cells);
  assert.deepEqual(placed.cells.slice(0, 5), Array(5).fill(null));
});

test('letter writes reject invalid coordinates and unsupported letters', () => {
  const board = freezeBoard(createBoard({ rows: 2, columns: 3 }));
  for (const [row, column] of [[-1, 0], [2, 0], [0, 3], [0, -1], [0.5, 0], [0, NaN], ['0', 0]]) {
    assert.throws(() => setLetter(board, row, column, 'A'), RangeError);
    assert.throws(() => setLetter(board, row, column, null), RangeError);
  }
  for (const letter of ['', 'a', 'AB', '1', ' ', undefined, {}, 1, 'É']) {
    assert.throws(() => createLetterCell(letter), TypeError);
    assert.throws(() => setLetter(board, 0, 0, letter), TypeError);
  }
});
