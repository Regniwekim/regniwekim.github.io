import { createBag, createStandardTiles, seedToState, RACK_CAPACITY } from '../core/bag.js';
import { CAPACITIES } from './bag.js';
import { analyzeRack } from './rack.js';
import { SCHEMA_VERSION, METHOD_VERSION, assertBaselineCompatible, fitBaseline, measureFlexibility,
  compareWithBaseline, summarize, summarizeRacks } from './statistics.js';

export const DEFAULT_BASELINE_SEED = 'wordstead-3c1-baseline-v1';
export const DEFAULT_SAMPLE_COUNT = 1000;
export const DEFAULT_WINDOW_COUNT = 9;

function countArgument(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a nonnegative safe integer.`);
}

export function sampleBaseline(prepared, { seed = DEFAULT_BASELINE_SEED, sampleCount = DEFAULT_SAMPLE_COUNT } = {}) {
  countArgument(sampleCount, 'Sample count');
  seedToState(seed);
  const samples = Object.fromEntries(CAPACITIES.map((capacity) => [capacity, []]));
  for (let index = 0; index < sampleCount; index += 1) {
    const { bag } = createBag(JSON.stringify([seed, index]));
    for (const capacity of CAPACITIES) samples[capacity].push(analyzeRack(bag.slice(0, capacity), prepared));
  }
  return fitBaseline(samples, prepared.identity, { seed, sampleCount });
}

/** Zero-based starts in the untouched bag, excluding the seven opening tiles. */
export function potentialPositions(bagLength, { sampleCount = DEFAULT_WINDOW_COUNT, positions } = {}) {
  const first = RACK_CAPACITY;
  const last = bagLength - RACK_CAPACITY;
  const available = Math.max(0, last - first + 1);
  if (positions !== undefined) {
    if (!Array.isArray(positions) || new Set(positions).size !== positions.length
      || Array.from(positions).some((position) => !Number.isSafeInteger(position) || position < first || position > last)) {
      throw new RangeError('Window starts must be distinct integers wholly within the remaining physical bag.');
    }
    return positions.slice().sort((a, b) => a - b);
  }
  countArgument(sampleCount, 'Window count');
  if (sampleCount > available) throw new RangeError(`Only ${available} distinct seven-tile window starts are available.`);
  return Array.from({ length: sampleCount }, (_, i) => sampleCount === 1 ? first
    : first + Math.floor(i * (last - first) / (sampleCount - 1)));
}

export function analyzePotentialDraws(bag, prepared, baseline, options = {}) {
  assertBaselineCompatible(baseline, prepared.identity);
  // A frozen createBag result or a session's untouched ordered tiles may be inspected.
  if (!Array.isArray(bag) || bag.length !== 100 || new Set(bag.map((tile) => tile?.id)).size !== bag.length) {
    throw new TypeError('Potential draws require a complete, distinct physical standard bag.');
  }
  const canonical = createStandardTiles();
  const identities = new Map(canonical.map((tile) => [tile.id, tile.letter]));
  if (Array.from(bag).some((tile) => !tile || !identities.has(tile.id) || identities.get(tile.id) !== tile.letter)) {
    throw new TypeError('Potential draws require the standard physical tile identities and letters.');
  }
  const positions = potentialPositions(bag.length, options);
  const samples = positions.map((start) => {
    const rack = analyzeRack(bag.slice(start, start + RACK_CAPACITY), prepared);
    const fraction = (start - RACK_CAPACITY) / (bag.length - 2 * RACK_CAPACITY);
    return { start, endExclusive: start + RACK_CAPACITY, phase: fraction < 1 / 3 ? 'early' : fraction < 2 / 3 ? 'mid' : 'late',
      tileIds: bag.slice(start, start + RACK_CAPACITY).map((tile) => tile.id), rack,
      flexibility: measureFlexibility(rack, baseline) };
  });
  return { interpretation: 'Hypothetical bag windows, not predicted player racks. Overlapping windows are correlated.',
    capacity: RACK_CAPACITY, positions, samples,
    summary: summarizeRacks(samples.map((sample) => sample.rack), baseline, RACK_CAPACITY),
    phases: Object.fromEntries(['early', 'mid', 'late'].map((phase) => [phase,
      summarizeRacks(samples.filter((sample) => sample.phase === phase).map((sample) => sample.rack), baseline, RACK_CAPACITY)])) };
}

export function analyzeSeed(seed, prepared, baseline, options = {}) {
  assertBaselineCompatible(baseline, prepared.identity);
  const { bag } = createBag(seed);
  const rack = analyzeRack(bag.slice(0, RACK_CAPACITY), prepared);
  const flexibility = measureFlexibility(rack, baseline);
  return { schemaVersion: SCHEMA_VERSION, methodVersion: METHOD_VERSION, seed,
    opening: { rack, tileIds: bag.slice(0, RACK_CAPACITY).map((tile) => tile.id), flexibility,
      baselineComparison: compareWithBaseline(flexibility, baseline, RACK_CAPACITY) },
    potentialDraws: analyzePotentialDraws(bag, prepared, baseline, options) };
}

export function analyzeBatch(prepared, baseline, { count = DEFAULT_SAMPLE_COUNT, prefix = 'wordstead-3c1-batch',
  start = 0, numeric = false, ...windowOptions } = {}) {
  assertBaselineCompatible(baseline, prepared.identity);
  countArgument(count, 'Batch count');
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(start + count)) throw new RangeError('Batch sequence must stay within safe integers.');
  if (typeof prefix !== 'string' || !prefix.trim()) throw new TypeError('Batch prefix must be nonempty.');
  // Validate windows even for an empty batch.
  const positions = potentialPositions(100, windowOptions);
  const openings = [];
  const draws = [];
  const perSeedMeans = [];
  const phases = { early: [], mid: [], late: [] };
  const extremes = [];
  const drawExtremes = [];
  for (let index = 0; index < count; index += 1) {
    const seed = numeric ? start + index : `${prefix}:${start + index}`;
    const report = analyzeSeed(seed, prepared, baseline, { positions });
    openings.push(report.opening.rack);
    const overall = report.opening.flexibility?.overall ?? null;
    extremes.push({ seed, letters: report.opening.rack.letters, wordCount: report.opening.rack.wordCount, overall });
    for (const sample of report.potentialDraws.samples) {
      draws.push(sample.rack);
      phases[sample.phase].push(sample.rack);
      drawExtremes.push({ seed, start: sample.start, letters: sample.rack.letters,
        wordCount: sample.rack.wordCount, overall: sample.flexibility?.overall ?? null });
    }
    const mean = report.potentialDraws.summary.flexibility.overall.mean;
    if (mean !== null) perSeedMeans.push(mean);
  }
  const ranked = extremes.filter((sample) => sample.overall !== null).sort((a, b) => a.overall - b.overall
    || (String(a.seed) < String(b.seed) ? -1 : String(a.seed) > String(b.seed) ? 1 : 0));
  const drawRanked = drawExtremes.filter((sample) => sample.overall !== null).sort((a, b) => a.overall - b.overall
    || (String(a.seed) < String(b.seed) ? -1 : String(a.seed) > String(b.seed) ? 1 : a.start - b.start));
  return { schemaVersion: SCHEMA_VERSION, methodVersion: METHOD_VERSION, identity: prepared.identity,
    sampling: { count, prefix: numeric ? null : prefix, numeric, start, positions },
    opening: summarizeRacks(openings, baseline, RACK_CAPACITY),
    potentialDraws: { pooled: summarizeRacks(draws, baseline, RACK_CAPACITY),
      phases: Object.fromEntries(Object.entries(phases).map(([phase, racks]) => [phase, summarizeRacks(racks, baseline, RACK_CAPACITY)])),
      perSeedMeanOverall: summarize(perSeedMeans),
      outliers: { lowest: drawRanked.slice(0, 5), highest: drawRanked.slice(-5).reverse() } },
    openingOutliers: { lowest: ranked.slice(0, 5), highest: ranked.slice(-5).reverse() } };
}
