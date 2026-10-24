import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../src/core/board.js';
import { pointerToCell, cellToView, drawBoard } from '../src/rendering/board.js';
import { connectionMask, CONNECTION, decorationVariant, drawFarmFeature, drawFence } from '../src/rendering/artwork.js';
import { createLetterCell } from '../src/core/letters.js';
import { createFeatureCell } from '../src/core/features.js';
import { createTerritory } from '../src/core/territory.js';

test('pointer mapping ignores backing pixels and inverts CSS scale and scroll offset', () => {
  const board = createBoard({ rows: 6, columns: 9 });
  for (const scale of [0.75, 1, 1.5]) {
    for (const cellSize of [44, 56, 72]) {
      const rect = { left: -190, top: -75, width: (28 + 9 * cellSize) * scale, height: (28 + 6 * cellSize) * scale };
      const canvas = { width: 9999, height: 9999, getBoundingClientRect: () => rect };
      for (const [row, column] of [[0, 0], [2, 3], [5, 8]]) {
        const x = rect.left + (28 + (column + 0.5) * cellSize) * scale;
        const y = rect.top + (28 + (row + 0.5) * cellSize) * scale;
        assert.deepEqual(pointerToCell(canvas, board, cellSize, x, y), { row, column });
      }
    }
  }
});

test('label gutters and points outside the logical board are not cells', () => {
  const board = createBoard({ rows: 2, columns: 3 });
  const canvas = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 160, height: 116 }) };
  for (const [x, y] of [[10, 20], [37, 70], [60, 47], [170, 60], [60, 136], [-1, 70]]) {
    assert.equal(pointerToCell(canvas, board, 44, x, y), null);
  }
  assert.deepEqual(pointerToCell(canvas, board, 44, 38, 48), { row: 0, column: 0 });
  assert.deepEqual(pointerToCell(canvas, board, 44, 169.9, 135.9), { row: 1, column: 2 });
});

test('view positioning retains square cells and the 28px label gutter at all supported sizes', () => {
  for (const size of [44, 56, 72]) {
    assert.deepEqual(cellToView({ row: 0, column: 0 }, size), { x: 28, y: 28 });
    assert.deepEqual(cellToView({ row: 29, column: 29 }, size), { x: 28 + 29 * size, y: 28 + 29 * size });
  }
});

test('all 16 cardinal masks cover isolated letters, runs, corners, T and four-way junctions', () => {
  assert.deepEqual(CONNECTION, { north: 1, east: 2, south: 4, west: 8 });
  for (let mask = 0; mask < 16; mask += 1) {
    const board = createBoard({ rows: 3, columns: 3 });
    board.cells[4] = createLetterCell('A');
    for (const [index, bit] of [[1, 1], [5, 2], [7, 4], [3, 8]]) {
      if (mask & bit) board.cells[index] = createLetterCell('B');
    }
    assert.equal(connectionMask(board, 1, 1), mask);
    const ctx = recordingContext();
    drawFence(ctx, 28, 28, 44, mask);
    assert.equal(ctx.calls.filter((c) => c.method === 'fillRect').length,
      [...mask.toString(2)].filter((bit) => bit === '1').length * 4);
  }
});

test('connections never wrap rows, include diagonals/features, or count board edges', () => {
  const board = createBoard({ rows: 3, columns: 3 });
  for (const index of [0, 2, 4, 6, 8]) board.cells[index] = createLetterCell('A');
  for (const type of ['crop', 'livestock', 'building', 'fertile']) {
    board.cells[1] = createFeatureCell(type);
    for (const index of [0, 2, 4, 6, 8]) {
      assert.equal(connectionMask(board, Math.floor(index / 3), index % 3), 0);
    }
    assert.equal(connectionMask(board, 0, 1), 0);
  }
  assert.equal(connectionMask({ rows: 1, columns: 1, cells: [createLetterCell('A')] }, 0, 0), 0);
  const row = { rows: 1, columns: 2, cells: [createLetterCell('A'), createLetterCell('B')] };
  assert.equal(connectionMask(row, 0, 0), CONNECTION.east);
  assert.equal(connectionMask(row, 0, 1), CONNECTION.west);
  const column = { rows: 2, columns: 1, cells: row.cells };
  assert.equal(connectionMask(column, 0, 0), CONNECTION.south);
  assert.equal(connectionMask(column, 1, 0), CONNECTION.north);
});

function recordingContext() {
  return { calls: [], dash: [],
    setTransform(...args) { this.calls.push({ method: 'transform', args }); },
    setLineDash(dash) { this.dash = dash; },
    fillRect(...args) { this.calls.push({ method: 'fillRect', args, color: this.fillStyle }); },
    strokeRect(...args) { this.calls.push({ method: 'strokeRect', args, color: this.strokeStyle,
      width: this.lineWidth, dash: this.dash }); },
    fillText(...args) { this.calls.push({ method: 'text', args, color: this.fillStyle }); },
  };
}
function frozen(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
const testWindows = new WeakMap();
function renderHarness(t, options, dpr = 1) {
  if (!testWindows.has(t)) {
    testWindows.set(t, globalThis.window);
    t.after(() => { globalThis.window = testWindows.get(t); testWindows.delete(t); });
  }
  globalThis.window = { devicePixelRatio: dpr };
  const ctx = recordingContext();
  const canvas = { style: {}, getContext: () => ctx };
  const view = { board: options.board, territory: createTerritory(options.board), evaluation: { enclosed: [] },
    recentClaims: [], selected: { row: 0, column: 0 }, cellSize: 44, ...options };
  const before = JSON.stringify(view);
  frozen(view);
  drawBoard(canvas, view);
  assert.equal(JSON.stringify(view), before);
  return { ctx, canvas, view };
}

test('decorative variation is deterministic, does not use randomness, and repeats exact drawing commands', (t) => {
  const oldRandom = Math.random;
  Math.random = () => { throw new Error('Rendering must not use gameplay randomness'); };
  t.after(() => { Math.random = oldRandom; });
  const variants = [];
  for (let row = 0; row < 30; row += 1) for (let column = 0; column < 30; column += 1) {
    const variant = decorationVariant(row, column);
    assert.equal(variant, decorationVariant(row, column));
    assert.ok(Number.isSafeInteger(variant) && variant >= 0);
    variants.push(variant);
  }
  assert.ok(new Set(variants).size > 850);
  const { ctx, canvas, view } = renderHarness(t, { board: createBoard({ rows: 3, columns: 7 }) });
  const first = ctx.calls;
  ctx.calls = [];
  drawBoard(canvas, view);
  assert.deepEqual(ctx.calls, first);
});

test('all original feature motifs are distinct, remain within one cell, and tolerate unavailable optional art', () => {
  const motifs = new Set();
  for (const size of [44, 56, 72]) for (const type of ['crop', 'livestock', 'building', 'fertile']) {
    const ctx = recordingContext();
    drawFarmFeature(ctx, type, 28, 28, size);
    assert.ok(ctx.calls.length > 10);
    motifs.add(JSON.stringify(ctx.calls));
    for (const { args: [x, y, width, height] } of ctx.calls) {
      assert.ok([x, y, width, height].every(Number.isInteger));
      assert.ok(x >= 28 && y >= 28 && x + width <= 28 + size && y + height <= 28 + size);
    }
  }
  assert.equal(motifs.size, 12);
  assert.doesNotThrow(() => drawFarmFeature(recordingContext(), 'unavailable', 0, 0, 44));
});

test('optional motif cache is reused across zooms and failures fall back to original primitives', async (t) => {
  const oldCanvas = globalThis.OffscreenCanvas;
  t.after(() => { globalThis.OffscreenCanvas = oldCanvas; });
  let allocations = 0;
  globalThis.OffscreenCanvas = class {
    constructor(width, height) { allocations += 1; assert.equal(width, 16); assert.equal(height, 16); }
    getContext() { return recordingContext(); }
  };
  // Isolate this cache from other renderer tests.
  const cached = await import('../src/rendering/artwork.js?cache-test');
  const ctx = recordingContext();
  const images = [];
  ctx.drawImage = (...args) => images.push(args);
  for (const size of [44, 56, 72, 44]) cached.drawFarmFeature(ctx, 'crop', 28, 28, size);
  assert.equal(allocations, 1);
  assert.equal(images.length, 4);
  assert.equal(images[0][0], images[3][0]);
  assert.equal(ctx.imageSmoothingEnabled, false);
  ctx.drawImage = () => { throw new Error('Optional cached image unavailable'); };
  assert.doesNotThrow(() => cached.drawFarmFeature(ctx, 'crop', 28, 28, 44));
  assert.ok(ctx.calls.length > 10);
  globalThis.OffscreenCanvas = class { constructor() { throw new Error('Optional surface unavailable'); } };
  assert.doesNotThrow(() => cached.drawFarmFeature(ctx, 'building', 28, 28, 44));
  assert.ok(ctx.calls.length > 10);
});

test('draft and preview letters never add committed fence rails', (t) => {
  const board = createBoard({ rows: 1, columns: 3 });
  board.cells[0] = createLetterCell('C');
  const { ctx } = renderHarness(t, { board,
    preview: { legal: true, positions: [{ index: 1, letter: 'A', status: 'new' }] },
    draft: { tiles: [{ row: 0, column: 2, letter: 'T', tileId: 80 }] } });
  assert.equal(ctx.calls.filter((c) => c.method === 'fillRect' && c.color === '#846047'
    && (c.args[2] === 3 || c.args[3] === 3)).length, 0);
});

test('high-DPI redraw preserves CSS geometry, backing-store reuse, crisp glyphs and permanent blank clues', (t) => {
  for (const size of [44, 56, 72]) for (const dpr of [1, 1.25, 2, 3]) {
    const board = createBoard({ rows: 2, columns: 3 });
    board.cells[1] = { ...createLetterCell('W'), blank: true };
    const { ctx, canvas, view } = renderHarness(t, { board, cellSize: size }, dpr);
    assert.equal(canvas.width, Math.round((28 + 3 * size) * dpr));
    assert.equal(canvas.height, Math.round((28 + 2 * size) * dpr));
    assert.equal(canvas.style.width, `${28 + 3 * size}px`);
    assert.equal(canvas.style.height, `${28 + 2 * size}px`);
    assert.equal(ctx.imageSmoothingEnabled, false);
    assert.ok(ctx.calls.some((c) => c.method === 'text' && c.args[0] === 'W'
      && c.args[1] === 28 + size * 1.5 && c.args[2] === 29 + size / 2));
    assert.ok(ctx.calls.some((c) => c.method === 'text' && c.args[0] === '◇'));
    let resets = 0;
    for (const key of ['width', 'height']) {
      const stored = canvas[key];
      Object.defineProperty(canvas, key, { get: () => stored, set: () => { resets += 1; } });
    }
    drawBoard(canvas, view);
    assert.equal(resets, 0);
  }
});

test('claim badges and prospective outlines retain every farm identity without claiming previewed land', (t) => {
  for (const type of ['crop', 'livestock', 'building', 'fertile']) {
    for (const state of ['available', 'enclosed', 'preview', 'captured', 'recent']) {
      const board = createBoard({ rows: 1, columns: 1 });
      board.cells[0] = createFeatureCell(type);
      const claimed = state === 'captured' || state === 'recent';
      const { ctx } = renderHarness(t, { board, territory: { claimed: [claimed] },
        evaluation: { enclosed: state === 'enclosed' ? [0] : [] },
        previewTerritory: state === 'preview' ? { newlyClaimed: [0] } : null,
        recentClaims: state === 'recent' ? [0] : [], selected: null });
      const motif = recordingContext();
      drawFarmFeature(motif, type, 28, 28, 44);
      const first = ctx.calls.findIndex((c) => JSON.stringify(c) === JSON.stringify(motif.calls[0]));
      assert.deepEqual(ctx.calls.slice(first, first + motif.calls.length), motif.calls);
      const symbols = ctx.calls.filter((c) => c.method === 'text').map((c) => c.args[0]);
      const badge = ({ preview: '?', captured: '✓', recent: '+' })[state];
      if (badge) assert.ok(symbols.includes(badge));
      const ground = ctx.calls.find((c) => c.method === 'fillRect' && c.args[0] === 28 && c.args[2] === 44);
      assert.equal(ground.color, claimed ? state === 'recent' ? '#dce9b6' : '#dfc59d'
        : state === 'enclosed' ? '#f5e8c8' : '#bdd27e');
    }
  }
});

test('glyphs precede reuse/draft/conflict indicators; selection and explicit drop shapes are last', (t) => {
  const board = createBoard({ rows: 1, columns: 4 });
  board.cells[0] = { ...createLetterCell('C'), blank: true };
  const { ctx } = renderHarness(t, { board, selected: { row: 0, column: 1 },
    draft: { tiles: [{ row: 0, column: 1, letter: 'A', assignedLetter: 'A', tileId: 98 }] },
    selectedTileId: 98, drop: { row: 0, column: 1, legal: false },
    preview: { legal: false, positions: [{ index: 0, letter: 'C', status: 'reused' },
      { index: 2, letter: 'Z', status: 'conflict' }] } });
  const texts = ctx.calls.filter((c) => c.method === 'text').map((c) => c.args[0]);
  for (const text of ['C', 'A', '◇', '=', 'p', '×', '×Z']) assert.ok(texts.includes(text));
  assert.ok(texts.indexOf('C') < texts.indexOf('='));
  assert.ok(texts.indexOf('A') < texts.indexOf('p'));
  const drop = ctx.calls.findIndex((c) => c.method === 'strokeRect' && c.args[0] === 75 && c.width === 3);
  const selection = ctx.calls.findIndex((c) => c.method === 'strokeRect' && c.args[0] === 74.5 && c.width === 3);
  assert.ok(drop > selection && selection > 0);
  assert.deepEqual(ctx.calls[drop].dash, [4, 3]);
});
