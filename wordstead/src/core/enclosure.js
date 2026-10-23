import { isLetterCell } from './letters.js';

/**
 * Classify non-letter cells as exterior or enclosed. Expects a valid Board.
 * Both outputs contain unique row-major indices in ascending order.
 *
 * Iterative four-neighbor flood fill starts at EVERY passable perimeter cell.
 * Letters alone block movement; diagonal empty cells do not connect. Edges
 * supply outside access, never an implicit fence. O(rows * columns) time/space,
 * no recursion, browser APIs, randomness, or input mutation.
 */
export function analyzeEnclosure(board) {
  const { rows, columns, cells } = board;
  const visited = new Uint8Array(cells.length);
  const queue = [];

  function visit(index) {
    if (!visited[index] && !isLetterCell(cells[index])) {
      visited[index] = 1;
      queue.push(index);
    }
  }

  for (let column = 0; column < columns; column += 1) {
    visit(column);
    visit((rows - 1) * columns + column);
  }
  for (let row = 0; row < rows; row += 1) {
    visit(row * columns);
    visit(row * columns + columns - 1);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const row = Math.floor(index / columns);
    const column = index % columns;
    if (row > 0) visit(index - columns);
    if (row + 1 < rows) visit(index + columns);
    if (column > 0) visit(index - 1);
    if (column + 1 < columns) visit(index + 1);
  }

  const exterior = [];
  const enclosed = [];
  for (let index = 0; index < cells.length; index += 1) {
    if (!isLetterCell(cells[index])) {
      (visited[index] ? exterior : enclosed).push(index);
    }
  }
  return { exterior, enclosed };
}
