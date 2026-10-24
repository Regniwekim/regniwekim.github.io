import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, basename, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = new URL('../index.html', import.meta.url);
const arcade = new URL('../../index.html', import.meta.url);
const html = readFileSync(entry, 'utf8');
const home = readFileSync(arcade, 'utf8');

function localReference(reference, from) {
  const url = new URL(reference, from);
  if (url.protocol !== 'file:') return;
  url.hash = ''; url.search = '';
  let path = fileURLToPath(url);
  if (statSync(path).isDirectory()) path = join(path, 'index.html');
  // Windows accepts incorrect case; Pages does not. Check each real path segment.
  let current = path;
  while (current !== parse(current).root) {
    assert.ok(readdirSync(dirname(current)).includes(basename(current)), `Exact case: ${current}`);
    current = dirname(current);
  }
}

test('release entry and arcade references resolve with exact case on static hosting', () => {
  for (const [source, url] of [[html, entry], [home, arcade],
    [readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8'), new URL('../styles/main.css', import.meta.url)]]) {
    for (const [, attribute, css] of source.matchAll(/(?:href|src)="([^"]+)"|url\(['"]?([^)'"\s]+)['"]?\)/g)) {
      localReference(attribute ?? css, url);
    }
  }
  const pending = [new URL('../src/main.js', import.meta.url)], visited = new Set();
  while (pending.length) {
    const url = pending.pop();
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const source = readFileSync(url, 'utf8');
    assert.doesNotMatch(source, /private-store\.local|[A-Z]:[\\/]|serviceWorker/);
    assert.doesNotMatch(url.pathname, /\/scripts\/|\/tests\//);
    for (const [, reference] of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      assert.match(reference, /^\.\.?\//, `Local runtime module: ${reference}`);
      localReference(reference, url);
      pending.push(new URL(reference, url));
    }
  }
  assert.ok(visited.size > 20);
});

test('arcade exposes two playable games with unique accessible card names', () => {
  const ids = [...home.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const cards = [...home.matchAll(/<a class="game-card" href="([^"]+)" aria-labelledby="([^"]+)"/g)];
  assert.deepEqual(cards.map((match) => match[1]), ['./demo-game/', './wordstead/']);
  for (const [, , labels] of cards) for (const id of labels.split(' ')) assert.ok(ids.includes(id));
  assert.match(home, /02 GAMES \/ ∞ REPLAYS/);
  assert.match(home, /id="wordstead-title">WORDSTEAD</);
  assert.match(html, /href="\.\.\/index\.html"/);
});

test('release metadata preserves crawler policy and uses original local branding', () => {
  for (const source of [html, home]) assert.match(source, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /<title>Wordstead · Daily Puzzle &amp; Free Play<\/title>/);
  assert.match(html, /name="theme-color" content="#[a-f0-9]{6}"/);
  assert.match(html, /property="og:url" content="https:\/\/games\.regniwekim\.com\/wordstead\/"/);
  assert.match(html, /rel="icon" href="\.\/assets\/favicon\.svg"/);
  assert.doesNotMatch(html, /In development|prototype|Milestone \d/i);
  assert.match(html, /Automatic targets are experimental; difficulty varies and completion is not guaranteed/);
  assert.match(html, /Clearing website data or browser eviction can remove saves and history/);
});
