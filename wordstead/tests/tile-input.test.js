import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeTileInput } from '../src/ui/tile-input.js';
import { createDraft } from '../src/core/draft.js';
import { createEnclosureSession } from '../src/core/session-fixture.js';

// Small event-surface double: exercise gesture transactions without a browser,
// a DOM library, or dispatching synthetic events into production game state.
class Element {
  listeners = new Map();
  children = [];
  dataset = {};
  style = {};
  attributes = {};
  hidden = true;
  open = false;
  captures = new Set();
  rect = { left: 0, top: 0, right: 336, bottom: 336, width: 336, height: 336 };
  addEventListener(type, listener) {
    this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]);
  }
  emit(type, properties = {}) {
    const event = { isPrimary: true, button: 0, pointerId: 1, clientX: 20, clientY: 420,
      preventDefault() {}, ...properties };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
  append(child) { this.children.push(child); }
  remove() { this.removed = true; }
  focus() { document.activeElement = this; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
}

function harness(t, blank = false) {
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  const elements = new Map();
  const find = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  globalThis.document = { getElementById: find, createElement: () => new Element(), activeElement: null };
  globalThis.window = new Element();
  const events = window;
  t.after(() => { globalThis.document = oldDocument; globalThis.window = oldWindow; });
  const state = createEnclosureSession();
  if (blank) { // Move an actual physical blank out of the bag, keeping all 100 IDs.
    const index = state.bag.findIndex((tile) => tile.letter === null);
    [state.rack[1], state.bag[index]] = [state.bag[index], state.rack[1]];
  }
  let draft = createDraft();
  let enabled = true;
  const buttons = state.rack.map((tile, slot) => {
    const button = new Element();
    button.dataset.tileId = String(tile.id);
    button.rect = { left: slot * 50, right: slot * 50 + 44, top: 400, bottom: 456, width: 44, height: 56 };
    return button;
  });
  let lastMessage = '', redraws = 0;
  const feedback = [];
  const input = initializeTileInput({ canvas: find('board'), viewport: find('viewport'), rackButtons: buttons,
    enabled: () => enabled, getState: () => state, getDraft: () => draft,
    setDraft: (value) => { draft = value; }, getCellSize: () => 44, selectCell() {},
    feedback: (event) => feedback.push(event),
    redraw: () => { redraws += 1; },
    refresh(message) { lastMessage = message ?? lastMessage; input.render(); } });
  input.render();
  const point = (row, column) => ({ clientX: 28 + (column + 0.5) * 44, clientY: 28 + (row + 0.5) * 44 });
  function dragStart(slot, type = 'touch') {
    buttons[slot].emit('pointerdown', { pointerType: type, clientX: slot * 50 + 20 });
  }
  return { input, buttons, state, find, events, point, dragStart, feedback,
    get draft() { return draft; }, get message() { return lastMessage; },
    get redraws() { return redraws; },
    disable() { enabled = false; input.reset(); input.render(); } };
}

test('drag samples within one logical cell update the ghost without redundant board redraws', (t) => {
  const h = harness(t);
  h.dragStart(0);
  const destination = h.point(3, 3);
  h.events.emit('pointermove', destination);
  assert.equal(h.redraws, 1);
  for (let i = 0; i < 100; i += 1) {
    h.events.emit('pointermove', { ...destination, clientX: destination.clientX + i % 10 });
  }
  assert.equal(h.redraws, 1);
  assert.equal(h.find('tile-ghost').style.left, `${destination.clientX + 9 + 12}px`);
  assert.equal(h.draft.tiles.length, 0);
  h.events.emit('pointermove', h.point(3, 4));
  assert.equal(h.redraws, 2);
  h.events.emit('pointermove', { clientX: -10, clientY: -10 });
  assert.equal(h.redraws, 3);
  h.events.emit('pointermove', { clientX: -20, clientY: -20 });
  assert.equal(h.redraws, 3);
  // Release uses its own coordinates, not the cached hover destination.
  h.events.emit('pointerup', destination);
  assert.equal(h.draft.tiles.length, 1);
  assert.equal(h.draft.tiles[0].column, 3);
});

test('selection, switching and repeated cancellation never mutate physical resources or draft', (t) => {
  const h = harness(t);
  const original = h.draft;
  const before = JSON.stringify(h.state);
  for (let i = 0; i < 5; i += 1) {
    h.buttons[1].emit('click');
    assert.equal(h.input.selected.tileId, h.state.rack[1].id);
    h.buttons[3].emit('click');
    assert.equal(h.input.selected.tileId, h.state.rack[3].id); // Distinct duplicate A.
    h.buttons[3].emit('click');
    assert.equal(h.input.selected, null);
  }
  h.buttons[0].emit('click');
  h.events.emit('keydown', { key: 'Escape' });
  assert.equal(h.input.selected, null);
  assert.equal(h.draft, original);
  assert.equal(JSON.stringify(h.state), before);
});

test('tile feedback occurs once at accepted placement/movement/return, never in drag previews or renders', (t) => {
  const h = harness(t);
  h.buttons[0].emit('click');
  h.input.activateCell({ row: 3, column: 3 });
  assert.deepEqual(h.feedback.map((event) => event.type), ['tile-selected', 'tile-placed']);
  for (let i = 0; i < 20; i += 1) h.input.render();
  assert.equal(h.feedback.length, 2);
  const handle = h.find('draft-handles').children[0];
  handle.emit('pointerdown', h.point(3, 3));
  for (let i = 0; i < 20; i += 1) h.events.emit('pointermove', h.point(2, 2));
  assert.equal(h.feedback.length, 2);
  h.events.emit('pointerup', h.point(2, 2));
  assert.deepEqual(h.feedback.at(-1), { type: 'tile-moved', cells: [{ row: 2, column: 2 }] });
  handle.emit('click'); // Suppressed compatibility click.
  handle.emit('click'); // Explicit pickup.
  h.find('return-tile').emit('click');
  assert.deepEqual(h.feedback.at(-1), { type: 'tile-returned', slots: [0] });
  h.buttons[0].emit('click'); h.input.activateCell({ row: 3, column: 3 });
  h.buttons[1].emit('click');
  const before = h.draft, count = h.feedback.length;
  h.input.activateCell({ row: 4, column: 4 });
  assert.equal(h.draft, before);
  assert.deepEqual(h.feedback.slice(count), [{ type: 'placement-rejected' }]);
  h.dragStart(1); h.events.emit('pointermove', h.point(4, 4));
  assert.equal(h.feedback.length, count + 1);
  h.events.emit('pointercancel');
  assert.equal(h.feedback.length, count + 1);
});

test('subthreshold touch movement remains a tap; drag preview is reversible until release and suppresses click', (t) => {
  const h = harness(t);
  const original = h.draft;
  h.dragStart(0);
  h.events.emit('pointermove', { clientX: 24, clientY: 424, pointerType: 'touch' });
  h.events.emit('pointerup', { clientX: 24, clientY: 424 });
  h.buttons[0].emit('click');
  assert.equal(h.input.selected.tileId, h.state.rack[0].id);
  h.dragStart(0);
  h.events.emit('pointermove', h.point(3, 3));
  assert.equal(h.draft, original);
  assert.equal(h.input.drop.legal, true);
  assert.equal(h.find('tile-ghost').hidden, false);
  h.events.emit('pointerup', h.point(3, 3));
  assert.equal(h.draft.tiles.length, 1);
  assert.equal(h.input.selected, null);
  h.buttons[0].emit('click'); // Compatibility click from the same drag must do nothing.
  assert.equal(h.input.selected, null);
  assert.equal(h.draft.tiles.length, 1);
  assert.equal(h.find('tile-ghost').hidden, true);
});

test('mouse drag and invalid destination preserve the previous draft and selected tile exactly', (t) => {
  const h = harness(t);
  h.buttons[0].emit('click');
  h.input.activateCell({ row: 3, column: 3 });
  h.buttons[1].emit('click');
  const selected = h.input.selected;
  const original = h.draft;
  h.dragStart(1, 'mouse');
  h.events.emit('pointermove', h.point(4, 4));
  assert.equal(h.input.drop.legal, false);
  h.events.emit('pointerup', h.point(4, 4));
  h.buttons[1].emit('click');
  assert.equal(h.draft, original);
  assert.equal(h.input.selected, selected);
  assert.match(h.message, /Drop rejected/);
  const handle = h.find('draft-handles').children.find((button) => !button.removed);
  handle.emit('click'); // Selected A cannot overwrite draft C.
  assert.equal(h.draft, original);
  assert.equal(h.input.selected, selected);
  assert.match(h.message, /Another draft tile/);
});

test('outside release, pointercancel, lost capture, blur and mode switch cannot publish a drag', (t) => {
  const h = harness(t);
  for (const cancellation of ['outside', 'pointercancel', 'lostpointercapture', 'blur', 'mode']) {
    const original = h.draft;
    h.dragStart(0);
    h.events.emit('pointermove', h.point(3, 3));
    if (cancellation === 'outside') h.events.emit('pointerup', { clientX: -20, clientY: -20 });
    else if (cancellation === 'lostpointercapture') h.buttons[0].emit(cancellation);
    else if (cancellation === 'mode') h.disable();
    else h.events.emit(cancellation);
    assert.equal(h.draft, original, cancellation);
    assert.equal(h.input.drop, null);
    assert.equal(h.find('tile-ghost').hidden, true);
  }
});

test('draft handle drag moves and returns the correct physical tile to its original rack slot', (t) => {
  const h = harness(t);
  const before = JSON.stringify(h.state);
  h.buttons[0].emit('click');
  h.input.activateCell({ row: 3, column: 3 });
  const handle = h.find('draft-handles').children[0];
  handle.emit('pointerdown', h.point(3, 3));
  h.events.emit('pointermove', h.point(2, 2));
  h.events.emit('pointerup', h.point(2, 2));
  handle.emit('click');
  assert.equal(h.draft.tiles.length, 1);
  assert.equal(h.draft.tiles[0].tileId, h.state.rack[0].id);
  assert.equal(h.draft.tiles[0].row, 2);
  handle.emit('pointerdown', h.point(2, 2));
  h.events.emit('pointermove', { clientX: 20, clientY: 420 });
  h.events.emit('pointerup', { clientX: 20, clientY: 420 });
  assert.deepEqual(h.draft, createDraft());
  assert.equal(JSON.stringify(h.state), before);
});

test('blank dialog selection, cancellation, reassignment and keyboard return keep the same physical ID', (t) => {
  const h = harness(t, true);
  const original = h.draft;
  h.buttons[1].emit('click');
  assert.equal(h.find('blank-dialog').open, true);
  h.find('cancel-blank').emit('click');
  assert.equal(h.input.selected, null);
  assert.equal(h.draft, original);
  h.buttons[1].emit('click');
  h.find('blank-letters').children[0].emit('click');
  const id = h.state.rack[1].id;
  assert.equal(h.input.selected.tileId, id);
  assert.equal(h.input.selected.assignedLetter, 'A');
  h.input.activateCell({ row: 3, column: 3 });
  const handle = h.find('draft-handles').children[0];
  handle.emit('click');
  h.find('change-blank').emit('click');
  h.find('blank-letters').children[2].emit('click');
  assert.equal(h.draft.tiles[0].assignedLetter, 'C');
  assert.equal(h.draft.tiles[0].tileId, id);
  h.find('return-tile').emit('click');
  assert.deepEqual(h.draft, createDraft());
  assert.equal(h.state.rack[1].id, id);
});
