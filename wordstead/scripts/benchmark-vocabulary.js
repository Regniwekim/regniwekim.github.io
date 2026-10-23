import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { VOCABULARY } from '../src/vocabulary/manifest.js';
import { parseVocabulary } from '../src/vocabulary/format.js';
import { createDictionary } from '../src/core/dictionary.js';

const text = readFileSync(new URL(`../vocabulary/${VOCABULARY.file}`, import.meta.url), 'utf8');
const started = performance.now();
const dictionary = createDictionary(parseVocabulary(text, VOCABULARY));
const initializationMs = performance.now() - started;
const samples = ['garden', 'HARVESTING', 'ox', 'APPLES', 'QZX', 'CAT!', 'WALKED', 'CHILDREN'];
const lookups = 100000;
let hits = 0;
const lookupStarted = performance.now();
for (let index = 0; index < lookups; index += 1) hits += Number(dictionary.has(samples[index % samples.length]));
const lookupMs = performance.now() - lookupStarted;
console.log(JSON.stringify({ id: VOCABULARY.id, words: VOCABULARY.count, bytes: Buffer.byteLength(text),
  initializationMs, lookups, hits, lookupMs, microsecondsPerLookup: lookupMs * 1000 / lookups }, null, 2));
