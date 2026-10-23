/** Validate the entire static artifact before exposing synchronous membership. */
export function parseVocabulary(text, manifest) {
  if (typeof text !== 'string' || !text.startsWith(`# Wordstead vocabulary ${manifest.id}\n`)
    || !text.endsWith('\n') || text.includes('\r')) {
    throw new TypeError('Vocabulary file has an invalid header or encoding.');
  }
  const lines = text.slice(0, -1).split('\n');
  let first = 0;
  while (lines[first]?.startsWith('#')) first += 1;
  const words = lines.slice(first);
  if (words.length !== manifest.count) throw new TypeError('Vocabulary word count does not match its version.');
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (!/^[A-Z]+$/.test(word) || word.length < manifest.minLength || word.length > manifest.maxLength
      || (index > 0 && words[index - 1] >= word)) {
      throw new TypeError(`Invalid, duplicate or unsorted vocabulary entry at ${index + 1}.`);
    }
  }
  return words;
}
