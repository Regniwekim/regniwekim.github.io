import { createStandardTiles } from '../core/bag.js';
import { VOCABULARY } from '../vocabulary/manifest.js';
import { BAG_ID, BAG_SIGNATURE } from './bag.js';
import { METHOD_VERSION, METRIC_WEIGHTS } from './statistics.js';
import { TARGET_LEXICON } from './target-lexicon-v1.js';
import { rackComposition, FLEXIBILITY_KEYS, LEXICAL_FEATURE_VERSION, clamp } from './lexical-features.js';

export { TARGET_LEXICON };
export const FUTURE_STARTS = Object.freeze([7, 17, 28, 39, 50, 60, 71, 82, 93]);
export const LETTER_POLICY = Object.freeze({ openingWeight: 0.35, futureWeight: 0.65, gain: 0.4, minimum: 0.90, maximum: 1.10 });

export function assertTargetLexicon(model, vocabulary = VOCABULARY) {
  if (!model || model.schemaVersion !== 1 || model.methodVersion !== 'rack-regression-v1'
    || model.referenceMethod !== METHOD_VERSION || model.featureVersion !== LEXICAL_FEATURE_VERSION
    || model.identity?.vocabularyId !== vocabulary.id || model.identity?.vocabularySha256 !== vocabulary.sha256
    || model.identity?.wordFingerprint !== TARGET_LEXICON.identity.wordFingerprint
    || model.profileSha256 !== TARGET_LEXICON.profileSha256
    || model.bagId !== BAG_ID || model.bagSignature !== BAG_SIGNATURE
    || model.baselineMean !== TARGET_LEXICON.baselineMean
    || !Array.isArray(model.metrics) || model.metrics.join(',') !== FLEXIBILITY_KEYS.join(',')
    || Object.entries(METRIC_WEIGHTS).some(([key, weight]) => model.metricWeights?.[key] !== weight)
    || !Array.isArray(model.weights) || model.weights.length !== 4
    || model.weights.some((row) => !Array.isArray(row) || row.length !== 107
      || Array.from(row).some((value) => !Number.isFinite(value)))) {
    throw new TypeError('Incompatible target lexical model, vocabulary, baseline or bag.');
  }
}

/** Estimates normalized 3C.1 metrics, NOT word counts, moves or future player racks. */
export function approximateRack(rack, model = TARGET_LEXICON) {
  const x = rackComposition(rack);
  const metrics = Object.fromEntries(FLEXIBILITY_KEYS.map((key, k) => [key,
    clamp(model.weights[k].reduce((sum, weight, index) => sum + weight * x[index], 0), 0, 1)]));
  return { ...metrics, overall: Object.entries(METRIC_WEIGHTS).reduce((sum, [key, weight]) => sum + weight * metrics[key], 0) };
}

export function letterAdjustment(opening, futureMean, baselineMean = TARGET_LEXICON.baselineMean) {
  if (![opening, futureMean, baselineMean].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) {
    throw new TypeError('Flexibility measurements must be finite and within 0–1.');
  }
  const p = LETTER_POLICY;
  const centeredSignal = p.openingWeight * (opening - baselineMean) + p.futureWeight * (futureMean - baselineMean);
  const unboundedMultiplier = 1 + p.gain * centeredSignal;
  return { centeredSignal, unboundedMultiplier, multiplier: clamp(unboundedMultiplier, p.minimum, p.maximum), policy: p };
}

export function estimateLetterFlexibility(orderedTiles, model = TARGET_LEXICON) {
  assertTargetLexicon(model);
  const canonical = createStandardTiles();
  if (!Array.isArray(orderedTiles) || orderedTiles.length !== canonical.length
    || new Set(orderedTiles.map((tile) => tile?.id)).size !== canonical.length
    || Array.from(orderedTiles).some((tile) => !tile || canonical[tile.id]?.letter !== tile.letter)) {
    throw new TypeError('Expected a complete standard physical bag.');
  }
  const opening = approximateRack(orderedTiles.slice(0, 7), model);
  const futureWindows = FUTURE_STARTS.map((start) => ({ start, flexibility: approximateRack(orderedTiles.slice(start, start + 7), model) }));
  const futureMean = futureWindows.reduce((sum, item) => sum + item.flexibility.overall, 0) / futureWindows.length;
  return { methodVersion: model.methodVersion, referenceMethod: model.referenceMethod,
    opening, futureWindows, futureMean, baselineMean: model.baselineMean,
    interpretation: 'Approximate rack-only metrics. Hypothetical untouched-bag windows are not predicted gameplay racks.',
    ...letterAdjustment(opening.overall, futureMean, model.baselineMean) };
}
