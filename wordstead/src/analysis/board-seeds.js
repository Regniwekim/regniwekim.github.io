import { createBoard } from '../core/board.js';
import { generateFarm, DEFAULT_FARM_SEED, DEFAULT_FARM_DENSITY, DEFAULT_FARM_WEIGHTS } from '../core/farm-layout.js';
import { isFeatureCell } from '../core/features.js';
import { FEATURE_KEYS } from './board-composition.js';
import { analyzeBoardOpportunities, BOARD_SCHEMA_VERSION, BOARD_METHOD_VERSION } from './board-opportunities.js';
import { summarize } from './statistics.js';

export const DEFAULT_BOARD_BATCH_PREFIX = 'wordstead-3c2-batch';

/** Fresh farm generation only. Never constructs or touches a letter bag/session. */
export function analyzeFarmBoard({ rows = 15, columns = 15, seed = DEFAULT_FARM_SEED,
  density = DEFAULT_FARM_DENSITY, weights = DEFAULT_FARM_WEIGHTS } = {}, options = {}) {
  const board = generateFarm(createBoard({ rows, columns }), { seed, density, weights });
  return { ...analyzeBoardOpportunities(board, options),
    generation: { rows, columns, seed, density, weights: Object.fromEntries(FEATURE_KEYS.map((type) => [type, weights[type]])) },
    layout: board.cells.flatMap((cell, index) => isFeatureCell(cell)
      ? [{ row: Math.floor(index / columns), column: index % columns, type: cell.type }] : []) };
}

export function boardMetrics(report) {
  return { theoreticalUpperBound: report.composition.theoreticalScoringUpperBound.totalPoints,
    candidateCount: report.search.validCandidates, scoringCandidateCount: report.search.scoringCandidates,
    bestCandidatePoints: report.bestSinglePotentialPoints, bestEfficiency: report.bestEfficiency,
    portfolioPoints: report.portfolio.combinedPotentialPoints,
    portfolioFenceDemand: report.portfolio.distinctFenceDemand,
    featureConcentration: report.composition.distribution.quadrantConcentration,
    obstructionFraction: report.obstructions.fractionOfConsidered,
    obstructionIncidences: report.obstructions.reservedCellIncidences,
    bestSingleFraction: report.normalized.bestSingleFractionOfUpperBound,
    portfolioFraction: report.normalized.portfolioFractionOfUpperBound };
}

/** Descriptive aggregate, default 1,000 reproducible farms; no per-seed report retention. */
export function analyzeBoardBatch(configuration = {}, { count = 1000, prefix = DEFAULT_BOARD_BATCH_PREFIX,
  start = 0, numeric = false, ...options } = {}) {
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(start)
    || !Number.isSafeInteger(start + Math.max(0, count - 1))) throw new RangeError('Invalid safe integer batch sequence.');
  if (typeof numeric !== 'boolean' || typeof prefix !== 'string' || !prefix.trim()) throw new TypeError('Invalid batch seed policy.');
  if (Object.hasOwn(configuration, 'seed')) throw new TypeError('Batch seeds come from prefix/start or the numeric sequence.');
  if (options.includeCandidates) throw new TypeError('Raw candidates are single-board diagnostics only.');
  // Validate configuration and limits for count zero as well. No sample is silently invented.
  const template = analyzeFarmBoard({ ...configuration, seed: numeric ? start : `${prefix}:${start}` }, options);
  const samples = Object.fromEntries(Object.keys(boardMetrics(template)).map((key) => [key, []]));
  const extremes = [];
  let noCandidates = 0, noScoringCandidates = 0;
  for (let index = 0; index < count; index += 1) {
    const seed = numeric ? start + index : `${prefix}:${start + index}`;
    const report = index === 0 ? template : analyzeFarmBoard({ ...configuration, seed }, options);
    const metrics = boardMetrics(report);
    for (const [key, value] of Object.entries(metrics)) if (value !== null) samples[key].push(value);
    extremes.push({ seed, ...metrics });
    if (report.search.validCandidates === 0) noCandidates += 1;
    if (report.search.scoringCandidates === 0) noScoringCandidates += 1;
  }
  const outliers = {};
  for (const key of ['bestCandidatePoints', 'bestEfficiency', 'portfolioPoints', 'obstructionFraction']) {
    const ordered = extremes.filter((item) => item[key] !== null).slice().sort((a, b) => a[key] - b[key]
      || (String(a.seed) < String(b.seed) ? -1 : String(a.seed) > String(b.seed) ? 1 : 0));
    outliers[key] = { lowest: ordered.slice(0, 5), highest: ordered.slice(-5).reverse() };
  }
  return { schemaVersion: BOARD_SCHEMA_VERSION, methodVersion: BOARD_METHOD_VERSION,
    interpretation: 'Descriptive distributions of geometric opportunities; no score targets or difficulty ratings.',
    configuration: { rows: template.generation.rows, columns: template.generation.columns,
      density: template.generation.density, weights: template.generation.weights },
    sampling: { count, start, numeric, prefix: numeric ? null : prefix,
      sequence: numeric ? 'start + index' : 'prefix + ":" + (start + index)', indexRange: [0, count] },
    searchPolicy: { maxWidth: template.search.maxWidth, maxHeight: template.search.maxHeight,
      maxPerimeter: template.search.maxPerimeter, minPoints: template.search.minPoints,
      consideredRectanglesPerBoard: template.search.consideredRectangles,
      skippedBySearchLimitsPerBoard: template.search.skippedBySearchLimits,
      exhaustiveGeometry: template.search.exhaustiveGeometry, poolLimit: template.search.poolLimit,
      outputLimit: template.search.outputLimit, portfolioSize: template.search.portfolioSize,
      diversitySimilarity: template.search.diversitySimilarity },
    noCandidates, noScoringCandidates,
    distributions: Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, summarize(values)])), outliers };
}
