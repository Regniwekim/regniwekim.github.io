import test from 'node:test';
import assert from 'node:assert/strict';
import { createBag } from '../src/core/bag.js';
import { createSession } from '../src/core/session.js';
import { analyzeRack, prepareRackVocabulary, parseRack } from '../src/analysis/rack.js';
import { sampleBaseline } from '../src/analysis/seeds.js';
import { measureFlexibility, METRIC_WEIGHTS } from '../src/analysis/statistics.js';
import { loadAnalysisSource } from '../scripts/letter-analysis-source.js';

const short = { allowShort: true };
const words = ['AT', 'TA', 'AA', 'CAT', 'ACT', 'TACT', 'TATA', 'CATS', 'SCAT', 'ATTIC', 'TACTIC'];
const prepared = prepareRackVocabulary(words);

test('rack constructibility uses multiplicities, actual words and independent anagram spellings', () => {
  const exact = analyzeRack(parseRack('CAT', short), prepared, short);
  assert.equal(exact.wordCount, 4); // AT, TA, ACT, CAT.
  assert.deepEqual(exact.byLength, { 2: 2, 3: 2, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
  assert.equal(exact.longestWord, 'ACT'); // ASCII tie-break.
  assert.equal(exact.distinctInitialLetters, 3);
  assert.equal(exact.distinctFinalLetters, 2);
  assert.deepEqual(exact.coveredLengths, [2, 3]);
  assert.equal(exact.lengthCoverage, 1);
  assert.deepEqual(exact.combinations, { distinctPairs: 5, distinctTriples: 2, total: 7 });
  const single = analyzeRack(parseRack('AT', short), ['AA', 'AT', 'AAA'], short);
  assert.equal(single.wordCount, 1);
  const duplicate = analyzeRack(parseRack('AAT', short), ['AA', 'AA', 'aa', 'AT', 'AAA'], short);
  assert.equal(duplicate.wordCount, 2);
  assert.equal(analyzeRack(parseRack('AAA', short), ['AA', 'AAA'], short).wordCount, 2);
  assert.equal(analyzeRack(parseRack('ZZZZZZZ'), prepared).wordCount, 0);
});

test('one/two physical blanks supply missing occurrences once without permanent assignments', () => {
  const one = parseRack('C?T', short).map(Object.freeze);
  Object.freeze(one);
  const before = JSON.stringify(one);
  assert.equal(analyzeRack(one, prepared, short).wordCount, 4);
  assert.equal(JSON.stringify(one), before);
  assert.equal(one[1].letter, null);
  assert.equal(analyzeRack(parseRack('A?', short), ['AA', 'AB', 'BB'], short).wordCount, 2);
  assert.equal(analyzeRack(parseRack('??', short), ['AA', 'AB', 'BB', 'AAA'], short).wordCount, 3);
  assert.equal(analyzeRack(parseRack('T??', short), ['AAA', 'TAT', 'TTA', 'TTT'], short).wordCount, 3);
  assert.equal(analyzeRack(parseRack('A??', short), ['AA', 'AAA', 'ABA', 'AAA'], short).wordCount, 3);
  const rack = parseRack('TACTICS');
  const a = analyzeRack(rack, prepared);
  const b = analyzeRack(rack.map((tile, i) => i === 0 ? { ...tile, letter: null } : tile), prepared);
  const c = analyzeRack(rack.map((tile, i) => i < 2 ? { ...tile, letter: null } : tile), prepared);
  assert.ok(a.wordCount <= b.wordCount && b.wordCount <= c.wordCount);
});

test('all capacities, duplicate-letter IDs, source/rack ordering and frozen inputs preserve counts', () => {
  const source = Object.freeze(['AA', 'AAAAAAA', 'AAAAAAAA', 'AAAAAAAAA', 'AAAAAAAAAA']);
  const index = prepareRackVocabulary(source);
  for (const capacity of [7, 8, 9]) {
    const rack = Object.freeze(parseRack('A'.repeat(capacity)).map(Object.freeze));
    const before = JSON.stringify(rack);
    const report = analyzeRack(rack, index);
    assert.equal(report.wordCount, capacity - 5);
    assert.equal(report.longestLength, capacity);
    assert.equal(report.byLength[capacity], 1);
    assert.equal(JSON.stringify(rack), before);
    assert.deepEqual(report, analyzeRack(rack, [...source].reverse()));
    assert.equal(analyzeRack(rack.slice().reverse(), index).wordCount, report.wordCount);
    assert.equal(report.distinctInitialLetters, 1);
    assert.equal(report.distinctFinalLetters, 1);
  }
  assert.ok(Object.isFrozen(index));
  assert.equal(index.indexedWords, 4);
  assert.equal(index.signatureBytes, index.nodes * 9);
});

test('invalid physical racks and unsupported text fail explicitly; short analysis is opt-in', () => {
  for (const text of ['ABC', 'ABCDEFGHIJ', 'AAA???A', 'AA!AAAA', 'A AAAAA', 'ÄAAAAAA', 'ßAAAAAA', 'ＡAAAAAA']) {
    assert.throws(() => parseRack(text));
  }
  for (const rack of [null, 'AEIRSTN', Array(7), [...parseRack('AEIRSTN').slice(1), { id: 1, letter: 'A' }],
    [...parseRack('AEIRSTN').slice(1), { id: -1, letter: 'A' }],
    [...parseRack('AEIRSTN').slice(1), { id: 10, letter: '?' }],
    [...parseRack('AEIRSTN').slice(1), { id: 10, letter: 'a' }]]) {
    assert.throws(() => analyzeRack(rack, prepared));
  }
  assert.deepEqual(parseRack('aeirstn'), parseRack('AEIRSTN'));
  const empty = analyzeRack([], prepared, short);
  assert.equal(empty.wordCount, 0);
  assert.equal(empty.longestWord, null);
  assert.equal(empty.lengthCoverage, 0);
  assert.equal(analyzeRack(parseRack('A', short), prepared, short).wordCount, 0);
  assert.equal(analyzeRack(parseRack('AEIRSTN'), []).wordCount, 0);
  assert.throws(() => prepareRackVocabulary(words, { sha256: 'bad' }), TypeError);
});

test('indexed analyzer agrees with an independent full scan on real seeded racks and blanks', () => {
  const source = loadAnalysisSource();
  for (const text of ['AEIRSTN', 'BCDFGHT', 'AAEELLS', 'JQXZKUV', 'AEIRST?', 'AEIRS??', 'AEIRSTNL', 'AEIRSTNLO',
    createBag('scan-oracle').bag.slice(0, 9).map((tile) => tile.letter ?? '?').join('')]) {
    const rack = parseRack(text);
    const counts = Object.create(null);
    for (const tile of rack) counts[tile.letter ?? '?'] = (counts[tile.letter ?? '?'] ?? 0) + 1;
    const constructible = source.words.filter((word) => {
      if (word.length > rack.length) return false;
      const remaining = { ...counts };
      let missing = 0;
      for (const letter of word) {
        if (remaining[letter]) remaining[letter] -= 1;
        else missing += 1;
      }
      return missing <= (counts['?'] ?? 0);
    });
    const report = analyzeRack(rack, source.prepared);
    assert.equal(report.wordCount, constructible.length, text);
    for (let length = 2; length <= 9; length += 1) {
      assert.equal(report.byLength[length], constructible.filter((word) => word.length === length).length, `${text}/${length}`);
    }
  }
});

test('normalization weights lengths before groups, remains bounded and does not fabricate short calibration', () => {
  const baseline = sampleBaseline(prepared, { sampleCount: 80, seed: 'metrics-test' });
  const lean = analyzeRack(parseRack('ZZZZZZZ'), prepared);
  const rich = analyzeRack(parseRack('TACTICS'), prepared);
  assert.equal(measureFlexibility(lean, baseline).overall, 0);
  const metrics = measureFlexibility(rich, baseline);
  assert.ok(metrics.overall > 0);
  assert.ok(Object.values(metrics).every((value) => value >= 0 && value <= 1));
  assert.equal(Object.values(METRIC_WEIGHTS).reduce((sum, value) => sum + value, 0), 1);
  assert.equal(measureFlexibility(analyzeRack(parseRack('CAT', short), prepared, short), baseline), null);
  assert.equal(measureFlexibility(rich, sampleBaseline(prepared, { sampleCount: 0 })), null);
  // With a zero reference, a positive observed length receives 1 rather than NaN.
  const zero = structuredClone(baseline);
  for (const length of Object.keys(zero.capacities[7].normalization.meanLogCountByLength)) {
    zero.capacities[7].normalization.meanLogCountByLength[length] = 0;
  }
  assert.ok(Number.isFinite(measureFlexibility(rich, zero).overall));
  zero.capacities[7].normalization.meanLogCountByLength[2] = NaN;
  assert.throws(() => measureFlexibility(rich, zero), /normalization/);
});

test('analysis of a frozen live session preserves board, bag, RNG and temporary target', () => {
  const session = createSession({ seed: 'analysis-regression' });
  const before = structuredClone(session);
  session.rack.forEach(Object.freeze);
  Object.freeze(session.rack);
  Object.freeze(session.bag);
  Object.freeze(session);
  analyzeRack(session.rack, prepared);
  assert.deepEqual(session, before);
  assert.equal(session.target, 1);
});
