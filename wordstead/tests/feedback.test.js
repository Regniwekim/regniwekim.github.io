import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeFeedback, commitmentFeedback } from '../src/ui/feedback.js';
import { createEnclosureSession } from '../src/core/session-fixture.js';
import { createFarmSession } from '../src/core/farm-fixture.js';
import { commitSessionWord } from '../src/core/session.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';

const moves = [
  { word: 'CAR', row: 3, column: 3, orientation: 'horizontal' },
  { word: 'CAB', row: 3, column: 3, orientation: 'vertical' },
  { word: 'RAT', row: 3, column: 5, orientation: 'vertical' },
  { word: 'BAT', row: 5, column: 3, orientation: 'horizontal' },
];

test('commit feedback uses only accepted new letters, exact claims/rewards, and one won transition', () => {
  for (const type of [null, 'crop', 'fertile', 'livestock', 'building']) {
    let state = type ? createFarmSession(type) : createEnclosureSession();
    for (const [i, move] of moves.entries()) {
      const result = commitSessionWord(state, move, demoDictionary);
      const before = JSON.stringify(result);
      const events = commitmentFeedback(result, state.status);
      assert.equal(events.filter((event) => event.type === 'word-accepted').length, 1);
      assert.equal(events[0].cells, result.evaluation.newPositions);
      assert.equal(events[0].cells.length, [3, 2, 2, 1][i]);
      if (i === 3) {
        assert.equal(events.find((event) => event.type === 'territory-captured').indices, result.newlyClaimed);
        assert.deepEqual(result.newlyClaimed, [32]);
        if (type) assert.equal(events.find((event) => event.type === 'feature-captured').features, result.farmRewards.features);
        assert.equal(events.filter((event) => event.type === 'run-completed').length, Number(result.state.status === 'won'));
      } else assert.deepEqual(events.map((event) => event.type), ['word-accepted']);
      assert.equal(JSON.stringify(result), before);
      state = result.state;
    }
  }
});

function surface() {
  const listeners = new Map();
  return { children: [], style: {}, attributes: {},
    addEventListener(type, handler) { listeners.set(type, handler); },
    emit(type, event = {}) { listeners.get(type)?.(event); },
    append(child) { child.parent = this; this.children.push(child); },
    replaceChildren() { this.children = []; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); },
    setAttribute(key, value) { this.attributes[key] = value; },
    getBoundingClientRect() { return { left: 0, right: 400, top: 0, bottom: 400 }; },
    animate(frames, options) {
      let resolve, reject;
      const finished = new Promise((a, b) => { resolve = a; reject = b; });
      const animation = { frames, options, finished, finish: resolve, cancelled: false,
        cancel() { this.cancelled = true; reject(new Error('cancelled')); } };
      this.animations ??= []; this.animations.push(animation);
      return animation;
    },
    getContext() { return new Proxy({}, { get: () => () => {} }); },
  };
}
function harness() {
  const nodes = new Map(), find = (id) => {
    if (!nodes.has(id)) nodes.set(id, surface());
    return nodes.get(id);
  };
  const doc = { ...surface(), hidden: false, createElementNS: surface, createElement: surface };
  const host = surface(), motion = { ...surface(), matches: false };
  const sounds = { enabled: false, calls: [], stops: 0, play(events) { this.calls.push(events); },
    stop() { this.stops += 1; }, setEnabled(value) { this.enabled = value; }, activate() {} };
  const view = { board: { rows: 30, columns: 30 }, cellSize: 44 };
  const feedback = initializeFeedback({ find, getView: () => view, rackButtons: [surface()], doc, host, motion, sounds });
  return { find, doc, host, motion, sounds, feedback, view };
}

test('900-cell harvest groups remain bounded, finish idle, and never mutate frozen input', async () => {
  const h = harness(), indices = Object.freeze(Array.from({ length: 900 }, (_, i) => i));
  const event = Object.freeze({ type: 'territory-captured', indices });
  for (let i = 0; i < 50; i += 1) {
    h.feedback.emit(event);
    assert.equal(h.find('board-feedback').children.length, 3);
  }
  const nodes = [...h.find('board-feedback').children];
  const rectangles = nodes.reduce((total, node) => total + (node.children[0].attributes.d.match(/M/g)?.length ?? 0), 0);
  assert.equal(rectangles, 900);
  assert.ok(nodes.every((node) => node.animations[0].options.duration + node.animations[0].options.delay <= 430));
  for (const node of nodes) node.animations[0].finish();
  await Promise.resolve();
  assert.equal(h.find('board-feedback').children.length, 0);
  assert.equal(indices.length, 900);
});

test('effects cancel on board lifecycle, page hide and runtime motion changes; audio stays independent', async () => {
  const h = harness();
  const event = { type: 'tile-placed', cells: [{ row: 3, column: 4 }] };
  h.feedback.emit(event);
  const node = h.find('board-feedback').children[0];
  assert.match(node.children[0].attributes.d, /^M4 4/);
  assert.equal(node.style.left, '204px'); assert.equal(node.style.top, '160px');
  assert.equal(node.style.width, '44px'); assert.equal(node.style.height, '44px');
  h.feedback.cancel();
  assert.equal(node.animations[0].cancelled, true);
  h.feedback.emit(event);
  await Promise.resolve(); // A cancelled old callback cannot remove a new effect.
  assert.equal(h.find('board-feedback').children.length, 1);
  h.motion.matches = true; h.motion.emit('change');
  assert.equal(h.find('board-feedback').children.length, 0);
  const soundCount = h.sounds.calls.length;
  h.feedback.emit(event);
  assert.equal(h.find('board-feedback').children.length, 0);
  assert.equal(h.sounds.calls.length, soundCount + 1);
  h.motion.matches = false; h.feedback.emit(event);
  h.doc.hidden = true; h.doc.emit('visibilitychange');
  assert.equal(h.find('board-feedback').children.length, 0);
  h.feedback.emit(event);
  assert.equal(h.sounds.calls.length, soundCount + 2);
  h.doc.hidden = false; h.feedback.emit(event); h.host.emit('pagehide');
  assert.equal(h.find('board-feedback').children.length, 0);
});

test('each feature uses actual indices and has a distinct treatment; visible animal surfaces are capped', () => {
  const h = harness();
  const features = ['crop', 'fertile', 'livestock', 'building'].map((type, index) => ({ type, index }));
  h.feedback.emit({ type: 'feature-captured', features });
  assert.deepEqual(h.find('board-feedback').children.slice(0, 4).map((node) => node.attributes.class),
    ['feedback-path feedback-crop', 'feedback-path feedback-fertile', 'feedback-path feedback-livestock', 'feedback-path feedback-building']);
  h.feedback.emit({ type: 'feature-captured', features: Array.from({ length: 900 }, (_, index) => ({ type: 'livestock', index })) });
  assert.ok(h.find('board-feedback').children.length <= 25);
  h.feedback.cancel();
});

test('overlays are inert and pointer-ignoring and effects have no idle loop or model imports', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');
  const source = await readFile(new URL('../src/ui/feedback.js', import.meta.url), 'utf8');
  assert.match(html, /id="board-feedback" aria-hidden="true" inert/);
  assert.match(css, /#board-feedback \* \{ pointer-events: none;/);
  assert.doesNotMatch(source, /requestAnimationFrame|setInterval|setTimeout|\.\.\/core\//);
});
