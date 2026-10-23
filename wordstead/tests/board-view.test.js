import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../src/core/board.js';
import { pointerToCell } from '../src/rendering/board.js';

test('pointer mapping ignores backing pixels and inverts CSS scale and scroll offset', () => {
  const board = createBoard({ rows: 6, columns: 9 });
  for (const scale of [0.75, 1, 1.5]) {
    for (const cellSize of [44, 56, 72]) {
      const rect = { left: -190, top: -75, width: (28 + 9 * cellSize) * scale, height: (28 + 6 * cellSize) * scale };
      const canvas = { width: 9999, height: 9999, getBoundingClientRect: () => rect };
      for (const [row, column] of [[0, 0], [2, 3], [5, 8]]) {
        const x = rect.left + (28 + (column + 0.5) * cellSize) * scale;
        const y = rect.top + (28 + (row + 0.5) * cellSize) * scale;
        assert.deepEqual(pointerToCell(canvas, board, cellSize, x, y), { row, column });
      }
    }
  }
});

test('label gutters and points outside the logical board are not cells', () => {
  const board = createBoard({ rows: 2, columns: 3 });
  const canvas = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 160, height: 116 }) };
  for (const [x, y] of [[10, 20], [37, 70], [60, 47], [170, 60], [60, 136], [-1, 70]]) {
    assert.equal(pointerToCell(canvas, board, 44, x, y), null);
  }
  assert.deepEqual(pointerToCell(canvas, board, 44, 38, 48), { row: 0, column: 0 });
  assert.deepEqual(pointerToCell(canvas, board, 44, 169.9, 135.9), { row: 1, column: 2 });
});
