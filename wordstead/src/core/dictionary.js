/** Normalize ASCII input only; Unicode case expansion must not create tiles. */
export function normalizeWord(text) {
  if (typeof text !== 'string' || !/^[A-Za-z]+$/.test(text.trim())) return null;
  return text.trim().toUpperCase();
}

/** Replaceable synchronous membership boundary; the word list stays private. */
export function createDictionary(words) {
  const vocabulary = new Set();
  for (const word of words) {
    const normalized = normalizeWord(word);
    if (!normalized) throw new TypeError('Dictionary entries must contain only A–Z letters.');
    vocabulary.add(normalized);
  }
  return Object.freeze({ has: (word) => vocabulary.has(normalizeWord(word)) });
}
