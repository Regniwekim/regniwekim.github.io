import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SOURCE, EXPORT_ARGS, transformExport } from '../scripts/vocabulary-source.js';
import { buildArtifacts } from '../scripts/generate-vocabulary.js';
import { parseVocabulary } from '../src/vocabulary/format.js';
import { VOCABULARY } from '../src/vocabulary/manifest.js';
import { createDictionary } from '../src/core/dictionary.js';
import { DEMO_WORDS, demoDictionary } from '../src/core/demo-vocabulary.js';

const text = readFileSync(new URL(`../vocabulary/${VOCABULARY.file}`, import.meta.url), 'utf8');
const notice = readFileSync(new URL('../licenses/esdb/Copyright', import.meta.url), 'utf8');
const words = parseVocabulary(text, VOCABULARY);
const gameplayDictionary = createDictionary(words);

test('generation deterministically normalizes, deduplicates and ASCII-sorts the source', () => {
  const a = transformExport('dogs\ncat\ndogs\nox\n');
  assert.deepEqual(a.words, ['CAT', 'DOGS', 'OX']);
  assert.equal(a.counts.duplicates, 1);
  assert.deepEqual(a.words, transformExport('ox\ndogs\ncat\ndogs\n').words);
  const first = buildArtifacts('ox\ncat\n', notice);
  assert.deepEqual(first, buildArtifacts('ox\ncat\n', notice));
  assert.equal(first.artifact, buildArtifacts('cat\nox\n', notice).artifact);
});

test('source policy filters unsupported spellings, capitalized names/initialisms and lengths', () => {
  const longest = 'a'.repeat(SOURCE.maxLength);
  const result = transformExport(`cat\nAlice\nNASA\niPhone\ncafé\nco-op\ncat's\ntwo words\nx2\netc.\na\n${longest}\n${longest}a\n`);
  assert.deepEqual(result.words, [longest.toUpperCase(), 'CAT']);
  assert.deepEqual(result.counts, { sourceEntries: 13, unsupported: 6, capitalized: 3,
    tooShort: 1, tooLong: 1, duplicates: 0, accepted: 2 });
  assert.ok(EXPORT_ARGS.includes('--wo-poses=abbr'));
  assert.ok(EXPORT_ARGS.includes('--wo-pos-categories=nonword,special,wordpart'));
  for (const tag of ['person', 'surname', 'place', 'name', 'abbr', 'abbr?']) {
    assert.ok(EXPORT_ARGS.find((arg) => arg.startsWith('--wo-pos-classes=')).split(/[=,]/).includes(tag));
  }
  assert.ok(EXPORT_ARGS.includes('--no-word-filter')); // Never strip punctuation into a playable word.
  assert.ok(EXPORT_ARGS.includes('--categories='));
});

test('malformed/empty exports and unexpected notices fail explicitly', () => {
  for (const raw of [null, '', 'cat', 'cat\n\n', 'cat\ndog\t\n', 'cat\n\0\n', ' cat\n', '<html>\n', 'a\n']) {
    assert.throws(() => transformExport(raw), TypeError);
  }
  assert.throws(() => buildArtifacts('cat\n', 'Unverified license'), /notice/);
});

test('committed vocabulary has the pinned count, exact bytes, checksum and embedded notice', () => {
  const report = JSON.parse(readFileSync(new URL('../vocabulary/generation.json', import.meta.url), 'utf8'));
  assert.deepEqual(report.output, VOCABULARY);
  assert.deepEqual(report.source, SOURCE);
  assert.deepEqual(report.exportArgs, EXPORT_ARGS);
  assert.equal(words.length, report.counts.accepted);
  assert.ok(words.length > 50000);
  assert.equal(Buffer.byteLength(text), VOCABULARY.bytes);
  assert.equal(createHash('sha256').update(text).digest('hex'), VOCABULARY.sha256);
  assert.equal(`sha256-${createHash('sha256').update(text).digest('base64')}`, VOCABULARY.integrity);
  assert.equal(createHash('sha256').update(notice).digest('hex'), report.noticeSha256);
  const { sourceEntries, ...filters } = report.counts;
  assert.equal(Object.values(filters).reduce((a, b) => a + b), sourceEntries);
  assert.ok(text.includes('# Copyright 2000-2026 by Kevin Atkinson\n'));
  assert.ok(text.includes('# created from it, is hereby granted without fee'));
});

test('artifact parser rejects truncation, wrong version, unsupported length, ordering and duplicates', () => {
  const small = { id: 'test', count: 2, minLength: 2, maxLength: 30 };
  const header = '# Wordstead vocabulary test\n';
  assert.deepEqual(parseVocabulary(`${header}AT\nOX\n`, small), ['AT', 'OX']);
  for (const body of ['AT\n', 'AT\nOX', 'OX\nAT\n', 'AT\nAT\n', 'at\nOX\n', 'A\nOX\n',
    `AT\n${'Z'.repeat(31)}\n`, 'AT\nO-X\n', 'AT\r\nOX\r\n']) {
    assert.throws(() => parseVocabulary(header + body, small), TypeError);
  }
  assert.throws(() => parseVocabulary('# Wordstead vocabulary other\nAT\nOX\n', small), TypeError);
});

test('gameplay membership is a repeatable synchronous boolean with common words and inflections', () => {
  for (const word of ['GARDEN', 'GARDENS', 'GARDENED', 'GARDENING', 'HARVEST', 'HARVESTS',
    'HARVESTED', 'HARVESTING', 'APPLE', 'APPLES', 'WALKED', 'WALKING', 'CHILDREN', 'BETTER',
    'AN', 'AT', 'BE', 'BY', 'DO', 'GO', 'IF', 'IN', 'IS', 'IT', 'OF', 'ON', 'OR', 'OX', 'TO', 'UP']) {
    for (let repeat = 0; repeat < 10; repeat += 1) {
      assert.equal(gameplayDictionary.has(word), true, word);
      assert.equal(gameplayDictionary.has(word.toLowerCase()), true, word);
      assert.equal(typeof gameplayDictionary.has(word), 'boolean');
    }
  }
  for (const word of ['QZX', 'ZZZ', '', 'A', 'I', 'two words', 'CO-OP', "CAT'S", 'CAT!', 'C4T',
    'café', 'ß', 'ı', 'ＡＴ', 'AT\u200b', null, 42, {}, 'ELIZABETH', 'BOSTON', 'MONDAY', 'NASA', 'FAQ']) {
    assert.equal(gameplayDictionary.has(word), false, String(word));
  }
  assert.equal(gameplayDictionary.has(' cAt '), true); // Existing normalizeWord contract.
  assert.ok(Object.isFrozen(gameplayDictionary));
});

test('QA vocabulary stays separately available and new ordinary words extend it', () => {
  for (const word of ['CAR', 'CAB', 'RAT', 'BAT']) {
    assert.equal(demoDictionary.has(word), true);
    assert.equal(gameplayDictionary.has(word), true);
  }
  for (const word of ['GARDEN', 'APPLE', 'HARVEST', 'WALKING']) {
    assert.equal(DEMO_WORDS.includes(word), false);
    assert.equal(gameplayDictionary.has(word), true);
  }
  assert.equal(createDictionary(['a']).has('A'), true); // Legacy API remains unrestricted by list policy.
});
