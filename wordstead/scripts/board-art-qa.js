import { drawBoard } from '../src/rendering/board.js';
import { createSession, commitSessionWord, evaluateSessionPlacement } from '../src/core/session.js';
import { createFarmSession } from '../src/core/farm-fixture.js';
import { ENCLOSURE_MOVES } from '../src/core/session-fixture.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { evaluateTerritory } from '../src/core/territory.js';
import { createBoard } from '../src/core/board.js';
import { createPuzzle } from '../src/core/puzzle.js';
import { setLetter } from '../src/core/letters.js';
import { placeFeature } from '../src/core/features.js';

const find = (id) => document.getElementById(id);
const nativeDpr = window.devicePixelRatio;
const samples = [];
function sample(label, state, extra = {}) {
  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = label;
  const viewport = document.createElement('div');
  viewport.className = 'board-viewport';
  viewport.style.marginBlock = '1rem';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', label);
  viewport.append(canvas);
  section.append(title, viewport);
  find('samples').append(section);
  samples.push({ canvas, state, extra });
}
function view(state, extra = {}) {
  const { board, territory } = state.puzzle;
  return { board, territory, evaluation: evaluateTerritory(board, territory),
    recentClaims: [], selected: { row: 0, column: 0 }, cellSize: Number(find('size').value), ...extra };
}
sample('Empty generated farm · all four feature types', createSession({ farmSeed: 'art-qa', farmDensity: 0.2 }));
for (const type of ['crop', 'livestock', 'building', 'fertile']) {
  let state = createFarmSession(type);
  for (const move of ENCLOSURE_MOVES.slice(0, 3)) {
    state = commitSessionWord(state, move, demoDictionary).state;
    if (type === 'crop') sample(`${state.puzzle.wordCount} committed word(s) · corners and intersections`, state);
  }
  const preview = evaluateSessionPlacement(state, ENCLOSURE_MOVES[3], demoDictionary);
  sample(`${type} · previewed enclosure (unclaimed)`, state,
    { preview, previewTerritory: evaluateTerritory(preview.proposedBoard, state.puzzle.territory) });
  const result = commitSessionWord(state, ENCLOSURE_MOVES[3], demoDictionary);
  sample(`${type} · recently captured (+), identity retained`, result.state, { recentClaims: result.newlyClaimed });
  sample(`${type} · earlier capture (✓), identity retained`, result.state);
}
// Small, explicitly synthetic presentation board for every mask and overlay.
let board = createBoard({ rows: 4, columns: 7 });
for (const [row, column] of [[0, 0], [0, 1], [0, 2], [1, 1], [1, 3], [2, 2], [2, 3], [2, 4], [3, 3]]) {
  board = setLetter(board, row, column, 'A');
}
board.cells[1] = { ...board.cells[1], blank: true };
for (const [column, type] of ['crop', 'livestock', 'building', 'fertile'].entries()) board = placeFeature(board, 0, column + 3, type);
const state = { puzzle: { ...createPuzzle({ rows: 4, columns: 7 }), board } };
sample('Assigned blank ◇ · reused = · draft p · conflict × · selected cell · valid drop +', state, {
  selected: { row: 0, column: 1 }, drop: { row: 3, column: 5, legal: true },
  preview: { legal: true, positions: [{ index: 1, letter: 'A', status: 'reused' },
    { index: 8, letter: 'Z', status: 'conflict' }] },
  draft: { tiles: [{ row: 1, column: 5, letter: 'W', tileId: 98, assignedLetter: 'W' },
    { row: 1, column: 6, letter: 'I', tileId: 5 }] }, selectedTileId: 98,
});
sample('Invalid preview × · invalid drop × · available features', state, {
  preview: { legal: false, positions: [{ index: 1, letter: 'A', status: 'reused' },
    { index: 13, letter: 'Q', status: 'new' }] }, drop: { row: 0, column: 4, legal: false },
});
const unclaimed = { puzzle: { ...state.puzzle, territory: { ...state.puzzle.territory, claimed: Array(28).fill(false) } } };
sample('Diagnostic enclosure · dashed border, no capture', unclaimed, { evaluation: { enclosed: [10, 11, 12] } });
let alphabet = createBoard({ rows: 4, columns: 7 });
for (const [index, letter] of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].entries()) {
  alphabet = setLetter(alphabet, Math.floor(index / 7), index % 7, letter);
}
alphabet.cells[25] = { ...alphabet.cells[25], blank: true };
sample('All 26 system glyphs · dense committed fence · assigned Z blank',
  { puzzle: { ...createPuzzle({ rows: 4, columns: 7 }), board: alphabet } });
const land = createPuzzle({ rows: 1, columns: 5 });
land.territory.claimed[1] = true;
land.territory.claimed[2] = true;
sample('Ground: meadow · older claim ✓ · recent claim + · prospective ? · enclosed unclaimed',
  { puzzle: land }, { selected: null, recentClaims: [2], evaluation: { enclosed: [4] },
    previewTerritory: { newlyClaimed: [3] } });
let large = createSession({ rows: 30, columns: 30, farmSeed: 'art-benchmark', farmDensity: 0.12 });
board = large.puzzle.board;
for (let index = 0; index < board.cells.length; index += 1) {
  if (board.cells[index] === null && (Math.floor(index / 30) % 4 === 1 || index % 30 === 3)) {
    board = setLetter(board, Math.floor(index / 30), index % 30, 'FARM'[index % 4]);
  }
}
large = { ...large, puzzle: { ...large.puzzle, board } };
function render() {
  for (const { canvas, state, extra } of samples) drawBoard(canvas, view(state, extra));
  drawBoard(find('large'), view(large));
}
find('size').addEventListener('change', render);
find('density').addEventListener('change', () => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true,
    value: find('density').value === 'native' ? nativeDpr : Number(find('density').value) });
  render();
});
find('benchmark').addEventListener('click', () => {
  const options = view(large);
  for (let i = 0; i < 10; i += 1) drawBoard(find('large'), options);
  const timings = [];
  for (let i = 0; i < 60; i += 1) {
    const start = performance.now();
    drawBoard(find('large'), options);
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  find('timing').textContent = `${options.cellSize}px, DPR ${window.devicePixelRatio}: ` +
    `median ${timings[30].toFixed(2)}ms, p95 ${timings[57].toFixed(2)}ms, ` +
    `mean ${(timings.reduce((a, b) => a + b) / 60).toFixed(2)}ms (60 draws).`;
});
render();
