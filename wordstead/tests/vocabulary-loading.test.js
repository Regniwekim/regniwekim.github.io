import test from 'node:test';
import assert from 'node:assert/strict';
import { createVocabularyLoader } from '../src/vocabulary/loader.js';
import { createGameStartup } from '../src/ui/startup.js';

const manifest = { id: 'test', file: 'test.txt', count: 2, minLength: 2, maxLength: 30,
  name: 'Test English', integrity: 'sha256-test' };
const text = '# Wordstead vocabulary test\nAT\nOX\n';
const response = () => ({ ok: true, text: async () => text });
function surface() {
  return { hidden: false, inert: false, textContent: '', attrs: {}, listeners: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(type, handler) { this.listeners[type] = handler; } };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('concurrent and later vocabulary loads fetch and parse only once, keeping the same instance', async () => {
  let fetches = 0, reads = 0, clock = 0;
  const ready = deferred();
  const load = createVocabularyLoader({ manifest, now: () => ++clock,
    fetchResource: async (url, options) => {
      fetches += 1;
      assert.ok(url.pathname.endsWith('/wordstead/vocabulary/test.txt'));
      assert.equal(options.integrity, manifest.integrity);
      await ready.promise;
      return { ok: true, text: async () => { reads += 1; return text; } };
    } });
  const first = load();
  assert.equal(load(), first);
  ready.resolve();
  const result = await first;
  assert.equal(load(), first);
  assert.equal((await load()).dictionary, result.dictionary);
  assert.equal(result.vocabulary, manifest);
  assert.equal(result.dictionary.has('at'), true);
  assert.equal(typeof result.dictionary.has('at'), 'boolean');
  assert.equal(fetches, 1);
  assert.equal(reads, 1);
  assert.equal(result.initializationMs, 1);
});

test('HTTP, network, body and malformed artifact failures expose no dictionary and allow explicit retry', async () => {
  for (const fail of [async () => { throw new Error('offline'); },
    async () => ({ ok: false, status: 404 }),
    async () => ({ ok: true, text: async () => { throw new Error('interrupted'); } }),
    async () => ({ ok: true, text: async () => '# Wordstead vocabulary test\nAT\n' })]) {
    let calls = 0;
    const load = createVocabularyLoader({ manifest,
      fetchResource: (...args) => ++calls === 1 ? fail(...args) : response() });
    await assert.rejects(load());
    assert.equal((await load()).dictionary.has('OX'), true);
    assert.equal(calls, 2);
  }
});

test('startup remains inert until a prepared dictionary exists; duplicate start/retry cannot start twice', async () => {
  const container = surface(), status = surface(), retry = surface(), waiting = deferred();
  let starts = 0, loads = 0;
  const prepared = { dictionary: { has: () => true }, vocabulary: manifest };
  const startup = createGameStartup({ container, status, retry,
    load: () => { loads += 1; return waiting.promise; },
    start: (result) => {
      assert.equal(container.inert, true);
      assert.equal(result, prepared);
      starts += 1;
    } });
  assert.equal(container.inert, true);
  const first = startup.start();
  assert.equal(startup.start(), first);
  assert.equal(retry.hidden, true);
  assert.match(status.textContent, /Loading/);
  await Promise.resolve();
  assert.equal(starts, 0);
  waiting.resolve(prepared);
  await first;
  await retry.listeners.click();
  assert.equal(container.inert, false);
  assert.equal(container.attrs['aria-busy'], 'false');
  assert.equal(starts, 1);
  assert.equal(loads, 1);
  assert.match(status.textContent, /Test English.*2 words ready/);
});

test('failed loading cannot initialize or enable a partial game; retry starts with intended vocabulary', async () => {
  const container = surface(), status = surface(), retry = surface();
  let attempts = 0, starts = 0;
  const load = createVocabularyLoader({ manifest,
    fetchResource: async () => {
      if (++attempts === 1) throw new Error('network');
      return response();
    } });
  const startup = createGameStartup({ container, status, retry, load,
    start: (result) => { starts += 1; assert.equal(result.vocabulary, manifest); } });
  assert.equal(await startup.start(), null);
  assert.equal(container.inert, true);
  assert.equal(starts, 0);
  assert.equal(retry.hidden, false);
  assert.match(status.textContent, /Gameplay has not started/);
  assert.equal(status.attrs.role, 'alert');
  await retry.listeners.click();
  assert.equal(starts, 1);
  assert.equal(container.inert, false);
  assert.equal(retry.hidden, true);
});

test('unexpected UI initialization failure stays inert and cannot register a second set of handlers', async () => {
  const container = surface(), status = surface(), retry = surface();
  let starts = 0;
  const startup = createGameStartup({ container, status, retry,
    load: async () => ({ vocabulary: manifest }),
    start: () => { starts += 1; throw new Error('UI initialization failed'); } });
  await startup.start();
  await startup.start();
  assert.equal(container.inert, true);
  assert.equal(retry.hidden, true);
  assert.equal(starts, 1);
  assert.match(status.textContent, /Reload this page/);
});
