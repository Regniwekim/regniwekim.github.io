import { isLetterCell } from '../core/letters.js';
import { isFeatureCell, FEATURE_TYPES } from '../core/features.js';

// View measurements only. Logical geometry and scoring stay in core.
const GUTTER = 28;
const INK = '#354c43';

export function cellToView({ row, column }, cellSize) {
  return { x: GUTTER + column * cellSize, y: GUTTER + row * cellSize };
}

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
export function drawBoard(canvas, { board, territory, evaluation, recentClaims, selected, cellSize,
  preview = null, previewTerritory = null, startingSquare = null, draft = null, selectedTileId = null, drop = null }) {
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
  const proposed = new Map((preview?.positions ?? []).filter((p) => p.index !== undefined).map((p) => [p.index, p]));
  // Even a temporarily split draft must stay visible and editable.
  for (const tile of draft?.tiles ?? []) {
    proposed.set(tile.row * board.columns + tile.column, { ...tile, status: 'new' });
  }
  const prospective = new Set(previewTerritory?.newlyClaimed ?? []);
  board.cells.forEach((cell, index) => {
    const x = GUTTER + (index % board.columns) * cellSize;
    const y = GUTTER + Math.floor(index / board.columns) * cellSize;
    const letter = isLetterCell(cell);
    const feature = isFeatureCell(cell);
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
      if (cell.blank) {
        context.font = '700 11px system-ui, sans-serif';
        context.fillText('◇', x + 10, y + 10);
      }
    } else if (territory.claimed[index] && !feature) {
      // Symbols distinguish recent and historical claims without color alone.
      context.fillStyle = INK;
      context.font = `700 ${Math.round(cellSize * 0.4)}px system-ui, sans-serif`;
      context.fillText(recent.has(index) ? '+' : '✓', x + cellSize / 2, y + cellSize / 2);
    } else if (enclosed.has(index) && !territory.claimed[index]) {
      context.strokeStyle = INK;
      context.lineWidth = 2;
      context.setLineDash([3, 3]);
      context.strokeRect(x + 7, y + 7, cellSize - 14, cellSize - 14);
      context.setLineDash([]);
    }
    if (!letter && startingSquare?.row === Math.floor(index / board.columns)
      && startingSquare?.column === index % board.columns) {
      context.fillStyle = INK;
      context.font = `${Math.round(cellSize * 0.4)}px system-ui, sans-serif`;
      context.fillText('☆', x + cellSize / 2, y + cellSize / 2);
    }
    if (prospective.has(index)) {
      context.fillStyle = '#dce9b6';
      context.fillRect(x + 4, y + 4, cellSize - 8, cellSize - 8);
      context.fillStyle = INK;
      context.font = `700 ${Math.round(cellSize * 0.4)}px system-ui, sans-serif`;
      if (!feature) context.fillText('?', x + cellSize / 2, y + cellSize / 2);
    }
    if (feature) drawFeature(context, cell.type, x, y, cellSize,
      prospective.has(index) ? '?' : territory.claimed[index] ? recent.has(index) ? '+' : '✓' : '');
    const ghost = proposed.get(index);
    if (ghost) {
      const conflict = ghost.status === 'conflict' || ghost.status === 'blocked';
      context.strokeStyle = preview?.legal ? '#354c43' : '#8c3936';
      context.lineWidth = 2;
      context.setLineDash(ghost.status === 'reused' ? [] : [4, 3]);
      context.strokeRect(x + 5, y + 5, cellSize - 10, cellSize - 10);
      context.setLineDash([]);
      if (ghost.status === 'new') {
        context.fillStyle = '#fffdf6';
        context.fillRect(x + 8, y + 8, cellSize - 16, cellSize - 16);
        context.fillStyle = INK;
        context.font = `700 ${Math.round(cellSize * 0.5)}px system-ui, sans-serif`;
        context.fillText(ghost.letter, x + cellSize / 2, y + cellSize / 2);
      }
      context.fillStyle = INK;
      context.font = '700 11px system-ui, sans-serif';
      const blank = ghost.assignedLetter || preview?.rack?.allocations.some((allocation) => allocation.index === index && allocation.blank);
      context.fillText(conflict ? `×${ghost.letter}` : ghost.status === 'reused' ? '=' : blank ? '◇' : 'p', x + cellSize - 11, y + 9);
      if (ghost.tileId === selectedTileId) {
        context.strokeStyle = INK;
        context.lineWidth = 4;
        context.strokeRect(x + 7, y + 7, cellSize - 14, cellSize - 14);
      }
    }
    if (drop?.row === Math.floor(index / board.columns) && drop?.column === index % board.columns) {
      context.strokeStyle = drop.legal ? INK : '#8c3936';
      context.lineWidth = 4;
      context.strokeRect(x + 3, y + 3, cellSize - 6, cellSize - 6);
      context.fillStyle = INK;
      context.font = '700 14px system-ui, sans-serif';
      context.fillText(drop.legal ? '+' : '×', x + 11, y + 11);
    }
    if (selected.row === Math.floor(index / board.columns) && selected.column === index % board.columns) {
      context.strokeStyle = INK;
      context.lineWidth = 3;
      context.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
    }
  });
}

/** Original primitive silhouettes + type letters; state badge leaves land visible. */
function drawFeature(context, type, x, y, size, badge) {
  const cx = x + size / 2;
  const top = y + size * 0.18;
  const unit = size / 12;
  context.save();
  context.strokeStyle = INK;
  context.fillStyle = '#f5e8c8';
  context.lineWidth = 2;
  context.beginPath();
  if (type === 'crop') {
    context.moveTo(cx, top + 4 * unit); context.lineTo(cx, top);
    context.moveTo(cx, top + 2 * unit); context.lineTo(cx - 2 * unit, top);
    context.moveTo(cx, top + 3 * unit); context.lineTo(cx + 2 * unit, top + unit);
  } else if (type === 'livestock') {
    context.ellipse(cx - unit / 2, top + 2 * unit, 2.5 * unit, 1.5 * unit, 0, 0, Math.PI * 2);
    context.moveTo(cx + 3 * unit, top + unit);
    context.lineTo(cx + 3 * unit, top + 3 * unit);
    context.moveTo(cx - 2 * unit, top + 3 * unit); context.lineTo(cx - 2 * unit, top + 4 * unit);
    context.moveTo(cx + unit, top + 3 * unit); context.lineTo(cx + unit, top + 4 * unit);
  } else if (type === 'building') {
    context.moveTo(cx - 3 * unit, top + 2 * unit); context.lineTo(cx, top);
    context.lineTo(cx + 3 * unit, top + 2 * unit);
    context.lineTo(cx + 3 * unit, top + 4 * unit); context.lineTo(cx - 3 * unit, top + 4 * unit);
    context.closePath();
    context.fill();
  } else {
    for (let line = 0; line < 3; line += 1) {
      context.moveTo(cx - 3 * unit, top + line * unit * 1.5);
      context.lineTo(cx + 3 * unit, top + line * unit * 1.5);
    }
  }
  context.stroke();
  context.fillStyle = INK;
  context.font = `700 ${Math.round(size * 0.25)}px system-ui, sans-serif`;
  context.fillText(FEATURE_TYPES[type].symbol, cx, y + size * 0.78);
  if (badge) {
    context.fillStyle = '#fffdf6';
    context.fillRect(x + size - 17, y + 2, 15, 15);
    context.fillStyle = INK;
    context.font = '700 12px system-ui, sans-serif';
    context.fillText(badge, x + size - 9, y + 10);
  }
  context.restore();
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
