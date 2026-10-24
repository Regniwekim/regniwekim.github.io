import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeSandbox } from '../src/ui/sandbox.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { createDailySession } from '../src/daily/challenge.js';
import { exchangeTiles } from '../src/core/session.js';
import { STORAGE_KEYS } from '../src/persistence/storage.js';

// Event surface for the real controller, renderer and input modules; no DOM dependency.
class Element {
  listeners = new Map(); children = []; dataset = {}; attributes = {}; value = ''; textContent = '';
  style = { setProperty() {} }; hidden = false; disabled = false; open = false;
  scrollTop = 0; scrollLeft = 0; clientWidth = 400; clientHeight = 400;
  controls = [];
  addEventListener(type, handler) { this.listeners.set(type, [...this.listeners.get(type) ?? [], handler]); }
  emit(type, properties = {}) {
    return Promise.all((this.listeners.get(type) ?? []).map((handler) => handler({ preventDefault() {}, ...properties })));
  }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  remove() { this.removed = true; }
  focus() { document.activeElement = this; }
  select() { this.selected = true; }
  setAttribute(key, value) { this.attributes[key] = value; }
  get selectedOptions() { return [{ textContent: this.value }]; }
  querySelectorAll() { return this.controls; }
  reportValidity() { return true; }
  getContext() { return new Proxy({}, { get: () => () => {} }); }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
}

function harness(t, options = {}) {
  const previous = { document: globalThis.document, window: globalThis.window,
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  const nodes = new Map();
  const find = (id) => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const data = new Map();
  const storage = options.storage ?? { getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  let sequence = 0;
  let copied = null;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: {
    async writeText(text) { copied = text; },
  } } });
  t.after(() => {
    globalThis.document = previous.document; globalThis.window = previous.window;
    if (previous.navigator) Object.defineProperty(globalThis, 'navigator', previous.navigator);
    else delete globalThis.navigator;
  });
  let clock = Date.UTC(2026, 9, 23, 23, 59, 59, 999);
  function boot() {
    nodes.clear();
    globalThis.document = { getElementById: find, createElement: () => new Element() };
    globalThis.window = new Element();
    for (const [id, value] of Object.entries({ 'cell-size': '44', 'target-mode': 'automatic', target: '1',
    rows: '15', columns: '15', seed: 'wordstead-2c', 'farm-seed': 'wordstead-farm-2d',
    'farm-density': '0.08', orientation: 'horizontal' })) find(id).value = value;
  find('dimensions').controls = ['rows', 'columns', 'seed', 'farm-seed', 'farm-density',
    'target-mode', 'target', 'calculate-target', 'create-board'].map(find);
  find('word-controls').controls = ['commit-word', 'word', 'orientation'].map(find);
    initializeSandbox({ dictionary: demoDictionary, vocabulary: { name: 'Controller test vocabulary' }, now: () => clock,
      getStorage: () => storage, saveToken: () => `test:${++sequence}` });
  }
  boot();
  const click = (id) => find(id).emit('click');
  const change = async (mode) => { find('mode').value = mode; await find('mode').emit('change'); };
  const rack = () => find('rack').children.filter((button) => !button.hidden).map((button) => button.attributes['aria-label']);
  const tile = async (slot, row = 8, column = 8) => {
    await find('rack').children[slot].emit('click');
    find('cell-row').value = row; find('cell-column').value = column;
    await find('coordinates').emit('submit');
    await find('board').emit('keydown', { key: 'Enter' });
  };
  return { find, click, change, rack, tile, storage, reload: boot, get copied() { return copied; },
    advance() { clock += 1; }, resize: () => window.emit('resize') };
}

test('real mode controller isolates drafts, custom Free Play, exchanges, both labs and daily rollover', async (t) => {
  const h = harness(t), { find, click, change } = h;
  assert.equal(find('mode').value, 'daily');
  const initialRack = h.rack();
  assert.match(find('daily-info').textContent, /2026-10-23/);
  assert.equal(find('dimensions').hidden, true);
  assert.ok(find('dimensions').controls.every((node) => node.disabled));
  // Hidden/programmatic setup submissions cannot replace Daily.
  find('seed').value = 'custom'; find('rows').value = '3'; find('target').value = '999';
  await find('dimensions').emit('submit');
  assert.deepEqual(h.rack(), initialRack);
  await h.tile(0);
  const dailyDraft = h.rack();
  assert.match(dailyDraft[0], /provisionally at row 8, column 8/);
  await change('rack');
  assert.equal(find('dimensions').hidden, false);
  find('seed').value = 'free-play-isolated'; find('farm-seed').value = 'free-farm';
  find('rows').value = '7'; find('columns').value = '9';
  find('target-mode').value = 'manual'; await find('target-mode').emit('change'); find('target').value = '37';
  await find('dimensions').emit('submit');
  assert.match(find('goal-label').textContent, /37 points/);
  assert.match(find('board-summary').textContent, /7 rows × 9 columns/);
  await h.tile(0, 4, 5);
  const freeDraft = h.rack();
  await change('daily');
  assert.deepEqual(h.rack(), dailyDraft);
  assert.match(find('goal-label').textContent, /12 points/);
  assert.match(find('board-summary').textContent, /15 rows × 15 columns/);
  h.advance(); await h.resize();
  assert.match(find('daily-info').textContent, /Active challenge: 2026-10-23/);
  assert.match(find('daily-info').textContent, /2026-10-24.*available/);
  assert.equal(find('start-today').disabled, false);
  await change('words'); await click('example');
  assert.match(find('placement-feedback').textContent, /Valid preview/);
  await change('freeform'); await click('toggle-letter');
  assert.match(find('selection-status').textContent, /committed letter A/);
  await change('daily'); assert.deepEqual(h.rack(), dailyDraft);
  await click('clear-draft'); await click('start-exchange');
  await find('rack').children[0].emit('click'); await click('confirm-exchange');
  assert.equal(find('exchange-count').textContent, 1);
  const exchanged = h.rack();
  const original = createDailySession('2026-10-23').session;
  const expectedExchange = exchangeTiles(original, [original.rack[0].id]).state;
  assert.deepEqual(find('rack').children.filter((button) => !button.hidden).map((button) => Number(button.dataset.tileId)),
    expectedExchange.rack.map((tile) => tile.id));
  await change('rack'); assert.deepEqual(h.rack(), freeDraft);
  assert.equal(find('exchange-count').textContent, 0);
  assert.match(find('goal-label').textContent, /37 points/);
  await change('daily'); assert.deepEqual(h.rack(), exchanged);
  await click('reset');
  assert.equal(find('save-confirm').open, true);
  assert.deepEqual(h.rack(), exchanged);
  await click('save-confirm-yes'); assert.deepEqual(h.rack(), initialRack);
  assert.equal(find('exchange-count').textContent, 0);
  assert.match(find('daily-info').textContent, /Active challenge: 2026-10-23/);
  await click('start-today');
  assert.match(find('daily-info').textContent, /Active challenge: 2026-10-24/);
  assert.deepEqual(find('rack').children.filter((button) => !button.hidden).map((button) => Number(button.dataset.tileId)),
    createDailySession('2026-10-24').session.rack.map((tile) => tile.id));
  assert.match(find('goal-label').textContent, /15 points/);
  await change('freeform'); assert.match(find('selection-status').textContent, /committed letter A/);
  await change('rack'); assert.deepEqual(h.rack(), freeDraft);
});

test('daily end, Copy Results, restart and Free Play results use their own dated context', async (t) => {
  const h = harness(t), { find, click, change } = h;
  await click('end-run');
  assert.equal(find('results-title').textContent, 'Farm Unfinished');
  assert.match(find('results-context').textContent, /Daily Puzzle · 2026-10-23 · v1/);
  assert.equal(find('new-puzzle-link').hidden, true);
  await click('copy-results');
  assert.equal(h.copied, find('share-text').value);
  assert.match(h.copied, /Daily Puzzle · 2026-10-23 · v1/);
  assert.match(h.copied, /0\/12 farm points/);
  assert.match(find('copy-status').textContent, /Results copied/);
  await change('rack'); assert.equal(find('results').hidden, true);
  await click('end-run'); assert.match(find('results-context').textContent, /Free Play/);
  assert.doesNotMatch(find('share-text').value, /Daily Puzzle/);
  await change('daily'); assert.match(find('share-text').value, /Daily Puzzle · 2026-10-23/);
  await click('reset');
  await click('save-confirm-yes');
  assert.equal(find('results').hidden, true); assert.equal(find('share-text').value, '');
});

test('controller refresh restores separate drafts, previous UTC daily and explicit replacement confirmation', async (t) => {
  const h = harness(t), { find, click, change } = h;
  await h.tile(0);
  const dailyDraft = h.rack();
  await change('rack'); await h.tile(0);
  const freeDraft = h.rack(), freeSave = h.storage.getItem(STORAGE_KEYS.free);
  h.advance(); h.reload();
  assert.deepEqual(h.rack(), dailyDraft);
  assert.match(find('save-status').textContent, /Restored/);
  assert.match(find('daily-info').textContent, /2026-10-23.*2026-10-24.*discards/);
  await click('start-today'); assert.equal(find('save-confirm').open, true);
  await click('save-confirm-no'); assert.deepEqual(h.rack(), dailyDraft);
  await click('start-today'); await click('save-confirm-yes');
  assert.match(find('daily-info').textContent, /Active challenge: 2026-10-24/);
  assert.equal(h.storage.getItem(STORAGE_KEYS.free), freeSave);
  h.reload(); await change('rack'); assert.deepEqual(h.rack(), freeDraft);
});

test('controller autosaves blank edits, committed words, exchanges and terminal results; restart clears history only after confirmation', async (t) => {
  const h = harness(t), { find, click, change } = h;
  await change('rack');
  find('seed').value = 'blank-qa-636'; find('rows').value = find('columns').value = '7';
  find('target-mode').value = 'manual'; await find('target-mode').emit('change'); find('target').value = '37';
  await find('dimensions').emit('submit');
  const initial = h.rack();
  await find('rack').children[5].emit('click');
  await find('blank-letters').children[14].emit('click'); // O
  await find('board').emit('keydown', { key: 'Enter' });
  const blankDraft = h.rack();
  h.reload(); await change('rack'); assert.deepEqual(h.rack(), blankDraft);
  assert.equal(find('blank-dialog').open, false); assert.equal(find('return-tile').disabled, true);
  await find('rack').children[5].emit('click'); await click('change-blank');
  await find('blank-letters').children[0].emit('click');
  h.reload(); await change('rack'); assert.match(h.rack()[5], /assigned A/);
  await h.tile(6, 4, 3); await h.tile(2, 4, 5); await click('commit-word');
  assert.equal(find('word-count').textContent, 1);
  await click('start-exchange'); await find('rack').children[0].emit('click'); await click('confirm-exchange');
  const committedRack = h.rack();
  h.reload(); await change('rack');
  assert.deepEqual(h.rack(), committedRack); assert.equal(find('exchange-count').textContent, 1);
  assert.match(find('goal-label').textContent, /37 points/);
  const history = JSON.parse(h.storage.getItem(STORAGE_KEYS.free)).save;
  assert.deepEqual(history.actions.map((a) => a.type), ['word', 'exchange']);
  await click('end-run'); const text = find('share-text').value;
  h.reload(); await change('rack');
  assert.equal(find('share-text').value, text); assert.equal(find('commit-word').disabled, true);
  await click('copy-results'); assert.equal(h.copied, text);
  await click('reset'); await click('save-confirm-no'); assert.equal(find('share-text').value, text);
  await click('reset'); await click('save-confirm-yes'); assert.deepEqual(h.rack(), initial);
  assert.equal(JSON.parse(h.storage.getItem(STORAGE_KEYS.free)).save.actions.length, 0);
  h.reload(); await change('rack'); assert.deepEqual(h.rack(), initial);
  assert.equal(find('results').hidden, true);
});

test('diagnostic fixtures and both labs leave legitimate saves intact; fresh replacement still confirms saved Free Play', async (t) => {
  const h = harness(t), { find, click, change } = h;
  await change('rack'); await h.tile(0); const draft = h.rack();
  const free = h.storage.getItem(STORAGE_KEYS.free), daily = h.storage.getItem(STORAGE_KEYS.daily);
  await click('rack-example');
  assert.match(find('save-status').textContent, /fixture is not saved/);
  await h.tile(0, 4, 4); await click('clear-draft');
  assert.equal(h.storage.getItem(STORAGE_KEYS.free), free);
  await click('reload-save'); assert.deepEqual(h.rack(), draft);
  await change('words'); await click('example'); await click('commit-word');
  await change('freeform'); await click('toggle-letter');
  assert.equal(find('save-context').hidden, true);
  assert.equal(h.storage.getItem(STORAGE_KEYS.free), free); assert.equal(h.storage.getItem(STORAGE_KEYS.daily), daily);
  await click('rack-example');
  find('target-mode').value = 'manual'; await find('target-mode').emit('change');
  await find('dimensions').emit('submit'); assert.equal(find('save-confirm').open, true);
  await click('save-confirm-no'); assert.equal(h.storage.getItem(STORAGE_KEYS.free), free);
});

test('controller keeps malformed saves until discard, isolates modes, and stays playable without storage', async (t) => {
  const h = harness(t), { find, click, change } = h;
  await change('rack'); await h.tile(0);
  const free = h.storage.getItem(STORAGE_KEYS.free);
  h.storage.setItem(STORAGE_KEYS.daily, '{broken'); h.reload();
  assert.match(find('save-status').textContent, /could not be restored/);
  await h.tile(0); assert.equal(h.storage.getItem(STORAGE_KEYS.daily), '{broken');
  assert.equal(h.storage.getItem(STORAGE_KEYS.free), free);
  await click('discard-save'); await click('save-confirm-no');
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), '{broken');
  await click('discard-save'); await click('save-confirm-yes');
  assert.match(find('save-status').textContent, /saved locally/);
  assert.equal(h.storage.getItem(STORAGE_KEYS.free), free);
  h.storage.getItem = () => { throw new Error('denied'); }; h.reload();
  assert.match(find('save-status').textContent, /Saving unavailable/);
  await h.tile(0); assert.match(h.rack()[0], /provisionally/);
  assert.equal(find('save-status').attributes.role, 'alert');
  await change('rack'); await h.tile(0); const unsavedFree = h.rack();
  await click('rack-example'); await click('reload-save');
  assert.deepEqual(h.rack(), unsavedFree); // Fixture inspection cannot lose the in-memory fallback either.
});

test('rejected commitments, invalid draft drops and cosmetic changes do not write save histories', async (t) => {
  const h = harness(t), { find, click } = h;
  await h.tile(0); const before = h.storage.getItem(STORAGE_KEYS.daily);
  await click('commit-word'); // Direct event dispatch also checks the controller guard/rejection path.
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), before);
  await h.tile(1, 10, 10); // Diagonal/gapped placement is rejected.
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), before);
  await h.resize(); find('cell-size').value = '56'; await find('cell-size').emit('change');
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), before);
  assert.equal(JSON.parse(before).save.actions.length, 0);
});

test('controller pauses writes on another tab change and permits explicit reload or replacement', async (t) => {
  const h = harness(t), { find, click } = h;
  const original = h.storage.getItem(STORAGE_KEYS.daily);
  const foreign = JSON.parse(original); foreign.revision = 'other-tab';
  h.storage.setItem(STORAGE_KEYS.daily, JSON.stringify(foreign));
  await window.emit('storage', { key: STORAGE_KEYS.daily });
  assert.match(find('save-status').textContent, /Another tab/);
  await h.tile(0); assert.equal(h.storage.getItem(STORAGE_KEYS.daily), JSON.stringify(foreign));
  await click('reload-save'); await click('save-confirm-yes');
  assert.doesNotMatch(h.rack()[0], /provisionally/);
  await h.tile(0);
  h.storage.setItem(STORAGE_KEYS.daily, original); await window.emit('storage', { key: STORAGE_KEYS.daily });
  await click('replace-save'); await click('save-confirm-yes');
  assert.match(find('save-status').textContent, /saved locally/);
  h.reload(); assert.match(h.rack()[0], /provisionally/);
});
