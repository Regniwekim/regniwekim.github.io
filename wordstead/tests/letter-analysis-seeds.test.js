import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createBag, createStandardTiles } from '../src/core/bag.js';
import { prepareRackVocabulary, analyzeRack, parseRack } from '../src/analysis/rack.js';
import { analyzeSeed, analyzeBatch, analyzePotentialDraws, potentialPositions, sampleBaseline } from '../src/analysis/seeds.js';
import { quantile, summarize, stableJson, measureFlexibility, assertBaselineCompatible, SCHEMA_VERSION, METHOD_VERSION,
  fitBaseline } from '../src/analysis/statistics.js';
import { loadAnalysisSource, buildAnalysisArtifact, loadBaseline, PROFILE_URL, NOTICE_URL } from '../scripts/letter-analysis-source.js';
import { parseArguments } from '../scripts/analyze-letters.js';

const prepared = prepareRackVocabulary(['AT', 'TA', 'CAT', 'CATS', 'TEA', 'EAT', 'ATE', 'EATS', 'TASTES', 'SAT', 'SATES']);
const baseline = sampleBaseline(prepared, { sampleCount: 32, seed: 'test-reference' });

test('identical seeds have identical openings and JSON; numeric and string seeds remain distinct', () => {
  const first = analyzeSeed('farm', prepared, baseline);
  assert.deepEqual(first, analyzeSeed('farm', prepared, baseline));
  assert.equal(stableJson(first), stableJson(analyzeSeed('farm', prepared, baseline)));
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.methodVersion, METHOD_VERSION);
  assert.equal(first.opening.rack.letters, createBag('farm').bag.slice(0, 7).map((tile) => tile.letter ?? '?').join(''));
  assert.notDeepEqual(first.opening.tileIds, analyzeSeed('other', prepared, baseline).opening.tileIds);
  assert.notDeepEqual(analyzeSeed(42, prepared, baseline).opening.tileIds, analyzeSeed('42', prepared, baseline).opening.tileIds);
  assert.throws(() => analyzeSeed('', prepared, baseline), TypeError);
});

test('potential samples stay wholly in the remaining physical bag without changing its order or RNG', () => {
  const generated = createBag('physical-windows');
  const before = structuredClone(generated);
  generated.bag.forEach(Object.freeze);
  Object.freeze(generated.bag);
  Object.freeze(generated);
  const report = analyzePotentialDraws(generated.bag, prepared, baseline);
  assert.deepEqual(report.positions, [7, 17, 28, 39, 50, 60, 71, 82, 93]);
  assert.equal(report.samples.length, 9);
  for (const sample of report.samples) {
    assert.ok(sample.start >= 7);
    assert.ok(sample.endExclusive <= 100);
    assert.equal(sample.tileIds.length, 7);
    assert.equal(new Set(sample.tileIds).size, 7);
    assert.deepEqual(sample.tileIds, generated.bag.slice(sample.start, sample.endExclusive).map((tile) => tile.id));
    assert.deepEqual(sample.rack, analyzeRack(generated.bag.slice(sample.start, sample.endExclusive), prepared));
  }
  assert.equal(report.phases.early.sampleCount, 3);
  assert.equal(report.phases.mid.sampleCount, 3);
  assert.equal(report.phases.late.sampleCount, 3);
  assert.deepEqual(generated, before);
  const all = analyzePotentialDraws(generated.bag, prepared, baseline, { sampleCount: 87 });
  assert.equal(all.positions[0], 7);
  assert.equal(all.positions.at(-1), 93);
  assert.equal(new Set(all.positions).size, 87);
  assert.deepEqual(potentialPositions(100, { positions: [93, 7, 50] }), [7, 50, 93]);
  assert.deepEqual(potentialPositions(100, { sampleCount: 1 }), [7]);
  const empty = analyzePotentialDraws(generated.bag, prepared, baseline, { sampleCount: 0 });
  assert.equal(empty.summary.wordCount.mean, null);
  assert.equal(empty.phases.early.sampleCount, 0);
  for (const options of [{ sampleCount: 88 }, { sampleCount: -1 }, { positions: [0] }, { positions: [94] },
    { positions: [7, 7] }, { positions: [7.2] }, { positions: Array(1) }]) {
    assert.throws(() => analyzePotentialDraws(generated.bag, prepared, baseline, options), RangeError);
  }
  const bad = createStandardTiles();
  bad[0] = { id: 0, letter: 'Z' };
  assert.throws(() => analyzePotentialDraws(bad, prepared, baseline), TypeError);
  assert.throws(() => analyzePotentialDraws(generated.bag.slice(1), prepared, baseline), TypeError);
  assert.throws(() => analyzePotentialDraws([...generated.bag.slice(1), generated.bag[1]], prepared, baseline), TypeError);
});

test('baselines deterministically shuffle independent bags and cover all capacities with exact sample statistics', () => {
  assert.deepEqual(baseline, sampleBaseline(prepared, { sampleCount: 32, seed: 'test-reference' }));
  const samples = { 7: [], 8: [], 9: [] };
  for (let index = 0; index < 32; index += 1) {
    const { bag } = createBag(JSON.stringify(['test-reference', index]));
    for (const capacity of [7, 8, 9]) samples[capacity].push(analyzeRack(bag.slice(0, capacity), prepared));
  }
  for (const capacity of [7, 8, 9]) {
    assert.equal(baseline.capacities[capacity].sampleCount, 32);
    assert.deepEqual(baseline.capacities[capacity].wordCount, summarize(samples[capacity].map((sample) => sample.wordCount)));
    for (let length = 2; length <= capacity; length += 1) {
      assert.deepEqual(baseline.capacities[capacity].byLength[length], summarize(samples[capacity].map((sample) => sample.byLength[length])));
    }
  }
  assert.deepEqual(baseline, fitBaseline(samples, prepared.identity, { seed: 'test-reference', sampleCount: 32 }));
  const empty = sampleBaseline(prepared, { sampleCount: 0 });
  assert.equal(empty.capacities[7].normalization.meanLogCountByLength[2], null);
  assert.equal(empty.capacities[9].wordCount.mean, null);
  assert.equal(empty.capacities[7].flexibility.overall.quantiles.p50, null);
  for (const sampleCount of [-1, 0.5, Infinity]) assert.throws(() => sampleBaseline(prepared, { sampleCount }), RangeError);
  assert.throws(() => sampleBaseline(prepared, { seed: '' }), TypeError);
});

test('batch summaries are reproducible, handle empty samples and configurable text/numeric sequences', () => {
  const options = { count: 8, prefix: 'batch-test', start: 4, positions: [7, 50, 93] };
  const report = analyzeBatch(prepared, baseline, options);
  assert.equal(stableJson(report), stableJson(analyzeBatch(prepared, baseline, options)));
  assert.equal(report.opening.sampleCount, 8);
  assert.equal(report.potentialDraws.pooled.sampleCount, 24);
  assert.equal(report.potentialDraws.phases.mid.sampleCount, 8);
  const exact = Array.from({ length: 8 }, (_, index) => analyzeSeed(`batch-test:${index + 4}`, prepared, baseline, { positions: [] }));
  assert.deepEqual(report.opening.wordCount, summarize(exact.map((sample) => sample.opening.rack.wordCount)));
  const empty = analyzeBatch(prepared, baseline, { count: 0 });
  assert.equal(empty.opening.wordCount.mean, null);
  assert.deepEqual(empty.openingOutliers, { lowest: [], highest: [] });
  const numeric = analyzeBatch(prepared, baseline, { count: 1, numeric: true, start: -1, sampleCount: 0 });
  assert.deepEqual(numeric.opening.wordCount, summarize([analyzeSeed(-1, prepared, baseline).opening.rack.wordCount]));
  assert.equal(numeric.potentialDraws.pooled.wordCount.mean, null);
  assert.equal(numeric.sampling.prefix, null);
  assert.throws(() => analyzeBatch(prepared, baseline, { count: -1 }), RangeError);
  assert.throws(() => analyzeBatch(prepared, baseline, { start: Number.MAX_SAFE_INTEGER, count: 2 }), RangeError);
  assert.throws(() => analyzeBatch(prepared, baseline, { count: 0, positions: [94] }), RangeError);
});

test('type-7 quantiles, population variability, finite JSON and empty/invalid numeric samples', () => {
  assert.equal(quantile([30, 0, 20, 10], 0.25), 7.5);
  assert.equal(quantile([30, 0, 20, 10], 0.5), 15);
  assert.equal(quantile([30, 0, 20, 10], 0.95), 28.5);
  assert.equal(quantile([3], 0.99), 3);
  assert.equal(quantile([], 0.5), null);
  assert.equal(summarize([1, 3]).standardDeviation, 1);
  assert.deepEqual(summarize([]).quantiles, { p0: null, p01: null, p05: null, p25: null, p50: null,
    p75: null, p95: null, p99: null, p100: null });
  for (const probability of [-1, 2, NaN]) assert.throws(() => quantile([1], probability), RangeError);
  for (const bad of [[NaN], [Infinity], Array(2), ['1'], null]) assert.throws(() => summarize(bad), TypeError);
  assert.throws(() => stableJson({ bad: Infinity }), TypeError);
  const copy = [3, 1, 2];
  quantile(copy, 0.5);
  assert.deepEqual(copy, [3, 1, 2]);
  assert.equal(stableJson({ x: 1 / 3 }), '{\n  "x": 0.333333333333\n}\n');
  assert.equal(JSON.parse(stableJson({ seed: 1e-20 })).seed, 1e-20);
  assert.equal(JSON.parse(stableJson({ seed: 1.123456789012345 })).seed, 1.123456789012345);
});

test('baseline compatibility rejects vocabulary, bag, schema and method mismatches', () => {
  for (const bad of [{ ...baseline, schemaVersion: 2 }, { ...baseline, methodVersion: 'other' },
    { ...baseline, bagId: 'other' }, { ...baseline, bagSignature: 'other' },
    { ...baseline, identity: { ...baseline.identity, vocabularyId: 'other' } },
    { ...baseline, identity: { ...baseline.identity, vocabularySha256: '0'.repeat(64) } },
    { ...baseline, identity: { ...baseline.identity, wordFingerprint: 'other' } }]) {
    assert.throws(() => assertBaselineCompatible(bad, prepared.identity), TypeError);
    assert.throws(() => analyzeSeed('farm', prepared, bad), TypeError);
  }
  assert.equal(SCHEMA_VERSION, 1);
});

test('committed profile and notice regenerate byte for byte from the exact licensed vocabulary', () => {
  const source = loadAnalysisSource();
  const generated = buildAnalysisArtifact(source);
  assert.equal(stableJson(generated.profile), readFileSync(PROFILE_URL, 'utf8'));
  assert.equal(generated.notice, readFileSync(NOTICE_URL, 'utf8'));
  assert.match(generated.notice, /Copyright 2000-2026 by Kevin Atkinson/);
  assert.match(generated.notice, /is hereby granted without fee/);
  assert.equal(loadBaseline(source.prepared).identity.vocabularyId, source.prepared.identity.vocabularyId);
  assert.equal(measureFlexibility(analyzeRack(parseRack('AEIRSTN'), source.prepared), generated.profile.baseline).overall > 0, true);
  // The browser entry point has no imports of development analysis or its artifact.
  for (const path of ['../src/main.js', '../src/vocabulary/loader.js', '../src/ui/sandbox.js']) {
    assert.doesNotMatch(readFileSync(new URL(path, import.meta.url), 'utf8'), /analysis\/|letter-analysis/);
  }
});

test('CLI validates arguments without silently ignoring unsupported modes or options', () => {
  for (const args of [[], ['other'], ['rack'], ['rack', 'AEIRSTN', 'extra'], ['rack', 'AEIRSTN', '--numeric'],
    ['seed', 'farm', '--windows', '2', '--positions', '7'], ['batch', '--count', '-1'],
    ['batch', '--count', '1.5'], ['batch', '--count'], ['batch', '--json', '--json'],
    ['batch', '--numeric', '--prefix', 'ignored'], ['vocabulary', '--samples', '10'],
    ['seed', 'NaN', '--numeric'], ['seed', 'farm', '--positions', '7,,8']]) {
    assert.throws(() => parseArguments(args));
  }
  assert.equal(parseArguments(['seed', '42', '--numeric']).seed, 42);
  assert.equal(parseArguments(['seed', '42']).seed, '42');
  assert.equal(parseArguments(['batch', '--count', '0']).options.count, 0);
});

test('CLI emits repeatable machine JSON, supports short diagnostics and reports failures on stderr', () => {
  const cli = fileURLToPath(new URL('../scripts/analyze-letters.js', import.meta.url));
  function run(args) { return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }); }
  const first = run(['rack', 'AEIRS??', '--json']);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, run(['rack', 'AEIRS??', '--json']).stdout);
  const report = JSON.parse(first.stdout);
  assert.equal(report.rack.blankCount, 2);
  assert.equal(report.schemaVersion, 1);
  const shortRack = run(['rack', 'AT', '--allow-short', '--json']);
  assert.equal(shortRack.status, 0, shortRack.stderr);
  assert.equal(JSON.parse(shortRack.stdout).flexibility, null);
  const invalid = run(['rack', 'AAA???A', '--json']);
  assert.notEqual(invalid.status, 0);
  assert.equal(invalid.stdout, '');
  assert.match(invalid.stderr, /two blanks/);
});
