import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeSandbox } from '../src/ui/sandbox.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { createDailySession } from '../src/daily/challenge.js';
import { exchangeTiles } from '../src/core/session.js';
import { STORAGE_KEYS } from '../src/persistence/storage.js';
import { HISTORY_KEY } from '../src/persistence/history-storage.js';
import { createHistoryRecord, createDailyHistory, recordDailyResult, serializeDailyHistory } from '../src/persistence/daily-history.js';
import { prepareHistoryVictory } from '../scripts/history-qa.js';
import { createDictionary } from '../src/core/dictionary.js';
import { parseVocabulary } from '../src/vocabulary/format.js';
import { VOCABULARY } from '../src/vocabulary/manifest.js';
import { readFileSync } from 'node:fs';
import { SOUND_KEY } from '../src/audio/sounds.js';

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
  scrollIntoView() {}
  setAttribute(key, value) { this.attributes[key] = value; }
  get selectedOptions() { return [{ textContent: this.value }]; }
  querySelectorAll() { return this.controls; }
  reportValidity() { return true; }
  getContext() { return new Proxy({}, { get: () => () => {} }); }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
  showModal() {
    this.open = true;
    document.activeElement = document.getElementById(this.id === 'save-confirm' ? 'save-confirm-no' : `close-${this.id}`);
  }
  close() { this.open = false; this.emit('close'); }
}

function harness(t, options = {}) {
  const previous = { document: globalThis.document, window: globalThis.window,
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  const nodes = new Map();
  const find = (id) => { if (!nodes.has(id)) { const node = new Element(); node.id = id; nodes.set(id, node); } return nodes.get(id); };
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
    initializeSandbox({ dictionary: options.dictionary ?? demoDictionary, vocabulary: { name: 'Controller test vocabulary' }, now: () => clock,
      getStorage: () => storage, saveToken: () => `test:${++sequence}`, feedbackFactory: options.feedbackFactory });
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

test('native destinations transition one layer at a time and return focus without changing either save', async (t) => {
  const h = harness(t), { find, click } = h;
  await h.tile(0);
  const daily = h.storage.getItem(STORAGE_KEYS.daily), free = h.storage.getItem(STORAGE_KEYS.free);
  find('open-menu').focus(); await click('open-menu');
  assert.equal(find('game-menu').open, true);
  assert.equal(document.activeElement, find('close-game-menu'));
  await click('open-details');
  assert.equal(find('game-menu').open, false);
  assert.equal(find('game-details').open, true);
  await find('game-details').emit('cancel');
  assert.equal(find('game-details').open, false);
  assert.equal(document.activeElement, find('open-menu'));
  find('open-help').focus(); await click('open-help');
  assert.equal(find('how-to-play').open, true);
  await click('close-how-to-play');
  assert.equal(document.activeElement, find('open-help'));
  await click('open-history'); await click('history-next'); await click('history-previous');
  await find('history').emit('cancel');
  assert.equal(find('history').open, false);
  assert.equal(document.activeElement, find('open-history'));
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), daily);
  assert.equal(h.storage.getItem(STORAGE_KEYS.free), free);
});

test('menu mode navigation resumes drafts and closes; inspecting Free Play settings never replaces a run', async (t) => {
  const h = harness(t), { find, click } = h;
  await h.tile(0); const daily = h.rack();
  await click('open-menu'); await click('play-free');
  assert.equal(find('game-menu').open, false);
  assert.equal(find('play-free').attributes['aria-pressed'], 'true');
  await h.tile(0); const free = h.rack(), saved = h.storage.getItem(STORAGE_KEYS.free);
  await click('open-menu'); await click('open-setup');
  assert.equal(find('setup-panel').open, true);
  assert.equal(find('game-menu').open, false);
  await click('close-setup-panel');
  assert.deepEqual(h.rack(), free);
  assert.equal(h.storage.getItem(STORAGE_KEYS.free), saved);
  await click('open-menu'); await click('play-daily'); assert.deepEqual(h.rack(), daily);
  await click('open-menu'); await click('play-free'); assert.deepEqual(h.rack(), free);
});

test('restart confirmation suspends its menu, Escape restores the action and acceptance returns to the board', async (t) => {
  const h = harness(t), { find, click } = h;
  await h.tile(0); const draft = h.rack();
  find('open-menu').focus(); await click('open-menu');
  find('reset').focus(); await click('reset');
  assert.equal(find('game-menu').open, false);
  assert.equal(find('save-confirm').open, true);
  await find('save-confirm').emit('cancel');
  assert.equal(find('game-menu').open, true);
  assert.equal(document.activeElement, find('reset'));
  assert.deepEqual(h.rack(), draft);
  await click('reset'); await click('save-confirm-yes');
  assert.equal(find('game-menu').open, false);
  assert.equal(find('save-confirm').open, false);
  assert.equal(document.activeElement, find('board'));
  assert.doesNotMatch(h.rack()[0], /provisionally/);
});

test('new Free Play replacement keeps configuration and draft on cancel, then closes setup only on success', async (t) => {
  const h = harness(t), { find, click } = h;
  await click('play-free'); await h.tile(0);
  const saved = h.storage.getItem(STORAGE_KEYS.free);
  await click('open-setup');
  find('rows').value = '7'; find('columns').value = '9';
  find('target-mode').value = 'manual'; await find('target-mode').emit('change'); find('target').value = '37';
  find('create-board').focus(); await find('dimensions').emit('submit');
  assert.equal(find('setup-panel').open, false);
  assert.equal(find('save-confirm').open, true);
  await click('save-confirm-no');
  assert.equal(find('setup-panel').open, true);
  assert.equal(document.activeElement, find('create-board'));
  assert.equal(find('rows').value, '7');
  assert.equal(h.storage.getItem(STORAGE_KEYS.free), saved);
  await find('dimensions').emit('submit'); await click('save-confirm-yes');
  assert.equal(find('setup-panel').open, false);
  assert.match(find('board-summary').textContent, /7 rows × 9 columns/);
  assert.match(find('goal-label').textContent, /0 \/ 37 farm points/);
});

test('contextual actions follow selection and drafts, while exchange replaces primary actions', async (t) => {
  const h = harness(t), { find, click } = h;
  for (const id of ['clear-draft', 'cancel-tile', 'return-tile', 'change-blank']) assert.equal(find(id).hidden, true);
  await find('rack').children[0].emit('click');
  assert.equal(find('cancel-tile').hidden, false);
  assert.equal(find('return-tile').hidden, true);
  await click('open-help');
  await window.emit('keydown', { key: 'Escape' });
  await find('how-to-play').emit('cancel');
  assert.equal(find('cancel-tile').hidden, false); // Escape belongs to the modal, not tile input.
  find('cancel-tile').focus(); await click('cancel-tile');
  assert.equal(find('cancel-tile').hidden, true);
  assert.equal(document.activeElement, find('board'));
  await h.tile(0);
  assert.equal(find('clear-draft').hidden, false);
  assert.equal(find('fresh-hint').hidden, true);
  await find('rack').children[0].emit('click');
  assert.equal(find('return-tile').hidden, false);
  await click('return-tile');
  assert.equal(find('clear-draft').hidden, true);
  await click('start-exchange');
  assert.equal(find('commit-word').hidden, true);
  assert.equal(find('draft-actions').hidden, true);
  assert.equal(find('confirm-exchange').hidden, false);
  await click('cancel-exchange');
  assert.equal(find('commit-word').hidden, false);
  assert.equal(find('confirm-exchange').hidden, true);
  await click('start-exchange'); await h.change('words');
  assert.equal(find('commit-word').hidden, false);
  for (const id of ['start-exchange', 'confirm-exchange', 'cancel-exchange']) assert.equal(find(id).hidden, true);
  await h.change('daily');
  assert.equal(find('start-exchange').hidden, false);
  assert.equal(find('confirm-exchange').hidden, true);
});

test('Help coordinate inspection closes its modal and focuses the same board without spending a tile', async (t) => {
  const h = harness(t), { find, click } = h;
  await find('rack').children[0].emit('click');
  const saved = h.storage.getItem(STORAGE_KEYS.daily);
  await click('open-help');
  find('cell-row').value = '2'; find('cell-column').value = '3';
  await find('coordinates').emit('submit');
  assert.equal(find('how-to-play').open, false);
  assert.equal(document.activeElement, find('board'));
  assert.match(find('selection-status').textContent, /Row 2, column 3/);
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), saved);
  assert.equal(find('cancel-tile').hidden, false);
});

test('History confirmation returns to History on cancel or clear without changing active saves', async (t) => {
  const h = harness(t), { find, click } = h;
  await click('end-run'); const saved = h.storage.getItem(STORAGE_KEYS.daily);
  await click('open-history'); find('history-clear').focus(); await click('history-clear');
  assert.equal(find('history').open, false);
  await click('save-confirm-no');
  assert.equal(find('history').open, true);
  assert.equal(document.activeElement, find('history-clear'));
  await click('history-clear'); await click('save-confirm-yes');
  assert.equal(find('history').open, true);
  assert.equal(find('history-attention').hidden, false);
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), saved);
});

test('ordinary autosaves are absent from play while storage failures remain visible outside destinations', async (t) => {
  const h = harness(t), { find, click } = h;
  assert.equal(find('save-context').hidden, true);
  find('board').focus();
  h.storage.setItem(STORAGE_KEYS.daily, '{corrupt');
  await window.emit('storage', { key: STORAGE_KEYS.daily });
  assert.equal(find('save-context').hidden, false);
  assert.equal(find('save-status').attributes.role, 'alert');
  assert.equal(find('game-menu').open, false);
  assert.equal(document.activeElement, find('board'));
  await click('open-menu'); await click('close-game-menu');
  assert.equal(find('save-context').hidden, false);
});

test('menu sound preference uses the existing independent key and survives reload without editing saves', async (t) => {
  const h = harness(t), { find, click } = h;
  const saved = h.storage.getItem(STORAGE_KEYS.daily);
  assert.equal(find('sound-toggle').attributes['aria-pressed'], 'false');
  await click('open-menu'); await click('sound-toggle');
  assert.equal(find('game-menu').open, true);
  assert.deepEqual(JSON.parse(h.storage.getItem(SOUND_KEY)), { version: 1, enabled: true });
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), saved);
  h.reload(); assert.equal(find('sound-toggle').attributes['aria-pressed'], 'true');
  await click('open-menu'); await click('sound-toggle');
  assert.deepEqual(JSON.parse(h.storage.getItem(SOUND_KEY)), { version: 1, enabled: false });
});

test('successful recovery moves focus from disappearing save/history actions to visible controls', async (t) => {
  const h = harness(t), { find, click } = h;
  h.storage.setItem(STORAGE_KEYS.daily, '{broken'); h.reload();
  find('discard-save').focus(); await click('discard-save'); await click('save-confirm-yes');
  assert.equal(find('save-context').hidden, true);
  assert.equal(document.activeElement, find('board'));
  await click('end-run'); await click('open-history'); await click('history-clear'); await click('save-confirm-yes');
  await click('close-history');
  find('save-history-result').focus(); await click('save-history-result');
  assert.equal(find('save-history-result').hidden, true);
  assert.equal(document.activeElement, find('results'));
  h.storage.setItem(HISTORY_KEY, '{broken'); await window.emit('storage', { key: HISTORY_KEY });
  await click('open-history'); h.storage.removeItem(HISTORY_KEY);
  find('history-reload').focus(); await click('history-reload');
  assert.equal(document.activeElement, find('close-history'));
});

test('explicit draft and exchange actions retain keyboard focus when their controls disappear or disable', async (t) => {
  const h = harness(t);
  const { find, click } = h;
  await click('rack-example');
  await h.tile(0, 4, 4); await h.tile(1, 4, 5); await h.tile(2, 4, 6);
  find('commit-word').focus();
  await click('commit-word');
  assert.equal(find('word-count').textContent, 1);
  assert.equal(document.activeElement, find('board'));
  find('start-exchange').focus(); await click('start-exchange');
  assert.equal(document.activeElement, find('rack').children[0]);
  find('cancel-exchange').focus(); await click('cancel-exchange');
  assert.equal(document.activeElement, find('start-exchange'));
  await click('start-exchange');
  await find('rack').children[0].emit('click');
  find('confirm-exchange').focus(); await click('confirm-exchange');
  assert.equal(document.activeElement, find('rack').children[0]);
  await h.tile(0, 5, 4);
  find('undo-draft').focus(); await click('undo-draft');
  assert.equal(document.activeElement, find('board'));
  await h.tile(0, 5, 4);
  find('clear-draft').focus(); await click('clear-draft');
  assert.equal(document.activeElement, find('board'));
  // Passive rendering must never take focus from another control.
  find('sound-toggle').focus(); await h.resize();
  assert.equal(document.activeElement, find('sound-toggle'));
  find('end-run').focus(); await click('end-run');
  assert.equal(document.activeElement, find('board'));
});

test('feedback follows authoritative controller transitions once; preview/render/restore/restart never replay actions', async (t) => {
  const events = []; let cancellations = 0;
  const h = harness(t, { feedbackFactory: () => ({ emit(input) { events.push(...(Array.isArray(input) ? input : [input])); },
    cancel() { cancellations += 1; } }) });
  const { click, find } = h;
  assert.deepEqual(events, []);
  await h.tile(0);
  assert.deepEqual(events.map((event) => event.type), ['tile-selected', 'tile-placed']);
  const draft = h.storage.getItem(STORAGE_KEYS.daily);
  assert.equal(find('commit-word').disabled, false); // Explicitly check an invalid nonempty draft.
  await click('commit-word');
  assert.equal(events.at(-1).type, 'word-rejected');
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), draft);
  const count = events.length;
  await h.resize(); await click('play-free'); await click('play-daily'); h.reload();
  assert.equal(events.length, count);
  assert.ok(cancellations >= 4);
  await click('clear-draft'); assert.equal(events.at(-1).type, 'tile-returned');
  await click('start-exchange'); await click('confirm-exchange');
  assert.equal(events.at(-1).type, 'tile-returned'); // Rejected empty exchange emits no success.
  await find('rack').children[0].emit('click'); await click('confirm-exchange');
  assert.equal(events.at(-1).type, 'tiles-exchanged');
  assert.deepEqual(events.at(-1).slots, [0]);
  const beforeRestart = events.length;
  await click('reset'); await click('save-confirm-yes');
  assert.equal(events.length, beforeRestart);
  await click('rack-example');
  const place = async (letter, row, column) => {
    const slot = find('rack').children.findIndex((node) => node.attributes['aria-label'].includes(`: ${letter}, physical`)
      && !node.attributes['aria-label'].includes('provisionally'));
    await h.tile(slot, row, column);
  };
  for (const tiles of [[['C',4,4],['A',4,5],['R',4,6]], [['A',5,4],['B',6,4]],
    [['A',5,6],['T',6,6]], [['A',6,5]]]) {
    for (const tile of tiles) await place(...tile);
    await click('commit-word');
  }
  assert.equal(events.filter((event) => event.type === 'word-accepted').length, 4);
  assert.deepEqual(events.find((event) => event.type === 'territory-captured').indices, [32]);
  assert.equal(events.filter((event) => event.type === 'run-completed').length, 1);
  const completedCount = events.length;
  await h.resize(); await click('play-daily'); await click('play-free');
  assert.equal(events.length, completedCount);
});

test('restored terminal completion presents results with no new feedback', async (t) => {
  const events = [];
  const { storage } = completionStorage();
  const h = harness(t, { storage, dictionary: historyDictionary,
    feedbackFactory: () => ({ emit(input) { events.push(...input); }, cancel() {} }) });
  await h.click('commit-word');
  assert.equal(events.filter((event) => event.type === 'run-completed').length, 1);
  events.length = 0; h.reload();
  assert.equal(h.find('results-title').textContent, 'Harvest Complete!');
  assert.deepEqual(events, []);
});

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
  assert.match(find('goal-label').textContent, /\/ 37\b/);
  assert.match(find('board-summary').textContent, /7 rows × 9 columns/);
  await h.tile(0, 4, 5);
  const freeDraft = h.rack();
  await change('daily');
  assert.deepEqual(h.rack(), dailyDraft);
  assert.match(find('goal-label').textContent, /\/ 12\b/);
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
  assert.match(find('goal-label').textContent, /\/ 37\b/);
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
  assert.match(find('goal-label').textContent, /\/ 15\b/);
  await change('freeform'); assert.match(find('selection-status').textContent, /committed letter A/);
  await change('rack'); assert.deepEqual(h.rack(), freeDraft);
});

test('player navigation and help preserve active sessions while disclosing the correct settings and labs', async (t) => {
  const h = harness(t), { find, click, change } = h;
  assert.equal(find('play-daily').attributes['aria-pressed'], 'true');
  assert.equal(find('setup-panel').hidden, true);
  assert.equal(find('start-today').hidden, true);
  await h.tile(0);
  const daily = h.storage.getItem(STORAGE_KEYS.daily), draft = h.rack();
  await click('play-free');
  assert.equal(find('play-free').attributes['aria-pressed'], 'true');
  assert.equal(find('setup-panel').hidden, false);
  assert.equal(find('board-title').textContent, 'Free Play');
  await h.tile(0);
  const free = h.storage.getItem(STORAGE_KEYS.free);
  await click('open-help'); assert.equal(find('how-to-play').open, true);
  await click('open-history'); assert.equal(find('history').open, true);
  assert.equal(document.activeElement, find('close-history'));
  await click('play-daily');
  assert.deepEqual(h.rack(), draft); assert.equal(find('setup-panel').hidden, true);
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), daily);
  assert.equal(h.storage.getItem(STORAGE_KEYS.free), free);
  await change('words');
  assert.equal(find('development-tools').open, true);
  assert.equal(find('play-daily').attributes['aria-pressed'], 'false');
  assert.equal(find('play-free').attributes['aria-pressed'], 'false');
  assert.equal(find('view-title').textContent, 'Lab board settings');
  await click('example'); await click('commit-word');
  await change('freeform'); await click('toggle-letter');
  assert.equal(find('end-run').hidden, true);
  await click('play-daily'); assert.deepEqual(h.rack(), draft);
  h.advance(); await h.resize();
  assert.equal(find('start-today').hidden, false);
  assert.match(find('daily-info').textContent, /Resuming.*2026-10-24.*available/);
});

test('save and history attention remain discoverable without opening panels or moving focus', async (t) => {
  const h = harness(t), { find, click } = h;
  find('history').open = false;
  find('board').focus();
  h.storage.setItem(HISTORY_KEY, '{broken');
  await window.emit('storage', { key: HISTORY_KEY });
  assert.equal(find('history-attention').hidden, false);
  assert.equal(find('history-alert').attributes.role, 'alert');
  assert.match(find('history-summary').textContent, /action needed/);
  assert.equal(find('history').open, false);
  assert.equal(document.activeElement, find('board'));
  h.storage.setItem(STORAGE_KEYS.daily, '{broken');
  await window.emit('storage', { key: STORAGE_KEYS.daily });
  assert.equal(find('save-context').dataset.attention, 'true');
  assert.equal(find('reload-save').hidden, false);
  await click('history-alert-link'); assert.equal(find('history').open, true);
  h.storage.removeItem(HISTORY_KEY); await click('history-reload');
  assert.equal(find('history-attention').hidden, true);
  await click('end-run');
  find('results').open = false;
  await click('history-clear'); await click('save-confirm-yes');
  assert.equal(find('history-attention').hidden, false);
  assert.equal(find('history-result-link').hidden, false);
  await click('history-result-link'); assert.equal(find('results').open, true);
  await click('save-history-result');
  assert.equal(find('history-attention').hidden, true);
  await click('play-free'); await click('end-run');
  await click('new-puzzle-link'); assert.equal(find('setup-panel').open, true);
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
  assert.match(find('goal-label').textContent, /\/ 37\b/);
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

const historyDictionary = createDictionary(parseVocabulary(readFileSync(new URL(`../vocabulary/${VOCABULARY.file}`, import.meta.url), 'utf8'), VOCABULARY));
const memoryStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
};
function completionStorage(date = '2026-10-23') {
  const fixture = prepareHistoryVictory(historyDictionary, date);
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEYS.daily, JSON.stringify({ revision: 'fixed-completion', save: fixture.save }));
  return { storage, fixture };
}

test('Daily victory records once; refresh, retry, unsuccessful replay and a new date preserve its original completion', async (t) => {
  const { storage, fixture } = completionStorage();
  const h = harness(t, { storage, dictionary: historyDictionary }), { find, click } = h;
  assert.equal(storage.getItem(HISTORY_KEY), null); // A restored legal draft is not a completion.
  assert.equal(find('history-average-words').textContent, '—');
  await click('commit-word');
  const recorded = storage.getItem(HISTORY_KEY);
  assert.deepEqual(JSON.parse(recorded).records, [createHistoryRecord(fixture.finished)]);
  assert.equal(find('history-completed').textContent, 1); assert.equal(find('history-unfinished').textContent, 0);
  assert.match(find('history-result-status').textContent, /completion is saved/);
  assert.equal(find('save-history-result').hidden, true);
  const text = find('share-text').value; await click('copy-results'); assert.equal(h.copied, text);
  h.reload(); await h.resize();
  assert.equal(storage.getItem(HISTORY_KEY), recorded); assert.equal(find('share-text').value, text);
  await click('reset'); await click('save-confirm-yes');
  assert.equal(storage.getItem(HISTORY_KEY), recorded);
  await click('end-run');
  assert.equal(storage.getItem(HISTORY_KEY), recorded); assert.match(find('results-title').textContent, /Unfinished/);
  assert.match(find('history-result-status').textContent, /original recorded statistics/);
  h.advance(); await h.resize(); await click('start-today'); await click('save-confirm-yes');
  assert.equal(storage.getItem(HISTORY_KEY), recorded); assert.match(find('daily-info').textContent, /Active challenge: 2026-10-24/);
  await click('end-run');
  assert.equal(JSON.parse(storage.getItem(HISTORY_KEY)).records.length, 2);
  assert.equal(find('history-completed').textContent, 1); assert.equal(find('history-unfinished').textContent, 1);
});

test('explicit endings upgrade to completion; multiple completed dates update totals and calendar details', async (t) => {
  const { storage, fixture } = completionStorage();
  const earlier = prepareHistoryVictory(historyDictionary, '2024-02-29');
  let archive = recordDailyResult(createDailyHistory(), createHistoryRecord(earlier.finished));
  const initial = createDailySession('2026-10-23').session;
  archive = recordDailyResult(archive, createHistoryRecord({ ...initial, status: 'ended' }));
  storage.setItem(HISTORY_KEY, serializeDailyHistory(archive));
  const h = harness(t, { storage, dictionary: historyDictionary }), { find, click } = h;
  await click('commit-word');
  assert.equal(find('history-completed').textContent, 2); assert.equal(find('history-unfinished').textContent, 0);
  const expected = [createHistoryRecord(earlier.finished), createHistoryRecord(fixture.finished)];
  assert.equal(find('history-words').textContent, 8);
  assert.equal(find('history-strokes').textContent, expected.reduce((n, r) => n + r.strokes, 0));
  const buttons = find('history-days').children.filter((node) => node.dataset.date);
  const date = buttons.find((node) => node.dataset.date === '2026-10-23');
  assert.match(date.attributes['aria-label'], /UTC: Completed/); assert.equal(date.type, 'button');
  date.focus(); await date.emit('click');
  assert.equal(document.activeElement, date); assert.equal(date.attributes['aria-pressed'], 'true');
  const detail = find('history-details').children;
  assert.match(detail[0].textContent, /2026-10-23.*UTC/);
  assert.match(detail[1].textContent, /wordstead-daily-v1.*Harvest Complete/);
  const rows = detail[2].children;
  assert.equal(rows.find((row) => row.children[0].textContent === 'Total strokes').children[1].textContent, expected[1].strokes);
  assert.equal(rows.find((row) => row.children[0].textContent === 'Farm points / target').children[1].textContent, `${expected[1].totalPoints} / ${expected[1].target}`);
  await click('history-previous'); assert.equal(find('history-month').textContent, 'September 2026');
  await click('history-next'); assert.equal(find('history-month').textContent, 'October 2026');
  const empty = find('history-days').children.find((node) => node.dataset.date === '2026-10-22');
  assert.match(empty.attributes['aria-label'], /No recorded result/); await empty.emit('click');
  assert.match(find('history-details').children[1].textContent, /No recorded result/);
  const before = storage.getItem(STORAGE_KEYS.daily);
  await click('history-link'); assert.equal(find('history').open, true);
  assert.equal(storage.getItem(STORAGE_KEYS.daily), before);
});

test('clear history requires confirmation and never recreates records from terminal restoration or affects active saves', async (t) => {
  const { storage } = completionStorage();
  const h = harness(t, { storage, dictionary: historyDictionary }), { find, click } = h;
  await click('commit-word'); const history = storage.getItem(HISTORY_KEY);
  const daily = storage.getItem(STORAGE_KEYS.daily), free = storage.getItem(STORAGE_KEYS.free);
  const share = find('share-text').value;
  await click('history-clear'); assert.match(find('save-confirm-title').textContent, /Clear Daily History/);
  assert.match(find('save-confirm-message').textContent, /cannot be undone.*does not delete.*does not reset/);
  await find('save-confirm').emit('cancel'); assert.equal(storage.getItem(HISTORY_KEY), history);
  await click('history-clear'); await click('save-confirm-yes'); await h.resize();
  assert.equal(storage.getItem(HISTORY_KEY), null);
  assert.equal(storage.getItem(STORAGE_KEYS.daily), daily); assert.equal(storage.getItem(STORAGE_KEYS.free), free);
  assert.equal(find('share-text').value, share); assert.equal(find('history-completed').textContent, 0);
  assert.equal(find('save-history-result').hidden, false);
  h.reload(); assert.equal(storage.getItem(HISTORY_KEY), null); assert.equal(find('share-text').value, share);
  await click('save-history-result'); assert.equal(JSON.parse(storage.getItem(HISTORY_KEY)).records.length, 1);
  assert.equal(storage.getItem(STORAGE_KEYS.daily), daily); assert.equal(storage.getItem(STORAGE_KEYS.free), free);
});

test('history failure cannot invalidate accepted gameplay or active save restoration; explicit retry recovers', async (t) => {
  const { storage } = completionStorage();
  const write = storage.setItem; let fail = true;
  storage.setItem = (key, value) => { if (key === HISTORY_KEY && fail) throw new Error('quota'); write(key, value); };
  const h = harness(t, { storage, dictionary: historyDictionary }), { find, click } = h;
  await click('commit-word');
  assert.equal(find('results-title').textContent, 'Harvest Complete!');
  assert.equal(storage.getItem(HISTORY_KEY), null); assert.equal(JSON.parse(storage.getItem(STORAGE_KEYS.daily)).save.actions.at(-1).type, 'word');
  assert.match(find('history-result-status').textContent, /could not be saved/);
  assert.equal(find('history-status').attributes.role, 'alert');
  await click('copy-results'); assert.equal(h.copied, find('share-text').value);
  fail = false; await click('save-history-result');
  assert.equal(JSON.parse(storage.getItem(HISTORY_KEY)).records[0].status, 'won');
  assert.match(find('history-result-status').textContent, /completion is saved/);
  // Conversely a failed active-save write does not stop history capture.
  await click('reset'); await click('save-confirm-yes');
  storage.setItem = (key, value) => { if (key === STORAGE_KEYS.daily) throw new Error('active quota'); write(key, value); };
  h.advance(); await h.resize(); await click('start-today'); await click('end-run');
  assert.match(find('save-status').textContent, /Saving unavailable/);
  assert.equal(JSON.parse(storage.getItem(HISTORY_KEY)).records.length, 2);
});

test('history corruption, denied access and external changes do not prevent restoration; safe reload and clear are isolated', async (t) => {
  const { storage } = completionStorage(); storage.setItem(HISTORY_KEY, '{broken-history');
  const h = harness(t, { storage, dictionary: historyDictionary }), { find, click } = h;
  assert.equal(find('commit-word').disabled, false); assert.equal(find('history-content').hidden, true);
  assert.equal(find('history-status').attributes.role, 'alert');
  await click('commit-word'); assert.equal(storage.getItem(HISTORY_KEY), '{broken-history');
  assert.equal(find('results-title').textContent, 'Harvest Complete!');
  const daily = storage.getItem(STORAGE_KEYS.daily);
  await click('history-clear'); await click('save-confirm-yes');
  assert.equal(storage.getItem(STORAGE_KEYS.daily), daily); assert.equal(storage.getItem(HISTORY_KEY), null);
  await click('save-history-result'); const original = storage.getItem(HISTORY_KEY);
  storage.removeItem(HISTORY_KEY); await window.emit('storage', { key: HISTORY_KEY });
  assert.match(find('history-status').textContent, /Another tab/);
  await click('save-history-result'); assert.equal(storage.getItem(HISTORY_KEY), null);
  await click('history-reload'); assert.equal(find('history-completed').textContent, 0);
  await click('save-history-result'); assert.equal(storage.getItem(HISTORY_KEY), original);
  const read = storage.getItem; storage.getItem = (key) => { if (key === HISTORY_KEY) throw new Error('denied'); return read(key); };
  h.reload(); assert.equal(find('results-title').textContent, 'Harvest Complete!');
  assert.match(find('history-status').textContent, /unavailable/); assert.equal(find('history-content').hidden, true);
  storage.getItem = read; await click('history-reload'); assert.equal(find('history-completed').textContent, 1);
  assert.equal(storage.getItem(STORAGE_KEYS.daily), daily);
});

test('replacing an unfinished previous Daily, Free Play endings, lab actions and fixture victories never fabricate history', async (t) => {
  const h = harness(t), { click, change, find } = h;
  await h.tile(0); h.advance(); await h.resize();
  await click('start-today'); await click('save-confirm-yes');
  assert.equal(h.storage.getItem(HISTORY_KEY), null);
  await change('rack'); await click('end-run'); assert.equal(h.storage.getItem(HISTORY_KEY), null);
  await click('rack-example');
  const place = async (letter, row, column) => {
    const slot = find('rack').children.findIndex((node) => node.attributes['aria-label'].includes(`: ${letter}, physical`)
      && !node.attributes['aria-label'].includes('provisionally'));
    assert.ok(slot >= 0); await h.tile(slot, row, column);
  };
  await place('C', 4, 4); await place('A', 4, 5); await place('R', 4, 6); await click('commit-word');
  await place('A', 5, 4); await place('B', 6, 4); await click('commit-word');
  await place('A', 5, 6); await place('T', 6, 6); await click('commit-word');
  await place('A', 6, 5); await click('commit-word');
  assert.equal(find('results-title').textContent, 'Harvest Complete!'); assert.equal(h.storage.getItem(HISTORY_KEY), null);
  assert.equal(find('history-result-status').hidden, true);
  await change('words'); await click('example'); await click('commit-word');
  await change('freeform'); await click('toggle-letter'); assert.equal(h.storage.getItem(HISTORY_KEY), null);
});
