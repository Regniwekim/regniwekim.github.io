import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { VOCABULARY } from '../src/vocabulary/manifest.js';
import { parseVocabulary } from '../src/vocabulary/format.js';
import { analyzeVocabulary } from '../src/analysis/vocabulary.js';
import { analyzeBag } from '../src/analysis/bag.js';
import { prepareRackVocabulary } from '../src/analysis/rack.js';
import { sampleBaseline } from '../src/analysis/seeds.js';
import { SCHEMA_VERSION, METHOD_VERSION, assertBaselineCompatible } from '../src/analysis/statistics.js';

export const PROFILE_URL = new URL('../data/letter-analysis/profile-v1.json', import.meta.url);
export const NOTICE_URL = new URL('../data/letter-analysis/NOTICE.txt', import.meta.url);

/** Verify original bytes before using the game's existing parser. No downloads/exports. */
export function verifyVocabulary(bytes, manifest = VOCABULARY) {
  const hash = createHash('sha256').update(bytes);
  const sha256 = hash.digest('hex');
  if (bytes.length !== manifest.bytes || sha256 !== manifest.sha256
    || `sha256-${Buffer.from(sha256, 'hex').toString('base64')}` !== manifest.integrity) {
    throw new TypeError('Vocabulary bytes, checksum or integrity do not match the manifest.');
  }
  return parseVocabulary(bytes.toString('utf8'), manifest);
}

export function loadAnalysisSource() {
  const words = verifyVocabulary(readFileSync(new URL(`../vocabulary/${VOCABULARY.file}`, import.meta.url)));
  return { words, prepared: prepareRackVocabulary(words, VOCABULARY) };
}

export function buildAnalysisArtifact(source, options = {}) {
  const vocabulary = analyzeVocabulary(source.words);
  const notice = readFileSync(new URL('../licenses/esdb/Copyright', import.meta.url), 'utf8')
    .replaceAll('\r\n', '\n').split('\n===\n')[0].trimEnd() + '\n';
  return { profile: { schemaVersion: SCHEMA_VERSION, methodVersion: METHOD_VERSION,
    source: { id: VOCABULARY.id, sha256: VOCABULARY.sha256, bytes: VOCABULARY.bytes,
      url: VOCABULARY.url, commit: VOCABULARY.commit, attribution: 'Copyright 2000-2026 by Kevin Atkinson',
      notice: './NOTICE.txt', fullNotice: '../../licenses/esdb/Copyright' },
    vocabulary, bag: analyzeBag(vocabulary), baseline: sampleBaseline(source.prepared, options) }, notice };
}

export function loadBaseline(prepared) {
  const profile = JSON.parse(readFileSync(PROFILE_URL, 'utf8'));
  if (profile.schemaVersion !== SCHEMA_VERSION || profile.methodVersion !== METHOD_VERSION
    || profile.source.id !== prepared.identity.vocabularyId || profile.source.sha256 !== prepared.identity.vocabularySha256
    || profile.vocabulary.wordFingerprint !== prepared.identity.wordFingerprint) {
    throw new TypeError('Statistical profile is incompatible; regenerate with analyze-letters.js generate.');
  }
  assertBaselineCompatible(profile.baseline, prepared.identity);
  return profile.baseline;
}
