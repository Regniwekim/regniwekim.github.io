// Reviewed export configuration for this exact upstream revision. Development only.
export const SOURCE = Object.freeze({
  url: 'https://github.com/en-wl/wordlist',
  commit: '1e5b7d3a72f47a71da5d28686c1dd4b397178485',
  id: 'esdb-en-us-60-1e5b7d3-ws1',
  name: 'ESDB American English 60 · 1e5b7d3 / ws1',
  minLength: 2,
  maxLength: 30,
});

// --no-word-filter preserves spelling exactly (no dot stripping or deaccenting).
// Character/case/length filtering happens in our reviewed transform below.
export const EXPORT_ARGS = Object.freeze([
  'word-list', '60', 'A', '1', '--categories=', '--wo-poses=abbr',
  '--wo-pos-classes=person,surname,place,name,name?,upper,upper?,demonym,trademark,abbr,abbr?',
  '--wo-pos-categories=nonword,special,wordpart', '--no-word-filter',
]);

/** Strict one-entry-per-line upstream output, with mutually exclusive filter counts. */
export function transformExport(text) {
  if (typeof text !== 'string' || !text.endsWith('\n')) {
    throw new TypeError('ESDB export must be newline-terminated text.');
  }
  const lines = text.replaceAll('\r\n', '\n').slice(0, -1).split('\n');
  const counts = { sourceEntries: lines.length, unsupported: 0, capitalized: 0,
    tooShort: 0, tooLong: 0, duplicates: 0, accepted: 0 };
  const words = new Set();
  for (const [index, word] of lines.entries()) {
    // ESDB's documented spelling alphabet is Latin-1 letters plus these symbols.
    // Unsupported spellings are expected; control characters/blank records are not.
    if (!word || word.trim() !== word || !/^[A-Za-z\u00c0-\u00ff0-9.&/' -]+$/.test(word)) {
      throw new TypeError(`Malformed ESDB record at line ${index + 1}.`);
    }
    if (!/^[A-Za-z]+$/.test(word)) counts.unsupported += 1;
    else if (/[A-Z]/.test(word)) counts.capitalized += 1;
    else if (word.length < SOURCE.minLength) counts.tooShort += 1;
    else if (word.length > SOURCE.maxLength) counts.tooLong += 1;
    else {
      const normalized = word.toUpperCase();
      if (words.has(normalized)) counts.duplicates += 1;
      words.add(normalized);
    }
  }
  if (!words.size) throw new TypeError('ESDB export contains no playable words.');
  counts.accepted = words.size;
  return { words: [...words].sort(), counts };
}
