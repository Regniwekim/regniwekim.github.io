import { isLetterCell } from '../core/letters.js';

// Original Wordstead artwork, authored as tiny rectangle motifs. No vendor pixels,
// font, image, private registry, decoding, timers or gameplay randomness are used.
export const ART = Object.freeze({ ink: '#354c43', meadow: '#bdd27e', cream: '#f5e8c8',
  oat: '#f0d7af', wood: '#a67c61', rim: '#846047', harvest: '#dce9b6' });
export const CONNECTION = Object.freeze({ north: 1, east: 2, south: 4, west: 8 });

/** View-only cardinal occupancy mask. Preview letters are never supplied here. */
export function connectionMask(board, row, column) {
  const index = row * board.columns + column;
  if (!isLetterCell(board.cells[index])) return 0;
  return (row > 0 && isLetterCell(board.cells[index - board.columns]) ? CONNECTION.north : 0)
    | (column + 1 < board.columns && isLetterCell(board.cells[index + 1]) ? CONNECTION.east : 0)
    | (row + 1 < board.rows && isLetterCell(board.cells[index + board.columns]) ? CONNECTION.south : 0)
    | (column > 0 && isLetterCell(board.cells[index - 1]) ? CONNECTION.west : 0);
}

/** Decoration is stable across redraws, boards, zoom and DPR; independent of RNG. */
export function decorationVariant(row, column) {
  return (Math.imul(row + 1, 374761393) ^ Math.imul(column + 1, 668265263)) >>> 0;
}

// Each motif fits a 16×16 square; rectangles are [color, x, y, width, height].
// The constant command lists are reused, rather than constructing textures on redraw.
const MOTIFS = {
  crop: [
    ['#a67c61', 2, 10, 12, 4], ['#cba57c', 3, 10, 10, 1], ['#846047', 3, 13, 10, 1],
    ['#4a6452', 5, 4, 1, 7], ['#4a6452', 10, 3, 1, 8],
    ['#648453', 2, 4, 3, 2], ['#648453', 6, 6, 3, 2], ['#648453', 11, 3, 3, 2],
    ['#91aa85', 3, 3, 2, 1], ['#91aa85', 7, 5, 2, 1], ['#91aa85', 8, 2, 2, 2],
    ['#e9c06d', 4, 8, 3, 3], ['#e9c06d', 9, 7, 3, 3], ['#f5e8c8', 4, 8, 1, 1],
  ],
  livestock: [
    ['#91aa85', 2, 13, 12, 1], ['#846047', 5, 11, 1, 3], ['#846047', 10, 11, 1, 3],
    ['#d4ba92', 3, 6, 9, 6], ['#f5e8c8', 2, 5, 9, 5], ['#fffdf6', 4, 4, 6, 4],
    ['#f5e8c8', 10, 3, 3, 7], ['#fffdf6', 10, 3, 2, 4],
    ['#c98189', 10, 1, 1, 2], ['#c98189', 12, 2, 1, 1],
    ['#e9c06d', 13, 5, 2, 1], ['#354c43', 11, 4, 1, 1], ['#c98189', 12, 7, 1, 2],
    ['#d4ba92', 4, 7, 3, 2], ['#f5e8c8', 1, 3, 2, 4],
  ],
  building: [
    ['#91aa85', 1, 14, 14, 1], ['#846047', 3, 6, 10, 8], ['#d6b58b', 4, 6, 8, 7],
    ['#c98189', 1, 6, 14, 2], ['#b36e72', 2, 5, 12, 1], ['#b36e72', 3, 4, 10, 1],
    ['#b36e72', 4, 3, 8, 1], ['#b36e72', 5, 2, 6, 1], ['#f0d7af', 6, 2, 4, 1],
    ['#a67c61', 4, 10, 8, 1], ['#354c43', 8, 9, 3, 5], ['#a67c61', 8, 9, 1, 5],
    ['#f5e8c8', 5, 8, 2, 2], ['#e9c06d', 10, 11, 1, 1],
  ],
  fertile: [
    ['#846047', 1, 5, 14, 9], ['#a67c61', 2, 5, 12, 8], ['#cba57c', 3, 6, 10, 1],
    ['#846047', 3, 9, 10, 1], ['#846047', 3, 12, 10, 1],
    ['#e9c06d', 4, 8, 1, 1], ['#e9c06d', 10, 11, 1, 1], ['#f5e8c8', 7, 11, 1, 1],
    ['#4a6452', 7, 3, 1, 6], ['#648453', 4, 2, 3, 2], ['#648453', 8, 1, 3, 2],
    ['#dce9b6', 5, 2, 2, 1], ['#dce9b6', 8, 1, 2, 1],
    ['#c98189', 12, 3, 2, 2], ['#f5e8c8', 13, 3, 1, 1],
  ],
};
const RAIL_DIRECTIONS = [[1, true, false], [2, false, true], [4, true, true], [8, false, false]];
const RAIL_OFFSETS = [-5, 3];
const motifSurfaces = new Map();

function motifSurface(type) {
  if (!motifSurfaces.has(type)) {
    let surface = null;
    try {
      if (typeof OffscreenCanvas === 'function') {
        surface = new OffscreenCanvas(16, 16);
        const ctx = surface.getContext('2d');
        if (!ctx) surface = null;
        else for (const [color, x, y, width, height] of MOTIFS[type]) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, width, height);
        }
      }
    } catch { surface = null; }
    // A failed optional cache is remembered. Primitive art remains the fallback.
    motifSurfaces.set(type, surface);
  }
  return motifSurfaces.get(type);
}

/** Ground layer. Capture/enclosure decisions are supplied by the board renderer. */
export function drawGround(ctx, x, y, size, row, column, { claimed, recent, enclosed }) {
  const variant = decorationVariant(row, column);
  ctx.fillStyle = claimed ? recent ? ART.harvest : '#dfc59d'
    : enclosed ? ART.cream : variant % 4 === 0 ? '#c1d585' : ART.meadow;
  ctx.fillRect(x, y, size, size);
  if (claimed) {
    ctx.fillStyle = recent ? '#c3d296' : '#c7a77d';
    for (let line = 1; line <= 3; line += 1) ctx.fillRect(x + 7, y + Math.round(size * line / 4), size - 14, 1);
  } else if (!enclosed && variant % 3 === 0) {
    const dx = x + 6 + variant % 7;
    const dy = y + size - 10 - (variant >>> 4) % 5;
    ctx.fillStyle = '#9fb86c';
    ctx.fillRect(dx, dy, 2, 4);
    ctx.fillRect(dx + 3, dy - 2, 2, 5);
    ctx.fillStyle = '#d5e39d';
    ctx.fillRect(x + size - 10, y + 8, 3, 2);
  }
  ctx.strokeStyle = '#8fa66c';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}

/** Two thin rails sit UNDER tiles. Each half-join stops at the adjacent cell. */
export function drawFence(ctx, x, y, size, mask) {
  const mid = Math.floor(size / 2);
  for (const [bit, vertical, far] of RAIL_DIRECTIONS) {
    if (!(mask & bit)) continue;
    const start = far ? mid : 0;
    for (const offset of RAIL_OFFSETS) {
      ctx.fillStyle = ART.rim;
      ctx.fillRect(x + (vertical ? mid + offset : start), y + (vertical ? start : mid + offset),
        vertical ? 3 : size / 2, vertical ? size / 2 : 3);
      ctx.fillStyle = ART.oat;
      ctx.fillRect(x + (vertical ? mid + offset : start), y + (vertical ? start : mid + offset),
        vertical ? 1 : size / 2, vertical ? size / 2 : 1);
    }
  }
}

/** Pixel blocks use whole CSS pixels at 2×/3×/4×; text remains native-resolution. */
export function drawFarmFeature(ctx, type, x, y, size) {
  const motif = MOTIFS[type];
  if (!motif) return; // Unknown optional art never prevents board initialization.
  const scale = Math.max(1, Math.floor((size - 6) / 16));
  const left = x + Math.floor((size - 16 * scale) / 2);
  const top = y + Math.floor((size - 16 * scale) / 2);
  const surface = typeof ctx.drawImage === 'function' ? motifSurface(type) : null;
  if (surface) {
    try {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(surface, left, top, 16 * scale, 16 * scale);
      return;
    } catch { motifSurfaces.set(type, null); }
  }
  for (const [color, dx, dy, width, height] of motif) {
    ctx.fillStyle = color;
    ctx.fillRect(left + dx * scale, top + dy * scale, width * scale, height * scale);
  }
}

export function drawLetterTile(ctx, x, y, size, letter, blank = false, provisional = false) {
  ctx.fillStyle = '#6b76594d';
  ctx.fillRect(x + 5, y + 7, size - 10, size - 10);
  ctx.fillStyle = provisional ? '#bda68a' : ART.rim;
  ctx.fillRect(x + 5, y + 4, size - 10, size - 10);
  ctx.fillStyle = provisional ? '#fff7e7' : ART.oat;
  ctx.fillRect(x + 7, y + 6, size - 14, size - 14);
  ctx.fillStyle = provisional ? '#fffdf6' : '#fae9cb';
  ctx.fillRect(x + 7, y + 6, size - 14, 2);
  ctx.fillStyle = provisional ? '#e8d9c1' : '#d6b58b';
  ctx.fillRect(x + 7, y + size - 10, size - 14, 2);
  ctx.fillStyle = ART.ink;
  ctx.font = `750 ${Math.round(size * 0.5)}px system-ui, sans-serif`;
  ctx.fillText(letter, x + size / 2, y + size / 2 + 1);
  if (blank) drawBadge(ctx, '◇', x + 9, y + 9, 11);
}

/** Small cream-backed symbols stay legible over every ground/feature variant. */
export function drawBadge(ctx, symbol, x, y, size = 12, width = size) {
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(x - width / 2, y - size / 2, width, size);
  ctx.fillStyle = ART.ink;
  ctx.font = `700 ${size - 1}px system-ui, sans-serif`;
  ctx.fillText(symbol, x, y);
}
