import { BAG_ID, BAG_SIGNATURE, CAPACITIES } from './bag.js';

export const SCHEMA_VERSION = 1;
export const METHOD_VERSION = 'rack-lexical-v1';
export const METRIC_WEIGHTS = Object.freeze({ short: 0.25, medium: 0.30, long: 0.30, lengthDiversity: 0.15 });
export const QUANTILES = Object.freeze({ p0: 0, p01: 0.01, p05: 0.05, p25: 0.25, p50: 0.5,
  p75: 0.75, p95: 0.95, p99: 0.99, p100: 1 });
export const round = (value) => Number(value.toFixed(12));

function numericSample(values) {
  if (!Array.isArray(values) || Array.from(values).some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError('Samples must be a dense array of finite numbers.');
  }
  return values.slice().sort((a, b) => a - b);
}

function interpolate(sorted, probability) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * probability;
  const low = Math.floor(position);
  return round(sorted[low] + (sorted[Math.ceil(position)] - sorted[low]) * (position - low));
}

/** Linear interpolation at (n - 1) p (Hyndman–Fan type 7). Empty samples are unknown. */
export function quantile(values, probability) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new RangeError('Quantile probability must be 0–1.');
  return interpolate(numericSample(values), probability);
}

export function summarize(values) {
  const sorted = numericSample(values);
  const mean = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null;
  return { count: sorted.length, mean: mean === null ? null : round(mean),
    standardDeviation: mean === null ? null : round(Math.sqrt(sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length)),
    quantiles: Object.fromEntries(Object.entries(QUANTILES).map(([key, p]) => [key, interpolate(sorted, p)])) };
}

export function assertBaselineCompatible(baseline, identity) {
  if (!baseline || baseline.schemaVersion !== SCHEMA_VERSION || baseline.methodVersion !== METHOD_VERSION
    || baseline.bagId !== BAG_ID || baseline.bagSignature !== BAG_SIGNATURE
    || Object.keys(identity).some((key) => baseline.identity?.[key] !== identity[key])) {
    throw new TypeError('Baseline schema, method, vocabulary or bag is incompatible.');
  }
}

/** Equal weight per eligible length, then provisional group weights; never a difficulty score. */
export function measureFlexibility(rack, baseline) {
  assertBaselineCompatible(baseline, rack.identity);
  const reference = baseline.capacities[rack.rackSize]?.normalization;
  if (!reference || !reference.sampleCount) return null;
  const signals = {};
  for (let length = 2; length <= rack.rackSize; length += 1) {
    const signal = round(Math.log1p(rack.byLength[length]));
    const scale = reference.meanLogCountByLength[length];
    if (!Number.isFinite(scale) || scale < 0) throw new TypeError('Invalid baseline normalization.');
    signals[length] = signal === 0 ? 0 : round(signal / (signal + scale));
  }
  const group = (low, high) => {
    const lengths = Object.keys(signals).map(Number).filter((length) => length >= low && length <= high);
    return lengths.length ? round(lengths.reduce((sum, length) => sum + signals[length], 0) / lengths.length) : 0;
  };
  const metrics = { short: group(2, 3), medium: group(4, 5), long: group(6, rack.rackSize),
    lengthDiversity: rack.lengthCoverage };
  return { ...metrics, overall: round(Object.entries(METRIC_WEIGHTS)
    .reduce((sum, [key, weight]) => sum + metrics[key] * weight, 0)) };
}

export function compareWithBaseline(metrics, baseline, capacity) {
  if (metrics === null) return null;
  const distribution = baseline.capacities[capacity]?.flexibility.overall;
  if (!distribution?.count) return null;
  return { overallBaselineMean: distribution.mean,
    overallDifferenceFromMean: round(metrics.overall - distribution.mean),
    belowP05: metrics.overall < distribution.quantiles.p05,
    aboveP95: metrics.overall > distribution.quantiles.p95 };
}

export function summarizeRacks(racks, baseline, capacity) {
  const metrics = racks.map((rack) => measureFlexibility(rack, baseline)).filter((value) => value !== null);
  return { sampleCount: racks.length, wordCount: summarize(racks.map((rack) => rack.wordCount)),
    byLength: Object.fromEntries(Array.from({ length: capacity - 1 }, (_, i) => [i + 2,
      summarize(racks.map((rack) => rack.byLength[i + 2]))])),
    flexibility: Object.fromEntries(['short', 'medium', 'long', 'lengthDiversity', 'overall'].map((key) => [key,
      summarize(metrics.map((value) => value[key]))])) };
}

export function fitBaseline(samples, identity, { seed, sampleCount }) {
  const baseline = { schemaVersion: SCHEMA_VERSION, methodVersion: METHOD_VERSION, identity,
    bagId: BAG_ID, bagSignature: BAG_SIGNATURE,
    sampling: { seed, sampleCount, seedTemplate: 'JSON.stringify([seed, sampleIndex])',
      capacitiesShareBag: true, distribution: 'independently shuffled standard bags; prefix of each bag' },
    metrics: { weights: METRIC_WEIGHTS, range: [0, 1],
      perLength: 'log1p(count) / (log1p(count) + meanBaselineLog1pCount)',
      zeroSignal: 0, positiveSignalWithZeroReference: 1, precisionDecimals: 12 }, capacities: {} };
  for (const capacity of CAPACITIES) {
    baseline.capacities[capacity] = { normalization: { sampleCount: samples[capacity].length,
      meanLogCountByLength: Object.fromEntries(Array.from({ length: capacity - 1 }, (_, i) => [i + 2,
        summarize(samples[capacity].map((rack) => round(Math.log1p(rack.byLength[i + 2])))).mean])) } };
  }
  for (const capacity of CAPACITIES) {
    Object.assign(baseline.capacities[capacity], summarizeRacks(samples[capacity], baseline, capacity));
  }
  return baseline;
}

/** Producers establish deterministic field ordering; reject invalid JSON numbers. */
export function stableJson(value) {
  return `${JSON.stringify(value, (key, item) => {
    if (typeof item !== 'number') return item;
    if (!Number.isFinite(item)) throw new TypeError('Analysis JSON cannot contain nonfinite numbers.');
    if (key === 'seed') return item; // Numeric seed identity must survive JSON round trips exactly.
    return round(item);
  }, 2)}\n`;
}
