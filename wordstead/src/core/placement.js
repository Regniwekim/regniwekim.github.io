import { createLetterCell, isLetterCell } from './letters.js';
import { normalizeWord } from './dictionary.js';

const DIRECTIONS = { horizontal: [0, 1], vertical: [1, 0] };

/** Lower/right middle on even axes; logical coordinates never depend on view. */
export function getStartingSquare(board) {
  return { row: Math.floor(board.rows / 2), column: Math.floor(board.columns / 2) };
}

function inBounds(board, row, column) {
  return row >= 0 && row < board.rows && column >= 0 && column < board.columns;
}

/** Complete runs through NEW tiles only. Deduplicate by direction and start,
 * preserving separate occurrences of identical words in different locations. */
export function extractAffectedWords(board, newPositions) {
  const words = new Map();
  for (const position of newPositions) {
    for (const [orientation, [dr, dc]] of Object.entries(DIRECTIONS)) {
      let { row, column } = position;
      while (inBounds(board, row - dr, column - dc)
        && isLetterCell(board.cells[(row - dr) * board.columns + column - dc])) {
        row -= dr;
        column -= dc;
      }
      const key = `${orientation}:${row}:${column}`;
      if (words.has(key)) continue;
      const positions = [];
      let text = '';
      while (inBounds(board, row, column)) {
        const index = row * board.columns + column;
        if (!isLetterCell(board.cells[index])) break;
        text += board.cells[index].letter;
        positions.push({ row, column, index });
        row += dr;
        column += dc;
      }
      if (positions.length >= 2) words.set(key, { text, orientation, positions });
    }
  }
  return [...words.values()];
}

/** Evaluate without mutation. Expects a valid board and synchronous has(word)
 * dependency returning a boolean. All coordinates are zero-based. */
export function evaluatePlacement(board, proposal, dictionary) {
  if (!dictionary || typeof dictionary.has !== 'function') {
    throw new TypeError('Supply a synchronous dictionary with has(word).');
  }
  const result = {
    legal: false, reason: null, proposal: null, positions: [], newPositions: [],
    reusedPositions: [], conflictPositions: [], words: [], proposedBoard: null,
  };
  const reject = (code, message, details = {}) => ({ ...result, reason: { code, message, ...details } });
  const word = normalizeWord(proposal?.word);
  if (!word) return reject('INVALID_WORD', 'Enter a word using only English A–Z letters.');
  const { row, column, orientation } = proposal;
  result.proposal = { word, row, column, orientation };
  if (!Object.hasOwn(DIRECTIONS, orientation)) {
    return reject('INVALID_ORIENTATION', 'Choose horizontal or vertical placement.');
  }
  if (!Number.isSafeInteger(row) || !Number.isSafeInteger(column)) {
    return reject('INVALID_COORDINATES', 'Starting row and column must be whole numbers.');
  }
  const [dr, dc] = DIRECTIONS[orientation];
  for (let offset = 0; offset < word.length; offset += 1) {
    const r = row + dr * offset;
    const c = column + dc * offset;
    const position = { row: r, column: c, letter: word[offset] };
    if (!inBounds(board, r, c)) {
      result.positions.push({ ...position, status: 'outside' });
      continue;
    }
    position.index = r * board.columns + c;
    const cell = board.cells[position.index];
    const status = cell === null ? 'new' : !isLetterCell(cell) ? 'blocked'
      : cell.letter === position.letter ? 'reused' : 'conflict';
    result.positions.push({ ...position, status });
    if (status === 'new') result.newPositions.push(position);
    else if (status === 'reused') result.reusedPositions.push(position);
    else result.conflictPositions.push(position);
  }
  if (result.positions.some((p) => p.status === 'outside')) {
    return reject('OUT_OF_BOUNDS', 'Every letter must stay within the board.');
  }
  if (result.positions.some((p) => p.status === 'blocked')) {
    return reject('CELL_OCCUPIED', 'This placement would overwrite non-letter cell data.');
  }
  if (result.conflictPositions.length) {
    return reject('LETTER_CONFLICT', 'Proposed letters must match existing letters; tiles cannot be replaced.');
  }
  if (!result.newPositions.length) return reject('NO_NEW_LETTERS', 'Add at least one new letter.');

  const first = !board.cells.some(isLetterCell);
  if (first) {
    if (word.length < 2) return reject('FIRST_WORD_TOO_SHORT', 'The first word needs at least two letters.');
    const start = getStartingSquare(board);
    if (!result.positions.some((p) => p.row === start.row && p.column === start.column)) {
      return reject('START_SQUARE_REQUIRED', `The first word must cross row ${start.row + 1}, column ${start.column + 1}.`);
    }
  } else {
    const connected = result.reusedPositions.length > 0 || result.newPositions.some(({ row: r, column: c }) =>
      [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([nr, nc]) =>
        inBounds(board, nr, nc) && isLetterCell(board.cells[nr * board.columns + nc])));
    if (!connected) return reject('DISCONNECTED', 'Connect the placement to existing letters by overlap or an orthogonal word.');
  }

  const cells = board.cells.slice();
  for (const { index, letter } of result.newPositions) cells[index] = createLetterCell(letter);
  result.proposedBoard = { ...board, cells };
  result.words = extractAffectedWords(result.proposedBoard, result.newPositions).map((run) => {
    const valid = dictionary.has(run.text);
    if (typeof valid !== 'boolean') throw new TypeError('Dictionary has(word) must synchronously return a boolean.');
    return { ...run, valid };
  });
  if (!result.words.length) return reject('NO_WORD_FORMED', 'Form or extend at least one word of two or more letters.');
  const unknown = result.words.filter((run) => !run.valid);
  if (unknown.length) {
    return reject('UNKNOWN_WORD', `Not in the selected vocabulary: ${unknown.map((run) => run.text).join(', ')}.`, { words: unknown });
  }
  return { ...result, legal: true };
}
