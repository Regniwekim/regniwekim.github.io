import { isLetterCell } from '../core/letters.js';
import { isFeatureCell, FEATURE_TYPES } from '../core/features.js';
import { ART, connectionMask, drawGround, drawFence, drawFarmFeature, drawLetterTile, drawBadge } from './artwork.js';

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

/** Present authoritative state in four passes; never infer rules from artwork. */
export function drawBoard(canvas, { board, territory, evaluation, recentClaims, selected, cellSize,
  preview = null, previewTerritory = null, startingSquare = null, draft = null, selectedTileId = null, drop = null }) {
  const width = GUTTER + board.columns * cellSize;
  const height = GUTTER + board.rows * cellSize;
  const dpr = window.devicePixelRatio || 1;
  // Resizing clears/reallocates the backing store. Ordinary input redraws reuse it.
  if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
  if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  context.imageSmoothingEnabled = false;
  context.setLineDash([]);
  context.fillStyle = ART.cream;
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
  const prospective = new Set(previewTerritory?.newlyClaimed ?? []);
  const proposed = new Map((preview?.positions ?? []).filter((p) => p.index !== undefined).map((p) => [p.index, p]));
  // Even an unresolved/split draft stays editable. These are never fence cells.
  for (const tile of draft?.tiles ?? []) {
    proposed.set(tile.row * board.columns + tile.column, { ...tile, status: 'new' });
  }
  // 1. Ground and diagnostic territory (not speculative capture fills).
  board.cells.forEach((cell, index) => {
    const row = Math.floor(index / board.columns);
    const column = index % board.columns;
    const { x, y } = cellToView({ row, column }, cellSize);
    drawGround(context, x, y, cellSize, row, column, { claimed: territory.claimed[index],
      recent: recent.has(index), enclosed: enclosed.has(index) });
    if (!isLetterCell(cell) && !isFeatureCell(cell)) {
      if (territory.claimed[index]) {
        drawBadge(context, recent.has(index) ? '+' : '✓', x + cellSize / 2, y + cellSize / 2);
      } else if (enclosed.has(index)) {
        outline(context, x, y, cellSize, INK, 1, 6, [3, 3]);
      }
      if (startingSquare?.row === row && startingSquare?.column === column) {
        context.fillStyle = INK;
        context.font = `${Math.round(cellSize * 0.4)}px system-ui, sans-serif`;
        context.fillText('☆', x + cellSize / 2, y + cellSize / 2);
      }
    }
  });
  // 2. Only authoritative committed occupancy forms cardinal wooden joins.
  board.cells.forEach((cell, index) => {
    if (!isLetterCell(cell)) return;
    const row = Math.floor(index / board.columns);
    const column = index % board.columns;
    const { x, y } = cellToView({ row, column }, cellSize);
    drawFence(context, x, y, cellSize, connectionMask(board, row, column));
  });
  // 3. Farm identities and solid committed tiles cover the inner rails.
  board.cells.forEach((cell, index) => {
    const { x, y } = cellToView({ row: Math.floor(index / board.columns), column: index % board.columns }, cellSize);
    if (isLetterCell(cell)) drawLetterTile(context, x, y, cellSize, cell.letter, cell.blank);
    if (isFeatureCell(cell)) {
      drawFarmFeature(context, cell.type, x, y, cellSize);
      // Retain textual type clues, including if optional future sprite art is absent.
      drawBadge(context, FEATURE_TYPES[cell.type].symbol, x + 8, y + cellSize - 8, 10);
      if (territory.claimed[index]) drawBadge(context, recent.has(index) ? '+' : '✓', x + cellSize - 9, y + 9);
      else if (enclosed.has(index)) outline(context, x, y, cellSize, INK, 1, 3, [3, 3]);
    }
  });
  // 4. Previews, draft faces, selection and drop feedback always stay above art.
  board.cells.forEach((cell, index) => {
    const row = Math.floor(index / board.columns);
    const column = index % board.columns;
    const { x, y } = cellToView({ row, column }, cellSize);
    if (prospective.has(index)) {
      outline(context, x, y, cellSize, INK, 2, 3, [2, 3]);
      drawBadge(context, '?', x + cellSize - 9, y + 9);
    }
    const ghost = proposed.get(index);
    if (ghost) {
      const conflict = ghost.status === 'conflict' || ghost.status === 'blocked';
      const blank = ghost.assignedLetter || preview?.rack?.allocations?.some((a) => a.index === index && a.blank);
      if (ghost.status === 'new') drawLetterTile(context, x, y, cellSize, ghost.letter, blank, true);
      outline(context, x, y, cellSize, preview?.legal ? INK : '#8c3936', 2, 4,
        ghost.status === 'reused' ? [] : [4, 3]);
      drawBadge(context, conflict ? `×${ghost.letter}` : ghost.status === 'reused' ? '=' : 'p',
        x + cellSize - (conflict ? 14 : 9), y + 9, 11, conflict ? 21 : 11);
      // Invalid reuse has an explicit cross too, rather than relying on rim color.
      if (!preview?.legal && !conflict) drawBadge(context, '×', x + cellSize - 9, y + cellSize - 10, 11);
      if (ghost.tileId !== undefined && ghost.tileId === selectedTileId) {
        outline(context, x, y, cellSize, INK, 3, 7);
      }
    }
    if (selected?.row === row && selected?.column === column) {
      outline(context, x, y, cellSize, '#fffdf6', 5, 2.5);
      outline(context, x, y, cellSize, INK, 3, 2.5);
    }
    if (drop?.row === row && drop?.column === column) {
      outline(context, x, y, cellSize, '#fffdf6', 6, 3);
      outline(context, x, y, cellSize, drop.legal ? INK : '#8c3936', 3, 3, drop.legal ? [] : [4, 3]);
      drawBadge(context, drop.legal ? '+' : '×', x + cellSize - 10, y + cellSize - 10, 14);
    }
  });
}

function outline(context, x, y, size, color, width, inset, dash = []) {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.setLineDash(dash);
  context.strokeRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
  context.setLineDash([]);
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
