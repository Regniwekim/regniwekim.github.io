/** Fixed seven-tile regression features; no vocabulary, trie or browser dependency. */
export const LEXICAL_FEATURE_VERSION = 'rack-composition-v1';
export const FLEXIBILITY_KEYS = Object.freeze(['short', 'medium', 'long', 'lengthDiversity']);
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function rackComposition(rack) {
  if (!Array.isArray(rack) || rack.length !== 7) throw new TypeError('Expected seven physical tiles.');
  const counts = Array(26).fill(0), ids = new Set();
  let blanks = 0;
  for (const tile of rack) {
    if (!tile || !Number.isSafeInteger(tile.id) || tile.id < 0 || ids.has(tile.id)
      || (tile.letter !== null && (typeof tile.letter !== 'string' || !/^[A-Z]$/.test(tile.letter)))) throw new TypeError('Invalid physical rack.');
    ids.add(tile.id);
    if (tile.letter === null) blanks += 1;
    else counts[tile.letter.charCodeAt(0) - 65] += 1;
  }
  if (blanks > 2) throw new RangeError('At most two blanks are supported.');
  const vowels = [0, 4, 8, 14, 20].reduce((sum, index) => sum + counts[index], 0);
  return [1, ...counts, ...counts.map((n) => Math.max(0, n - 1)), blanks, blanks * blanks,
    ...counts.map((n) => n * blanks), ...counts.map((n) => n * vowels)];
}
