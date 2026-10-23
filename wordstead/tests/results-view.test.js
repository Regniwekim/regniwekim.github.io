import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeResults } from '../src/ui/results.js';
import { createSession, endSession, commitSessionWord } from '../src/core/session.js';
import { createFarmSession } from '../src/core/farm-fixture.js';
import { ENCLOSURE_MOVES } from '../src/core/session-fixture.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { getSessionResults, formatResultsShare } from '../src/core/results.js';

function setup(writeClipboard) {
  const nodes = new Map();
  const find = (id) => {
    if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: '', value: '', open: false, disabled: false,
      listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; },
      focus() { this.focused = true; }, select() { this.selected = true; } });
    return nodes.get(id);
  };
  const view = initializeResults({ find, writeClipboard });
  return { view, find, click: (id) => find(id).listeners.click() };
}
function won() {
  return ENCLOSURE_MOVES.reduce((state, move) => commitSessionWord(state, move, demoDictionary).state, createFarmSession('crop'));
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('view and clipboard use the same summary; opening/selecting/copying cannot mutate gameplay', async () => {
  const state = won();
  const before = JSON.stringify(state);
  let copied;
  const { view, find, click } = setup(async (text) => { copied = text; });
  view.render(state);
  assert.equal(find('results').hidden, false);
  assert.equal(find('results-title').textContent, 'Harvest Complete!');
  assert.equal(find('results-points').textContent, '4 / 4');
  assert.equal(find('results-crops').textContent, 1);
  assert.equal(find('results-crop-bonus').textContent, '+3');
  assert.equal(find('results-words').textContent, 4);
  assert.equal(find('results-strokes').textContent, 4);
  assert.equal(find('results-link').hidden, false);
  assert.equal(find('share-text').focused, undefined);
  find('manual-copy').open = true;
  click('select-results');
  assert.equal(find('share-text').selected, true);
  await click('copy-results');
  assert.equal(copied, formatResultsShare(getSessionResults(state)));
  assert.equal(copied, find('share-text').value);
  assert.match(find('copy-status').textContent, /Results copied/);
  view.render(state); // Board inspection/resize does not erase feedback or collapse text.
  assert.equal(find('manual-copy').open, true);
  assert.match(find('copy-status').textContent, /Results copied/);
  assert.equal(JSON.stringify(state), before);
});

test('clipboard confirmation waits for success and duplicate clicks do not start another write', async () => {
  const waiting = deferred();
  let calls = 0;
  const { view, find, click } = setup(() => { calls += 1; return waiting.promise; });
  view.render(won());
  const copying = click('copy-results');
  assert.equal(find('copy-results').disabled, true);
  assert.equal(find('copy-status').textContent, 'Copying results…');
  await click('copy-results');
  assert.equal(calls, 1);
  waiting.resolve();
  await copying;
  assert.equal(find('copy-results').disabled, false);
  assert.match(find('copy-status').textContent, /Results copied/);
});

for (const writeClipboard of [() => { throw new Error('unavailable'); }, async () => { throw new Error('denied'); }]) {
  test('unavailable or denied clipboard reveals useful manual fallback without a false success', async () => {
    const { view, find, click } = setup(writeClipboard);
    view.render(endSession(createSession()).state);
    await click('copy-results');
    assert.equal(find('results-title').textContent, 'Farm Unfinished');
    assert.equal(find('manual-copy').open, true);
    assert.match(find('copy-status').textContent, /copy it manually/);
    assert.doesNotMatch(find('copy-status').textContent, /Results copied/);
    assert.match(find('share-text').value, /Farm Unfinished/);
    assert.equal(find('share-text').focused, undefined);
    assert.equal(find('copy-results').disabled, false);
  });
}

test('default clipboard adapter handles an environment with no Clipboard API', async () => {
  assert.equal(globalThis.navigator?.clipboard, undefined);
  const { view, find, click } = setup();
  view.render(won());
  await click('copy-results');
  assert.equal(find('manual-copy').open, true);
  assert.match(find('copy-status').textContent, /copy it manually/);
});

test('restart, new puzzle and diagnostic modes clear all previous results and pending feedback', async () => {
  for (const next of [createSession(), createSession({ seed: 'new' }), null]) {
    const waiting = deferred();
    const { view, find, click } = setup(() => waiting.promise);
    const state = won();
    view.render(state);
    const copying = click('copy-results');
    view.render(next);
    waiting.resolve();
    await copying;
    assert.equal(find('results').hidden, true);
    assert.equal(find('results-link').hidden, true);
    assert.equal(find('new-puzzle-link').hidden, true);
    assert.equal(find('results-points').textContent, '');
    assert.equal(find('share-text').value, '');
    assert.equal(find('copy-status').textContent, '');
    assert.equal(find('manual-copy').open, false);
    assert.equal(find('copy-results').disabled, true);
    view.render(state); // Resuming rack mode restores its own terminal results.
    assert.equal(find('results-title').textContent, 'Harvest Complete!');
  }
});

test('a late clipboard failure cannot reopen a previous run after switching to a lab', async () => {
  const waiting = deferred();
  const { view, find, click } = setup(() => waiting.promise);
  view.render(won());
  const copying = click('copy-results');
  view.render(null);
  waiting.reject(new Error('late denial'));
  await copying;
  assert.equal(find('results').hidden, true);
  assert.equal(find('manual-copy').open, false);
  assert.equal(find('copy-status').textContent, '');
  assert.equal(find('share-text').value, '');
});
