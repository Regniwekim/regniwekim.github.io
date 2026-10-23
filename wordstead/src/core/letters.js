import { getCellIndex } from './board.js';

/** Only explicit letter occupancy blocks land; other cell metadata is passable. */
export function isLetterCell(cell) {
  return cell !== null && typeof cell === 'object' && cell.kind === 'letter';
}

/** Create a committed letter cell. Blank tiles and non-English glyphs are deferred. */
export function createLetterCell(letter) {
  if (typeof letter !== 'string' || !/^[A-Z]$/.test(letter)) {
    throw new TypeError('letter must be one uppercase A–Z character.');
  }
  return { kind: 'letter', letter };
}

/**
 * Return a board with a letter set, or cleared with null, at zero-based coordinates.
 * This is an occupancy operation, not Wordstead placement validation. Inputs are
 * not mutated. Replacing a cell replaces its contents; claims live separately.
 */
export function setLetter(board, row, column, letter) {
  const index = getCellIndex(board, row, column);
  const cell = letter === null ? null : createLetterCell(letter);
  const cells = board.cells.slice();
  cells[index] = cell;
  return { ...board, cells };
}
