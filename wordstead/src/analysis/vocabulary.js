import { normalizeWord } from '../core/dictionary.js';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const zeros = () => Array(26).fill(0);

/** Match dictionary normalization, but retain only its supported analysis lengths. */
export function canonicalWords(source) {
  if (typeof source === 'string' || !source || typeof source[Symbol.iterator] !== 'function') {
    throw new TypeError('Supply an iterable of words, not a text string.');
  }
  const unique = new Set();
  for (const value of source) {
    const word = normalizeWord(value);
    if (!word || word.length < 2 || word.length > 30) {
      throw new TypeError('Analysis words must contain 2–30 ASCII letters.');
    }
    unique.add(word);
  }
  return [...unique].sort();
}

/** Noncryptographic identity for injected word sources; pinned files also use SHA-256. */
export function wordFingerprint(words) {
  let hash = 2166136261;
  for (const word of words) {
    for (const character of `${word}\n`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return `fnv1a32-${hash.toString(16).padStart(8, '0')}`;
}

function emptyProfile() {
  return { wordCount: 0, totalLetterOccurrences: 0, occurrences: zeros(),
    wordPresence: zeros(), repeatedLetterWords: zeros(), firstLetters: zeros(), finalLetters: zeros(),
    wordsWithRepeatedLetters: 0, wordsWithAdjacentRepeat: 0 };
}

function addWord(profile, word, counts) {
  profile.wordCount += 1;
  profile.totalLetterOccurrences += word.length;
  profile.firstLetters[word.charCodeAt(0) - 65] += 1;
  profile.finalLetters[word.charCodeAt(word.length - 1) - 65] += 1;
  for (let letter = 0; letter < 26; letter += 1) {
    profile.occurrences[letter] += counts[letter];
    profile.wordPresence[letter] += Number(counts[letter] > 0);
    profile.repeatedLetterWords[letter] += Number(counts[letter] > 1);
  }
  profile.wordsWithRepeatedLetters += Number(counts.some((count) => count > 1));
  profile.wordsWithAdjacentRepeat += Number(/([A-Z])\1/.test(word));
}

function finish(profile) {
  return { ...profile, relativeFrequency: profile.occurrences.map((count) =>
    profile.totalLetterOccurrences ? count / profile.totalLetterOccurrences : 0) };
}

/** Ordered combinations, occurrence counts, descending count then ASCII tie-break. */
export function rankCombinations(counts, limit) {
  return [...counts].map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0)).slice(0, limit);
}

export function analyzeVocabulary(source, { combinationLimit = 32 } = {}) {
  if (!Number.isSafeInteger(combinationLimit) || combinationLimit < 0) {
    throw new RangeError('Combination limit must be a nonnegative safe integer.');
  }
  const words = canonicalWords(source);
  const lengths = Array.from({ length: 29 }, (_, index) => ({ length: index + 2,
    ...emptyProfile(), vowelCounts: Array(index + 3).fill(0), maxMultiplicityCounts: Array(index + 3).fill(0) }));
  const groups = { all: emptyProfile(), '2-3': emptyProfile(), '4-5': emptyProfile(),
    '6-7': emptyProfile(), '8-9': emptyProfile() };
  const pairs = new Map();
  const triples = new Map();
  for (const word of words) {
    const counts = zeros();
    for (const letter of word) counts[letter.charCodeAt(0) - 65] += 1;
    const profile = lengths[word.length - 2];
    addWord(profile, word, counts);
    profile.vowelCounts[[...word].filter((letter) => 'AEIOU'.includes(letter)).length] += 1;
    profile.maxMultiplicityCounts[Math.max(...counts)] += 1;
    addWord(groups.all, word, counts);
    const group = word.length <= 3 ? '2-3' : word.length <= 5 ? '4-5' : word.length <= 7 ? '6-7' : '8-9';
    if (word.length <= 9) addWord(groups[group], word, counts);
    for (let index = 0; index < word.length - 1; index += 1) {
      const pair = word.slice(index, index + 2);
      pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
      if (index < word.length - 2) {
        const triple = word.slice(index, index + 3);
        triples.set(triple, (triples.get(triple) ?? 0) + 1);
      }
    }
  }
  let cumulativeCount = 0;
  return { alphabet: ALPHABET, totalWords: words.length, wordFingerprint: wordFingerprint(words),
    byLength: lengths.map((profile) => {
      cumulativeCount += profile.wordCount;
      return { ...finish(profile), percentage: words.length ? profile.wordCount * 100 / words.length : 0, cumulativeCount };
    }),
    lengthRanges: { '2-7': lengths.slice(0, 6).reduce((sum, profile) => sum + profile.wordCount, 0),
      '8-9': groups['8-9'].wordCount, beyond9: words.filter((word) => word.length > 9).length },
    groups: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, finish(value)])),
    combinations: { limit: combinationLimit, distinctPairs: pairs.size, distinctTriples: triples.size,
      pairs: rankCombinations(pairs, combinationLimit), triples: rankCombinations(triples, combinationLimit) } };
}
