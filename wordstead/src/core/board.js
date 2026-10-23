/** Logical board state only: no pixels, sprites, browser APIs, or game rules. */
export const DEFAULT_ROWS = 15;
export const DEFAULT_COLUMNS = 15;

/**
 * @typedef {object} Board
 * @property {number} rows Number of logical rows.
 * @property {number} columns Number of logical columns.
 * @property {(null|object)[]} cells Row-major cells; null means empty.
 */

/**
 * Create an independent empty board. Dimensions must be positive safe integers
 * and the cell count must fit a JavaScript array. Allocation also depends on
 * available memory. Cell contents will evolve alongside future game rules.
 * @param {{rows?: number, columns?: number}} [dimensions]
 * @returns {Board}
 */
export function createBoard({ rows = DEFAULT_ROWS, columns = DEFAULT_COLUMNS } = {}) {
  for (const [name, value] of Object.entries({ rows, columns })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive safe integer.`);
    }
  }

  const cellCount = rows * columns;
  if (!Number.isSafeInteger(cellCount) || cellCount > 0xffffffff) {
    throw new RangeError('The board cell count must fit a JavaScript array.');
  }

  return { rows, columns, cells: Array(cellCount).fill(null) };
}

/**
 * Convert zero-based logical coordinates to a row-major index.
 * Expects a board created by createBoard; rejects out-of-bounds coordinates.
 * @param {Board} board
 * @param {number} row
 * @param {number} column
 * @returns {number}
 */
export function getCellIndex(board, row, column) {
  if (!Number.isInteger(row) || row < 0 || row >= board.rows) {
    throw new RangeError('row must be an integer within the board.');
  }
  if (!Number.isInteger(column) || column < 0 || column >= board.columns) {
    throw new RangeError('column must be an integer within the board.');
  }

  return row * board.columns + column;
}

/** Read a cell by logical coordinates; invalid coordinates throw RangeError. */
export function getCell(board, row, column) {
  return board.cells[getCellIndex(board, row, column)];
}
