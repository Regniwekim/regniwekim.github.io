import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALPHABET, canonicalWords, analyzeVocabulary } from '../src/analysis/vocabulary.js';
import { analyzeBag, BAG_SIGNATURE } from '../src/analysis/bag.js';
import { LETTER_DISTRIBUTION, createStandardTiles } from '../src/core/bag.js';
import { VOCABULARY } from '../src/vocabulary/manifest.js';
import { verifyVocabulary, loadAnalysisSource, PROFILE_URL } from '../scripts/letter-analysis-source.js';

const at = (letter) => ALPHABET.indexOf(letter);

test('vocabulary statistics distinguish occurrences, presence, repeats and exact length groups', () => {
  const words = ['AT', 'TAT', 'TEETH', 'EEEE', 'ABCDEFG', 'ABCDEFGH', 'ABCDEFGHI', 'ABCDEFGHIJ'];
  const result = analyzeVocabulary(words);
  assert.equal(result.totalWords, 8);
  assert.deepEqual(result.lengthRanges, { '2-7': 5, '8-9': 2, beyond9: 1 });
  assert.equal(result.byLength.length, 29);
  assert.equal(result.byLength[0].percentage, 12.5);
  assert.equal(result.byLength[1].cumulativeCount, 2);
  assert.equal(result.byLength[28].cumulativeCount, 8);
  const all = result.groups.all;
  assert.equal(all.totalLetterOccurrences, words.reduce((sum, word) => sum + word.length, 0));
  assert.equal(all.occurrences[at('E')], 10);
  assert.equal(all.wordPresence[at('E')], 6);
  assert.equal(all.repeatedLetterWords[at('E')], 2);
  assert.equal(all.occurrences[at('T')], 5);
  assert.equal(all.wordPresence[at('T')], 3);
  assert.equal(all.repeatedLetterWords[at('T')], 2);
  assert.equal(all.wordsWithRepeatedLetters, 3);
  assert.equal(all.wordsWithAdjacentRepeat, 2);
  assert.equal(all.relativeFrequency[at('E')], 10 / all.totalLetterOccurrences);
  assert.equal(result.groups['2-3'].wordCount, 2);
  assert.equal(result.groups['4-5'].wordCount, 2);
  assert.equal(result.groups['6-7'].wordCount, 1);
  assert.equal(result.groups['8-9'].wordCount, 2);
  assert.equal(result.byLength[3].vowelCounts[2], 1); // TEETH has two E vowels.
  assert.equal(result.byLength[2].maxMultiplicityCounts[4], 1); // EEEE.
  assert.equal(result.byLength[3].firstLetters[at('T')], 1);
  assert.equal(result.byLength[3].finalLetters[at('H')], 1);
  assert.equal(result.byLength[3].wordPresence[at('E')], 1);
});

test('ordered pairs/triples count overlapping occurrences and break equal counts by ASCII', () => {
  const result = analyzeVocabulary(['THHT', 'HTTH', 'AAAA'], { combinationLimit: 100 });
  const pairs = Object.fromEntries(result.combinations.pairs.map(({ text, count }) => [text, count]));
  const triples = Object.fromEntries(result.combinations.triples.map(({ text, count }) => [text, count]));
  assert.equal(pairs.AA, 3);
  assert.equal(pairs.TH, 2);
  assert.equal(pairs.HT, 2);
  assert.equal(triples.AAA, 2);
  assert.equal(triples.THH, 1);
  assert.equal(triples.HHT, 1);
  assert.deepEqual(result.combinations.pairs.map(({ text }) => text), ['AA', 'HT', 'TH', 'HH', 'TT']);
  assert.deepEqual(result, analyzeVocabulary(['aaaa', 'HTTH', 'THHT', 'AAAA'], { combinationLimit: 100 }));
  assert.deepEqual(analyzeVocabulary(['TH']).combinations.pairs, [{ text: 'TH', count: 1 }]);
});

test('empty vocabulary remains finite and malformed sources fail before analysis', () => {
  const empty = analyzeVocabulary([]);
  assert.equal(empty.totalWords, 0);
  assert.deepEqual(empty.groups.all.relativeFrequency, Array(26).fill(0));
  assert.ok(empty.byLength.every((profile) => profile.percentage === 0 && profile.cumulativeCount === 0));
  for (const bad of [null, 'AT', 4, {}, ['A'], ['A-T'], ['ß'], ['X'.repeat(31)], [null], Array(2)]) {
    assert.throws(() => analyzeVocabulary(bad), TypeError);
  }
  for (const combinationLimit of [-1, 0.5, Infinity]) assert.throws(() => analyzeVocabulary([], { combinationLimit }), RangeError);
  assert.deepEqual(canonicalWords(new Set([' at ', 'AT', 'ox'])), ['AT', 'OX']);
});

test('bag profile derives every tile and expectation from the core distribution', () => {
  const profile = analyzeVocabulary(['AAAA', 'AT', 'TEETH', 'OX']);
  const bag = analyzeBag(profile);
  assert.equal(bag.totalTiles, 100);
  assert.equal(bag.blankCount, 2);
  assert.equal(bag.blankFraction, 0.02);
  assert.equal(bag.signature, BAG_SIGNATURE);
  assert.deepEqual(Object.fromEntries(bag.letters.map(({ letter, count }) => [letter, count])), LETTER_DISTRIBUTION);
  assert.equal(createStandardTiles().length, bag.totalTiles);
  for (const entry of bag.letters) {
    assert.equal(entry.fraction, entry.count / 100);
    for (const capacity of [7, 8, 9]) assert.ok(Math.abs(entry.expectedInRack[capacity] - capacity * entry.count / 100) < 1e-12);
    if (entry.dictionaryShare) {
      assert.equal(entry.physicalAvailabilityRatio, entry.fraction / entry.dictionaryShare);
      assert.equal(entry.availabilityRatio, (entry.count / 98) / entry.dictionaryShare);
    } else assert.equal(entry.availabilityRatio, null);
  }
  const dense = analyzeBag(analyzeVocabulary([ALPHABET]));
  const normalizedSum = dense.letters.slice(0, 26).reduce((sum, entry) => sum + entry.dictionaryShare * entry.availabilityRatio, 0);
  assert.ok(Math.abs(normalizedSum - 1) < 1e-12);
  assert.ok(analyzeBag(analyzeVocabulary([])).letters.every((entry) => entry.availabilityRatio === null));
  // The development layer imports the core distribution; it contains no copied counts table.
  const module = readFileSync(new URL('../src/analysis/bag.js', import.meta.url), 'utf8');
  assert.match(module, /import \{ LETTER_DISTRIBUTION/);
  assert.doesNotMatch(module, /A:\s*9|E:\s*12/);
});

test('real vocabulary uses the pinned manifest, original bytes and parser; profile retains every entry', () => {
  const source = loadAnalysisSource();
  assert.equal(source.words.length, 78626);
  const profile = JSON.parse(readFileSync(PROFILE_URL, 'utf8'));
  assert.equal(profile.source.id, VOCABULARY.id);
  assert.equal(profile.source.sha256, VOCABULARY.sha256);
  const actual = analyzeVocabulary(source.words);
  assert.equal(actual.totalWords, source.words.length);
  assert.equal(actual.byLength.reduce((sum, length) => sum + length.wordCount, 0), 78626);
  assert.equal(actual.groups.all.occurrences.reduce((sum, value) => sum + value, 0), actual.groups.all.totalLetterOccurrences);
  assert.equal(actual.lengthRanges['2-7'] + actual.lengthRanges['8-9'] + actual.lengthRanges.beyond9, 78626);
  assert.equal(source.prepared.indexedWords, actual.lengthRanges['2-7'] + actual.lengthRanges['8-9']);
  const bytes = readFileSync(new URL(`../vocabulary/${VOCABULARY.file}`, import.meta.url));
  assert.deepEqual(verifyVocabulary(bytes), source.words);
  const corrupt = Buffer.from(bytes);
  corrupt[corrupt.length - 3] ^= 1;
  assert.throws(() => verifyVocabulary(corrupt), /checksum/);
  for (const manifest of [{ ...VOCABULARY, id: 'other' }, { ...VOCABULARY, sha256: '0'.repeat(64) },
    { ...VOCABULARY, count: 1 }, { ...VOCABULARY, integrity: 'bad' }, { ...VOCABULARY, bytes: 0 }]) {
    assert.throws(() => verifyVocabulary(bytes, manifest), TypeError);
  }
});
