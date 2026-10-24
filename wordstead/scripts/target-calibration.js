import { createBag } from '../src/core/bag.js';
import { createBoard } from '../src/core/board.js';
import { generateFarm } from '../src/core/farm-layout.js';
import { estimateAutomaticTarget, selectConservativeTarget } from '../src/analysis/automatic-target.js';
import { estimateBoardOpportunity } from '../src/analysis/target-board.js';
import { estimateLetterFlexibility, approximateRack, letterAdjustment } from '../src/analysis/target-letters.js';
import { analyzeBoardOpportunities } from '../src/analysis/board-opportunities.js';
import { analyzeRack, parseRack } from '../src/analysis/rack.js';
import { analyzeSeed } from '../src/analysis/seeds.js';
import { measureFlexibility, summarize } from '../src/analysis/statistics.js';
import { loadAnalysisSource, loadBaseline } from './letter-analysis-source.js';

export const MATRIX_SIZES = Object.freeze([[7, 7], [10, 10], [15, 15], [20, 20], [8, 12], [30, 30]]);
export const MATRIX_DENSITIES = Object.freeze([0, 0.08, 0.20]);
const keys = ['short', 'medium', 'long', 'lengthDiversity', 'overall'];
const mean = (values) => values.reduce((sum, n) => sum + n, 0) / values.length;
function errorSummary(pairs) {
  return { count: pairs.length, meanAbsoluteError: mean(pairs.map(([exact, estimate]) => Math.abs(estimate - exact))),
    bias: mean(pairs.map(([exact, estimate]) => estimate - exact)),
    absoluteError: summarize(pairs.map(([exact, estimate]) => Math.abs(estimate - exact))) };
}

export function evaluateLexicon({ count = 2000, prefix = 'wordstead-3c3-lexical-validation-v1', start = 0 } = {}) {
  const { prepared } = loadAnalysisSource(), baseline = loadBaseline(prepared);
  const pairs = Object.fromEntries(keys.map((key) => [key, []]));
  const openingPairs = [], futurePairs = [], multiplierPairs = [], zero = [], blanks = [], repeats = [];
  let changedTargets = 0, maximumTargetDifference = 0;
  const board = estimateAutomaticTarget().board;
  for (let i = start; i < start + count; i += 1) {
    const seed = `${prefix}:${i}`, exact = analyzeSeed(seed, prepared, baseline);
    const bag = createBag(seed).bag, approximation = estimateLetterFlexibility(bag);
    const rackPairs = [[exact.opening.rack, exact.opening.flexibility, approximation.opening],
      ...exact.potentialDraws.samples.map((sample, j) => [sample.rack, sample.flexibility, approximation.futureWindows[j].flexibility])];
    for (const [rack, reference, predicted] of rackPairs) {
      keys.forEach((key) => pairs[key].push([reference[key], predicted[key]]));
      if (rack.wordCount === 0) zero.push([reference.overall, predicted.overall]);
      if (rack.blankCount === 2) blanks.push([reference.overall, predicted.overall]);
      const letters = rack.letters.replaceAll('?', '');
      if (letters.length - new Set(letters).size >= 3) repeats.push([reference.overall, predicted.overall]);
    }
    const referenceFuture = exact.potentialDraws.summary.flexibility.overall.mean;
    const reference = letterAdjustment(exact.opening.flexibility.overall, referenceFuture);
    openingPairs.push([exact.opening.flexibility.overall, approximation.opening.overall]);
    futurePairs.push([referenceFuture, approximation.futureMean]);
    multiplierPairs.push([reference.multiplier, approximation.multiplier]);
    const actual = selectConservativeTarget(board, reference).target;
    const predicted = selectConservativeTarget(board, approximation).target;
    if (actual !== predicted) changedTargets += 1;
    maximumTargetDifference = Math.max(maximumTargetDifference, Math.abs(actual - predicted));
  }
  const examples = ['AEIRSTN', 'BCDFGHT', 'AAEELLS', 'JQXZKUV', 'AEIRST?', 'AEIRS??'].map((letters) => {
    const rack = parseRack(letters), reference = analyzeRack(rack, prepared);
    return { letters, words: reference.wordCount, exact: measureFlexibility(reference, baseline), approximation: approximateRack(rack) };
  });
  return { sampling: { count, prefix, start, windowsPerSeed: 9,
    independentOfTraining: prefix !== 'wordstead-3c3-fit-v1' || start >= 6000 || start + count <= 0 },
    metrics: Object.fromEntries(keys.map((key) => [key, errorSummary(pairs[key])])),
    openingOverall: errorSummary(openingPairs), futureMeanOverall: errorSummary(futurePairs),
    multiplier: errorSummary(multiplierPairs),
    edgeCases: Object.fromEntries(Object.entries({ zeroWords: zero, twoBlanks: blanks, duplicateHeavy: repeats })
      .map(([key, values]) => [key, values.length ? errorSummary(values) : null])),
    defaultBoardTargetComparison: { changedTargets, count, maximumTargetDifference }, examples };
}

function groupSummary(records) {
  const available = records.filter((item) => item.target !== null);
  return { count: records.length, unavailable: records.length - available.length,
    unavailablePercent: 100 * (records.length - available.length) / records.length,
    targets: summarize(available.map((item) => item.target)),
    relativeUpperBound: summarize(available.map((item) => item.target / item.upper)),
    multipliers: summarize(available.map((item) => item.multiplier)) };
}

/** Full farm × letter factorial: change each seed independently, with cached pure measurements. */
export function evaluateTargetMatrix({ count = 32, letterCount = 16, prefix = 'wordstead-3c3-calibration-v1', start = 0 } = {}) {
  const letters = Array.from({ length: letterCount }, (_, i) => estimateLetterFlexibility(createBag(`${prefix}:letters:${start + i}`).bag));
  const records = [];
  for (const [rows, columns] of MATRIX_SIZES) for (const farmDensity of MATRIX_DENSITIES) {
    for (let farmIndex = start; farmIndex < start + count; farmIndex += 1) {
      const farmSeed = `${prefix}:farms:${farmIndex}`;
      const board = estimateBoardOpportunity(generateFarm(createBoard({ rows, columns }), { seed: farmSeed, density: farmDensity }));
      for (let letterIndex = 0; letterIndex < letterCount; letterIndex += 1) {
        const lexical = letters[letterIndex];
        const target = board.primary ? selectConservativeTarget(board, lexical).target : null;
        records.push({ rows, columns, farmDensity, farmSeed, seed: `${prefix}:letters:${start + letterIndex}`,
          target, upper: board.theoreticalUpperBound, opportunity: board.opportunity,
          multiplier: lexical.multiplier, opening: lexical.opening.overall, futureMean: lexical.futureMean,
          eligible: board.search.eligible, obstructionFraction: board.search.obstructed / board.search.consideredRectangles });
      }
    }
  }
  const byConfiguration = MATRIX_SIZES.flatMap(([rows, columns]) => MATRIX_DENSITIES.map((density) => ({ rows, columns, density,
    ...groupSummary(records.filter((r) => r.rows === rows && r.columns === columns && r.farmDensity === density)) })));
  const ranked = records.filter((item) => item.target !== null).slice().sort((a, b) => a.target - b.target);
  const letterRanges = [], farmRanges = [];
  for (const [rows, columns] of MATRIX_SIZES) for (const density of MATRIX_DENSITIES) {
    const group = records.filter((r) => r.rows === rows && r.columns === columns && r.farmDensity === density && r.target !== null);
    for (let i = start; i < start + count; i += 1) {
      const values = group.filter((r) => r.farmSeed === `${prefix}:farms:${i}`).map((r) => r.target);
      if (values.length) letterRanges.push(Math.max(...values) - Math.min(...values));
    }
    for (let i = start; i < start + letterCount; i += 1) {
      const values = group.filter((r) => r.seed === `${prefix}:letters:${i}`).map((r) => r.target);
      if (values.length) farmRanges.push(Math.max(...values) - Math.min(...values));
    }
  }
  return { sampling: { count, letterCount, prefix, start, sizes: MATRIX_SIZES, densities: MATRIX_DENSITIES,
    design: 'Full independent farm-seed × letter-seed factorial at each size/density.' },
    ...groupSummary(records), byConfiguration, letterSeedTargetRanges: summarize(letterRanges),
    farmSeedTargetRanges: summarize(farmRanges),
    coefficientComparison: [0.4, 0.55, 0.7].map((discount) => ({ discount,
      targets: summarize(records.filter((r) => r.target !== null).map((r) => Math.min(r.upper, Math.max(1, Math.floor(r.opportunity * discount * r.multiplier))))) })),
    outliers: { lowest: ranked.slice(0, 5), highest: ranked.slice(-5).reverse() } };
}

/** Reproduce the earlier failure modes and compare plausible effort/search alternatives. */
export function investigateInputs({ count = 16, prefix = 'wordstead-3c3-investigation-v1', start = 0 } = {}) {
  const observations = [];
  for (const [rows, columns] of [[7, 7], [15, 15], [30, 30]]) for (const density of [0.04, 0.20]) {
    const records = [];
    for (let index = start; index < start + count; index += 1) {
      const board = generateFarm(createBoard({ rows, columns }), { seed: `${prefix}:${index}`, density });
      const unrestricted = analyzeBoardOpportunities(board, { portfolioSize: 0 });
      const p128 = analyzeBoardOpportunities(board, { maxPerimeter: 28 });
      const p1024 = analyzeBoardOpportunities(board, { maxPerimeter: 28, poolLimit: 1024 });
      const compact = estimateBoardOpportunity(board);
      const alternatives = [5, 7, 9].map((span) => analyzeBoardOpportunities(board, {
        maxPerimeter: 28, maxWidth: span, maxHeight: span, portfolioSize: 0 }));
      records.push({ upper: compact.theoreticalUpperBound,
        unrestrictedBest: unrestricted.rankings.highestPoints[0]?.potentialPoints ?? 0,
        best28: p128.rankings.highestPoints[0]?.potentialPoints ?? 0,
        portfolio128: p128.portfolio.combinedPotentialPoints, portfolio1024: p1024.portfolio.combinedPotentialPoints,
        portfolioDifference: p1024.portfolio.combinedPotentialPoints - p128.portfolio.combinedPotentialPoints,
        span5: alternatives[0].rankings.highestPoints[0]?.potentialPoints ?? 0,
        span7: alternatives[1].rankings.highestPoints[0]?.potentialPoints ?? 0,
        span9: alternatives[2].rankings.highestPoints[0]?.potentialPoints ?? 0,
        opportunity: compact.opportunity, primaryDistance: compact.primary?.startingDistance ?? 0,
        obstructionFraction: compact.search.obstructed / compact.search.consideredRectangles });
    }
    observations.push({ rows, columns, density, metrics: Object.fromEntries(Object.keys(records[0]).map((key) => [key, summarize(records.map((r) => r[key]))])) });
  }
  const outlierBoard = generateFarm(createBoard(), { seed: 'wordstead-3c2-batch:17', density: 0.04 });
  const knownPoolOutlier = [128, 1024].map((poolLimit) => {
    const report = analyzeBoardOpportunities(outlierBoard, { maxPerimeter: 28, poolLimit });
    return { poolLimit, points: report.portfolio.combinedPotentialPoints };
  });
  return { sampling: { count, prefix, start }, observations, knownPoolOutlier };
}
