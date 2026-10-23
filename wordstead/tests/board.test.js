import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROWS,
  DEFAULT_COLUMNS,
  createBoard,
  getCellIndex,
  getCell,
} from '../src/core/board.js';

test('initializes the default 15 by 15 board with every cell empty', () => {
  const board = createBoard();

  assert.equal(DEFAULT_ROWS, 15);
  assert.equal(DEFAULT_COLUMNS, 15);
  assert.equal(board.rows, 15);
  assert.equal(board.columns, 15);
  assert.deepEqual(board.cells, Array(225).fill(null));
});

test('supports wide, tall, and single-cell rectangular boards', () => {
  for (const [rows, columns] of [[2, 5], [5, 2], [1, 4], [4, 1], [1, 1]]) {
    const board = createBoard({ rows, columns });

    assert.equal(board.rows, rows);
    assert.equal(board.columns, columns);
    assert.deepEqual(board.cells, Array(rows * columns).fill(null));
  }
});

test('defaults each omitted dimension independently', () => {
  assert.equal(createBoard({ rows: 2 }).columns, 15);
  assert.equal(createBoard({ columns: 3 }).rows, 15);
  assert.deepEqual(createBoard({}), createBoard());
});

test('maps coordinates in row-major order without gaps or collisions', () => {
  const board = createBoard({ rows: 3, columns: 5 });
  const indexes = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let column = 0; column < board.columns; column += 1) {
      indexes.push(getCellIndex(board, row, column));
      assert.equal(getCell(board, row, column), null);
    }
  }

  assert.deepEqual(indexes, Array.from({ length: 15 }, (_, index) => index));
  assert.equal(getCellIndex(board, 0, 4), 4);
  assert.equal(getCellIndex(board, 1, 0), 5);
  assert.equal(getCellIndex(board, 2, 4), 14);
});

test('coordinate reads access existing storage without changing the board', () => {
  const board = createBoard({ rows: 2, columns: 3 });
  const before = structuredClone(board);
  const descriptor = Object.getOwnPropertyDescriptor(board.cells, '4');
  let reads = 0;
  Object.defineProperty(board.cells, 4, {
    get() {
      reads += 1;
      return descriptor.value;
    },
    configurable: true,
    enumerable: true,
  });

  assert.equal(getCell(board, 1, 1), null);
  assert.equal(reads, 1);
  assert.deepEqual([...board.cells], before.cells);
  assert.equal(board.rows, before.rows);
  assert.equal(board.columns, before.columns);
});

test('initialization is deterministic and boards own independent storage', () => {
  const first = createBoard({ rows: 2, columns: 3 });
  const second = createBoard({ rows: 2, columns: 3 });

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.cells, second.cells);
});

test('rejects invalid dimensions rather than coercing values', () => {
  const invalid = [0, -1, 1.5, NaN, Infinity, -Infinity, '15', null, true, {}, [], 2n, Number.MAX_SAFE_INTEGER + 1];

  for (const dimension of ['rows', 'columns']) {
    for (const value of invalid) {
      assert.throws(() => createBoard({ [dimension]: value }), {
        name: 'RangeError',
        message: `${dimension} must be a positive safe integer.`,
      });
    }
  }
});

test('rejects cell counts that cannot be represented by a JavaScript array', () => {
  for (const dimensions of [
    { rows: 65536, columns: 65536 },
    { rows: Number.MAX_SAFE_INTEGER, columns: 2 },
    { rows: 1, columns: 2 ** 32 },
  ]) {
    assert.throws(() => createBoard(dimensions), {
      name: 'RangeError',
      message: 'The board cell count must fit a JavaScript array.',
    });
  }
});

test('coordinate access rejects non-integer and out-of-bounds coordinates', () => {
  const board = createBoard({ rows: 2, columns: 5 });

  for (const access of [getCellIndex, getCell]) {
    for (const value of [-1, 2, 2.5, NaN, Infinity, '0', null, undefined]) {
      assert.throws(() => access(board, value, 0), RangeError);
    }
    for (const value of [-1, 5, 1.5, NaN, Infinity, '0', null, undefined]) {
      assert.throws(() => access(board, 0, value), RangeError);
    }
  }
});
