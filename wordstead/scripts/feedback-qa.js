import { createPuzzle } from '../src/core/puzzle.js';
import { createLetterCell } from '../src/core/letters.js';
import { createFeatureCell } from '../src/core/features.js';
import { drawBoard } from '../src/rendering/board.js';
import { initializeFeedback } from '../src/ui/feedback.js';
import { createSounds } from '../src/audio/sounds.js';
import { createDailySession } from '../src/daily/challenge.js';

const find = (id) => document.getElementById(id);
const puzzle = createPuzzle({ rows: 30, columns: 30 });
const indices = [], features = [], cells = [];
for (let row = 0; row < 30; row += 1) for (let column = 0; column < 30; column += 1) {
  const index = row * 30 + column;
  if (!row || !column || row === 29 || column === 29) {
    puzzle.board.cells[index] = createLetterCell('FARM'[index % 4]);
    if (row === 29) cells.push({ row, column });
  } else {
    puzzle.territory.claimed[index] = true; indices.push(index);
    if (index % 11 === 0) {
      const type = ['crop', 'fertile', 'livestock', 'building'][Math.floor(index / 11) % 4];
      puzzle.board.cells[index] = createFeatureCell(type); features.push({ index, type });
    }
  }
}
const view = { ...puzzle, evaluation: { enclosed: indices }, recentClaims: indices, cellSize: 44, selected: null };
const dailyPuzzle = createDailySession('2026-10-24').session.puzzle;
const motion = new EventTarget(), nativeMotion = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = false, draws = 0;
Object.defineProperty(motion, 'matches', { get: () => reduced || nativeMotion.matches });
nativeMotion.addEventListener('change', () => motion.dispatchEvent(new Event('change')));
const buttons = Array.from({ length: 9 }, (_, i) => {
  const button = document.createElement('button'); button.className = 'rack-tile'; button.textContent = 'WORDSTEAD'[i];
  find('rack').append(button); return button;
});
const feedback = initializeFeedback({ find, getView: () => view, rackButtons: buttons, motion,
  // This gallery never writes preferences or game saves.
  getStorage: () => ({ getItem: () => null, setItem() {} }) });
const capture = [{ type: 'word-accepted', cells }, { type: 'territory-captured', indices },
  { type: 'feature-captured', features }, { type: 'points-earned' }, { type: 'run-completed' }];
function render() { draws += 1; drawBoard(find('board'), view); }
for (const id of ['size', 'density']) find(id).addEventListener('change', () => {
  feedback.cancel(); view.cellSize = Number(find('size').value);
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: Number(find('density').value) });
  render();
});
find('reduced').addEventListener('click', () => {
  reduced = !reduced; find('reduced').textContent = `Reduce motion: ${reduced ? 'On' : 'Off'}`;
  find('reduced').setAttribute('aria-pressed', String(reduced)); motion.dispatchEvent(new Event('change'));
});
find('harvest').addEventListener('click', () => feedback.emit(capture));
const stats = (values) => {
  values.sort((a, b) => a - b);
  return { median: +values[Math.floor(values.length / 2)].toFixed(2), p95: +values[Math.floor(values.length * 0.95)].toFixed(2) };
};
find('measure').addEventListener('click', async () => {
  find('measure').disabled = true;
  const report = { cellSize: view.cellSize, dpr: window.devicePixelRatio, reduced: motion.matches };
  const measure = (action) => {
    for (let i = 0; i < 10; i += 1) action();
    return stats(Array.from({ length: 60 }, () => { const start = performance.now(); action(); return performance.now() - start; }));
  };
  report.redraw = measure(render);
  // Detached Canvas isolates command submission for the actual released Daily
  // opening. It does not measure compositor completion or physical-device FPS.
  const dailyCanvas = document.createElement('canvas');
  const dailyView = { ...dailyPuzzle, evaluation: { enclosed: [] }, recentClaims: [],
    selected: { row: 7, column: 7 }, cellSize: view.cellSize };
  report.dailyRedraw = measure(() => drawBoard(dailyCanvas, dailyView));
  report.dailyBackingBytes = dailyCanvas.width * dailyCanvas.height * 4;
  report.largeBackingBytes = find('board').width * find('board').height * 4;
  dailyCanvas.width = 0; dailyCanvas.height = 0;
  const before = draws;
  for (const [name, events] of [
    ['selection', [{ type: 'tile-selected' }]],
    ['placement', [{ type: 'tile-placed', cells: [{ row: 1, column: 1 }] }]],
    ['commitment', [capture[0]]], ['largeCapture', [capture[1]]],
    ['features', [capture[2]]], ['combined', capture],
  ]) report[name] = measure(() => feedback.emit(events));
  report.additionalBoardDraws = draws - before;
  report.peakOverlayNodes = find('board-feedback').children.length;
  // A bounded observation window tests settled idle state, never an idle game loop.
  await new Promise((resolve) => setTimeout(resolve, 650));
  report.idleOverlayNodes = find('board-feedback').children.length;
  report.idleAnimations = find('board-feedback').getAnimations({ subtree: true }).length;
  find('measurement').textContent = JSON.stringify(report);
  find('measure').disabled = false;
});
find('audio-check').addEventListener('click', async (event) => {
  try {
    const context = new OfflineAudioContext(1, 44100, 44100);
    const sounds = createSounds({ getStorage: () => ({ getItem: () => null, setItem() {} }),
      createContext: () => ({ state: 'running', currentTime: 0, destination: context.destination,
        createGain: () => context.createGain(), createOscillator: () => context.createOscillator() }) });
    sounds.setEnabled(true); sounds.activate(event); sounds.play(capture);
    const buffer = await context.startRendering(), samples = buffer.getChannelData(0);
    let peak = 0, square = 0;
    for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); square += sample * sample; }
    find('audio-report').textContent = JSON.stringify({ peak: +peak.toFixed(6), rms: +Math.sqrt(square / samples.length).toFixed(6),
      silentAfter550ms: samples.slice(Math.floor(0.55 * 44100)).every((sample) => sample === 0) });
  } catch (error) { find('audio-report').textContent = error.message; }
});
render();
