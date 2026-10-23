import { RACK_CAPACITY, MAX_RACK_CAPACITY, LETTER_DISTRIBUTION } from '../core/bag.js';
import { canonicalWords, wordFingerprint } from './vocabulary.js';

const indexes = new WeakMap();

/** Private sorted-multiset trie: anagram terminals, compact sibling/child arrays. */
export function prepareRackVocabulary(source, { id = 'injected', sha256 = null } = {}) {
  const words = canonicalWords(source);
  if (typeof id !== 'string' || !id || (sha256 !== null && !/^[a-f0-9]{64}$/.test(sha256))) {
    throw new TypeError('Supply a vocabulary ID and optional SHA-256 hex fingerprint.');
  }
  const nodes = [{ children: new Map(), words: [] }];
  let indexedWords = 0;
  let signatures = 0;
  for (const word of words) {
    if (word.length > MAX_RACK_CAPACITY) continue;
    indexedWords += 1;
    let node = 0;
    for (const letter of [...word].sort()) {
      const code = letter.charCodeAt(0) - 65;
      if (!nodes[node].children.has(code)) {
        nodes[node].children.set(code, nodes.length);
        nodes.push({ children: new Map(), words: [] });
      }
      node = nodes[node].children.get(code);
    }
    if (!nodes[node].words.length) signatures += 1;
    nodes[node].words.push(word);
  }
  const child = new Uint32Array(nodes.length);
  const sibling = new Uint32Array(nodes.length);
  const letter = new Uint8Array(nodes.length);
  const terminals = nodes.map((node) => node.words);
  nodes.forEach((node, index) => {
    let previous = 0;
    for (const [code, next] of [...node.children].sort((a, b) => a[0] - b[0])) {
      if (previous) sibling[previous] = next;
      else child[index] = next;
      letter[next] = code;
      previous = next;
    }
  });
  const prepared = Object.freeze({ identity: Object.freeze({ vocabularyId: id, vocabularySha256: sha256,
    wordFingerprint: wordFingerprint(words), wordCount: words.length }),
  indexedWords, signatures, nodes: nodes.length, signatureBytes: child.byteLength + sibling.byteLength + letter.byteLength });
  indexes.set(prepared, { child, sibling, letter, terminals });
  return prepared;
}

/** Diagnostic strings allocate unique IDs; physical callers retain their own IDs. */
export function parseRack(text, { allowShort = false } = {}) {
  if (typeof text !== 'string' || !/^[A-Za-z?]*$/.test(text)) throw new TypeError('Rack must contain only A–Z or ? for blanks.');
  const rack = [...text.toUpperCase()].map((letter, id) => ({ id, letter: letter === '?' ? null : letter }));
  validateRack(rack, { allowShort });
  return rack;
}

export function validateRack(rack, { allowShort = false } = {}) {
  if (!Array.isArray(rack) || rack.length > MAX_RACK_CAPACITY || (!allowShort && rack.length < RACK_CAPACITY)) {
    throw new RangeError('Rack must contain seven to nine physical tiles; short racks require allowShort.');
  }
  const ids = new Set();
  let blanks = 0;
  for (const tile of rack) {
    if (!tile || !Number.isSafeInteger(tile.id) || tile.id < 0 || ids.has(tile.id)
      || (tile.letter !== null && (typeof tile.letter !== 'string' || !/^[A-Z]$/.test(tile.letter)))) {
      throw new TypeError('Physical tiles need distinct nonnegative integer IDs and uppercase A–Z or null.');
    }
    ids.add(tile.id);
    blanks += Number(tile.letter === null);
  }
  if (blanks > LETTER_DISTRIBUTION['?']) throw new RangeError('A standard rack cannot contain more than two blanks.');
}

export function analyzeRack(rack, preparedOrWords, options = {}) {
  validateRack(rack, options);
  const prepared = indexes.has(preparedOrWords) ? preparedOrWords : prepareRackVocabulary(preparedOrWords);
  const { child, sibling, letter, terminals } = indexes.get(prepared);
  const counts = new Uint8Array(26);
  let blanks = 0;
  for (const tile of rack) {
    if (tile.letter === null) blanks += 1;
    else counts[tile.letter.charCodeAt(0) - 65] += 1;
  }
  const byLength = Object.fromEntries(Array.from({ length: MAX_RACK_CAPACITY - 1 }, (_, i) => [i + 2, 0]));
  const starts = new Set();
  const ends = new Set();
  const pairs = new Set();
  const triples = new Set();
  let wordCount = 0;
  let longestWord = null;
  function visit(parent, depth, remainingBlanks) {
    for (let node = child[parent]; node; node = sibling[node]) {
      const code = letter[node];
      const physical = counts[code] > 0;
      if (!physical && !remainingBlanks) continue;
      if (physical) counts[code] -= 1;
      for (const word of terminals[node]) {
        wordCount += 1;
        byLength[word.length] += 1;
        if (!longestWord || word.length > longestWord.length
          || (word.length === longestWord.length && word < longestWord)) longestWord = word;
        starts.add(word[0]);
        ends.add(word.at(-1));
        for (let i = 0; i < word.length - 1; i += 1) {
          pairs.add(word.slice(i, i + 2));
          if (i < word.length - 2) triples.add(word.slice(i, i + 3));
        }
      }
      if (depth + 1 < rack.length) visit(node, depth + 1, remainingBlanks - Number(!physical));
      if (physical) counts[code] += 1;
    }
  }
  if (rack.length) visit(0, 0, blanks);
  const coveredLengths = Object.keys(byLength).map(Number).filter((length) => byLength[length] > 0);
  return { identity: prepared.identity, rackSize: rack.length, letters: rack.map((tile) => tile.letter ?? '?').join(''),
    blankCount: blanks, wordCount, byLength, longestWord, longestLength: longestWord?.length ?? 0,
    initialLetters: [...starts].sort().join(''), finalLetters: [...ends].sort().join(''),
    distinctInitialLetters: starts.size, distinctFinalLetters: ends.size, coveredLengths,
    lengthCoverage: rack.length >= 2 ? coveredLengths.length / (rack.length - 1) : 0,
    combinations: { distinctPairs: pairs.size, distinctTriples: triples.size, total: pairs.size + triples.size } };
}
