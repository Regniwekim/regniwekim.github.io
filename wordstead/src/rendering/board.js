import { isLetterCell } from '../core/letters.js';

// View measurements only. Logical geometry and scoring stay in core.
const GUTTER = 28;
const INK = '#354c43';

/** Invert the displayed CSS rectangle, independent of backing pixels / DPR. */
export function pointerToCell(canvas, board, cellSize, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (GUTTER + board.columns * cellSize) / rect.width;
  const y = (clientY - rect.top) * (GUTTER + board.rows * cellSize) / rect.height;
  const column = Math.floor((x - GUTTER) / cellSize);
  const row = Math.floor((y - GUTTER) / cellSize);
  if (row < 0 || column < 0 || row >= board.rows || column >= board.columns) return null;
  return { row, column };
}

/** Draw precomputed territory states; never infer enclosure from pixels. */
export function drawBoard(canvas, { board, territory, evaluation, recentClaims, selected, cellSize }) {
  const width = GUTTER + board.columns * cellSize;
  const height = GUTTER + board.rows * cellSize;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  context.fillStyle = '#f5e8c8';
  context.fillRect(0, 0, width, height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = INK;
  context.font = '12px system-ui, sans-serif';
  for (let column = 0; column < board.columns; column += 1) {
    context.fillText(column + 1, GUTTER + (column + 0.5) * cellSize, GUTTER / 2);
  }
  for (let row = 0; row < board.rows; row += 1) {
    context.fillText(row + 1, GUTTER / 2, GUTTER + (row + 0.5) * cellSize);
  }

  const enclosed = new Set(evaluation.enclosed);
  const recent = new Set(recentClaims);
  board.cells.forEach((cell, index) => {
    const x = GUTTER + (index % board.columns) * cellSize;
    const y = GUTTER + Math.floor(index / board.columns) * cellSize;
    const letter = isLetterCell(cell);
    context.fillStyle = letter ? '#f0d7af'
      : recent.has(index) ? '#dce9b6'
        : territory.claimed[index] ? '#91aa85'
          : enclosed.has(index) ? '#f5e8c8' : '#bdd27e';
    context.fillRect(x, y, cellSize, cellSize);
    context.strokeStyle = '#667a51';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);

    if (letter) {
      context.strokeStyle = '#a67c61';
      context.lineWidth = 2;
      context.strokeRect(x + 4, y + 4, cellSize - 8, cellSize - 8);
      context.fillStyle = INK;
      context.font = `700 ${Math.round(cellSize * 0.5)}px system-ui, sans-serif`;
      context.fillText(cell.letter, x + cellSize / 2, y + cellSize / 2);
    } else if (territory.claimed[index]) {
      // Symbols distinguish recent and historical claims without color alone.
      context.fillStyle = INK;
      context.font = `700 ${Math.round(cellSize * 0.4)}px system-ui, sans-serif`;
      context.fillText(recent.has(index) ? '+' : '✓', x + cellSize / 2, y + cellSize / 2);
    } else if (enclosed.has(index)) {
      context.strokeStyle = INK;
      context.lineWidth = 2;
      context.setLineDash([3, 3]);
      context.strokeRect(x + 7, y + 7, cellSize - 14, cellSize - 14);
      context.setLineDash([]);
    }
    if (selected.row === Math.floor(index / board.columns) && selected.column === index % board.columns) {
      context.strokeStyle = INK;
      context.lineWidth = 3;
      context.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
    }
  });
}

/** Keep keyboard/coordinate selection in view using the scrollable board pane. */
export function revealSelection(viewport, selected, cellSize) {
  const x = GUTTER + selected.column * cellSize;
  const y = GUTTER + selected.row * cellSize;
  if (x < viewport.scrollLeft) viewport.scrollLeft = x;
  if (y < viewport.scrollTop) viewport.scrollTop = y;
  if (x + cellSize > viewport.scrollLeft + viewport.clientWidth) {
    viewport.scrollLeft = x + cellSize - viewport.clientWidth;
  }
  if (y + cellSize > viewport.scrollTop + viewport.clientHeight) {
    viewport.scrollTop = y + cellSize - viewport.clientHeight;
  }
}
