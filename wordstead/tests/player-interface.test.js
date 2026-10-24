import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const voidTags = new Set(['meta', 'link', 'input', 'br', 'hr', 'base', 'img']);
// A small structural check for this static entry page, independent of controller doubles.
function structure() {
  const ids = new Map(), stack = [];
  for (const match of html.matchAll(/<(\/?)([a-z][\w-]*)\b([^>]*)>/gi)) {
    const [, closing, tag, attributes] = match;
    if (closing) {
      assert.equal(stack.pop()?.tag, tag, `Balanced markup at ${match[0]}`);
      continue;
    }
    const id = /\bid="([^"]+)"/.exec(attributes)?.[1];
    const node = { tag, id, attributes, parents: [...stack] };
    if (id) { assert.ok(!ids.has(id), `Unique ID: ${id}`); ids.set(id, node); }
    if (!voidTags.has(tag)) stack.push(node);
  }
  assert.equal(stack.length, 0);
  return ids;
}

test('entry page preserves controller targets, labels and internal navigation after rearranging panels', () => {
  const ids = structure();
  const uiDirectory = new URL('../src/ui/', import.meta.url);
  for (const file of readdirSync(uiDirectory).filter((name) => name.endsWith('.js'))) {
    const source = readFileSync(new URL(file, uiDirectory), 'utf8');
    for (const [, id] of source.matchAll(/find\('([^']+)'\)/g)) {
      assert.ok(ids.has(id), `${file} binds existing #${id}`);
    }
  }
  for (const [, references] of html.matchAll(/(?:aria-labelledby|aria-describedby|for)="([^"]+)"/g)) {
    for (const id of references.split(' ')) assert.ok(ids.has(id), `Label reference #${id}`);
  }
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), `Navigation target #${id}`);
});

test('play order keeps the board and rack ahead of utilities, with closed native disclosures and visible warnings', () => {
  const ids = structure();
  assert.ok(html.indexOf('id="board-viewport"') < html.indexOf('id="rack"'));
  assert.ok(html.indexOf('id="rack"') < html.indexOf('id="commit-word"'));
  assert.ok(html.indexOf('id="commit-word"') < html.indexOf('id="history"'));
  assert.ok(ids.get('mode').parents.some((node) => node.id === 'development-tools'));
  assert.ok(ids.get('dimensions').parents.some((node) => node.id === 'setup-panel'));
  for (const id of ['history', 'how-to-play', 'setup-panel', 'development-tools']) {
    assert.equal(ids.get(id).tag, 'details');
    assert.doesNotMatch(ids.get(id).attributes, /\bopen\b/);
  }
  for (const id of ['save-context', 'history-attention', 'daily-context', 'action-status']) {
    assert.ok(!ids.get(id).parents.some((node) => node.tag === 'details'), `#${id} remains outside closed disclosures`);
  }
  assert.equal(ids.get('play-daily').tag, 'button');
  assert.equal(ids.get('play-free').tag, 'button');
  assert.match(ids.get('play-daily').attributes, /aria-pressed="true"/);
});
