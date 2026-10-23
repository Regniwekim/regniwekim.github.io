import { createBoard } from '../src/core/board.js';
import { createLetterCell } from '../src/core/letters.js';

/** Explicit logical diagrams: # = letter, . = non-letter land. */
export function boardFromDiagram(lines) {
  const board = createBoard({ rows: lines.length, columns: lines[0].length });
  if (lines.some((line) => line.length !== board.columns)) throw new Error('Unequal fixture rows.');
  board.cells = lines.join('').split('').map((cell) => cell === '#' ? createLetterCell('A') : null);
  return board;
}

export function coordinates(board, indices) {
  return indices.map((index) => [Math.floor(index / board.columns), index % board.columns]);
}

export function freezeBoard(board) {
  board.cells.forEach((cell) => { if (cell !== null) Object.freeze(cell); });
  Object.freeze(board.cells);
  return Object.freeze(board);
}
