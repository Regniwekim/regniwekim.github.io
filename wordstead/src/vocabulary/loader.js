import { createDictionary } from '../core/dictionary.js';
import { parseVocabulary } from './format.js';
import { VOCABULARY } from './manifest.js';

/** Cache successful preparation and concurrent calls; failed attempts may be retried. */
export function createVocabularyLoader({ fetchResource = (...args) => fetch(...args),
  now = () => performance.now(), manifest = VOCABULARY } = {}) {
  let pending = null;
  return function load() {
    if (pending) return pending;
    pending = Promise.resolve().then(async () => {
      const started = now();
      const url = new URL(`../../vocabulary/${manifest.file}`, import.meta.url);
      const response = await fetchResource(url, { integrity: manifest.integrity });
      if (!response.ok) throw new Error(`Vocabulary request failed (HTTP ${response.status}).`);
      const text = await response.text();
      const preparing = now();
      const dictionary = createDictionary(parseVocabulary(text, manifest));
      const prepared = now();
      return Object.freeze({ dictionary, vocabulary: manifest,
        initializationMs: prepared - preparing, loadMs: prepared - started });
    }).catch((error) => { pending = null; throw error; });
    return pending;
  };
}

export const loadGameplayVocabulary = createVocabularyLoader();
