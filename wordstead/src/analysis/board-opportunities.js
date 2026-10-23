import { analyzeBoardComposition, prepareBoardAnalysis, fraction, FEATURE_KEYS, featureCounts } from './board-composition.js';
import { isFeatureCell, FEATURE_TYPES } from '../core/features.js';
import { compareCoordinates, describeRectangle, rectangleKey, searchSettings, visitRectangles } from './board-rectangles.js';
import { interiorSimilarity, selectGeometricPortfolio } from './board-portfolio.js';
import { summarize } from './statistics.js';

export const BOARD_SCHEMA_VERSION = 1;
export const BOARD_METHOD_VERSION = 'board-rectangles-v1';
export const DEFAULT_POOL_LIMIT = 128;

const byPoints = (a, b) => b.potentialPoints - a.potentialPoints || a.perimeterCellCount - b.perimeterCellCount
  || a.startingDistance - b.startingDistance || compareCoordinates(a, b);
const byEfficiency = (a, b) => b.potentialPoints * a.perimeterCellCount - a.potentialPoints * b.perimeterCellCount || byPoints(a, b);
const byEffort = (a, b) => a.perimeterCellCount - b.perimeterCellCount || byPoints(a, b);
const byBonuses = (a, b) => (b.cropPoints + b.fertilityPoints) - (a.cropPoints + a.fertilityPoints) || byEfficiency(a, b);
const byLivestock = (a, b) => b.livestock - a.livestock || byEfficiency(a, b);
const byBuildings = (a, b) => b.buildings - a.buildings || byEfficiency(a, b);

/** Worst-first bounded heap: retains exact first K under a total deterministic order. */
class RankingPool {
  constructor(limit, compare) { this.limit = limit; this.compare = compare; this.items = []; this.count = 0; }
  offer(candidate) {
    this.count += 1;
    const { items, compare, limit } = this;
    if (items.length === limit) {
      if (compare(candidate, items[0]) >= 0) return;
      items[0] = candidate;
      let parent = 0;
      while (parent * 2 + 1 < items.length) {
        let child = parent * 2 + 1;
        if (child + 1 < items.length && compare(items[child + 1], items[child]) > 0) child += 1;
        if (compare(items[parent], items[child]) >= 0) break;
        [items[parent], items[child]] = [items[child], items[parent]];
        parent = child;
      }
    } else {
      items.push(candidate);
      let child = items.length - 1;
      while (child > 0) {
        const parent = Math.floor((child - 1) / 2);
        if (compare(items[parent], items[child]) >= 0) break;
        [items[parent], items[child]] = [items[child], items[parent]];
        child = parent;
      }
    }
  }
  sorted() { return this.items.slice().sort(this.compare); }
}

function diverse(candidates, limit, similarity) {
  const selected = [];
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (!selected.some((other) => interiorSimilarity(candidate, other) > similarity)) selected.push(candidate);
  }
  return selected;
}

// Histogram summaries avoid storing one value per rectangle. Same type-7 convention as 3C.1.
function histogramSummary(histogram) {
  const entries = [...histogram].sort((a, b) => a[0] - b[0]);
  const count = entries.reduce((sum, [, n]) => sum + n, 0);
  if (!count) return summarize([]);
  const mean = entries.reduce((sum, [value, n]) => sum + value * n, 0) / count;
  function at(index) {
    let offset = 0;
    for (const [value, n] of entries) { offset += n; if (index < offset) return value; }
  }
  const empty = summarize([]);
  const probabilities = [0, 0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99, 1];
  return { count, mean,
    standardDeviation: Math.sqrt(entries.reduce((sum, [value, n]) => sum + n * (value - mean) ** 2, 0) / count),
    quantiles: Object.fromEntries(Object.keys(empty.quantiles).map((key, i) => {
      const position = (count - 1) * probabilities[i], low = Math.floor(position);
      return [key, at(low) + (at(Math.ceil(position)) - at(low)) * (position - low)];
    })) };
}
const increment = (histogram, value) => histogram.set(value, (histogram.get(value) ?? 0) + 1);

/** Compact pure board opportunity report. No gameplay target or vocabulary input. */
export function analyzeBoardOpportunities(board, options = {}) {
  const { territory, outputLimit = 5, poolLimit = DEFAULT_POOL_LIMIT, portfolioSize = 3,
    diversitySimilarity = 0.8, includeCandidates = false } = options;
  for (const [key, value] of Object.entries({ outputLimit, poolLimit, portfolioSize })) {
    if (!Number.isSafeInteger(value) || value < (key === 'poolLimit' ? 1 : 0)) throw new RangeError(`Invalid ${key}.`);
  }
  if (outputLimit > poolLimit) throw new RangeError('outputLimit may not exceed poolLimit.');
  if (!Number.isFinite(diversitySimilarity) || diversitySimilarity < 0 || diversitySimilarity > 1) throw new RangeError('Diversity similarity must be 0–1.');
  const composition = analyzeBoardComposition(board, { territory });
  const context = prepareBoardAnalysis(board, territory);
  const views = {
    highestPoints: new RankingPool(poolLimit, byPoints), highestEfficiency: new RankingPool(poolLimit, byEfficiency),
    farmBonuses: new RankingPool(poolLimit, byBonuses), lowEffort: new RankingPool(poolLimit, byEffort),
    livestock: new RankingPool(poolLimit, byLivestock), buildings: new RankingPool(poolLimit, byBuildings),
  };
  const obstructed = new RankingPool(poolLimit, byPoints);
  const frontierByEffort = new Map();
  const pointHistogram = new Map(), effortHistogram = new Map(), areaHistogram = new Map(), distanceHistogram = new Map();
  const obstructionByType = featureCounts();
  const featureCandidateCounts = featureCounts();
  const coverageStride = board.columns + 1;
  const coverage = new Float64Array((board.rows + 1) * coverageStride);
  const raw = [];
  let validCandidates = 0, scoringCandidates = 0, filteredByMinPoints = 0, obstructedCount = 0, obstructionIncidences = 0;
  let bestPoints = null, bestEfficiency = null;
  const settings = searchSettings(board, options);
  const searchMinimum = settings.minPoints;
  const search = visitRectangles(context, settings, (candidate) => {
    if (candidate.reservedCellObstructions) {
      obstructedCount += 1;
      obstructionIncidences += candidate.reservedCellObstructions;
      if (candidate.potentialPoints > 0) obstructed.offer(candidate);
      // Aggregate per-type incidences over rejected fences, not unique feature cells.
      for (const type of FEATURE_KEYS) {
        const sum = context.blockedFeatures[type];
        obstructionByType[type] += sum(candidate.top, candidate.left, candidate.bottom, candidate.right)
          - sum(candidate.top + 1, candidate.left + 1, candidate.bottom - 1, candidate.right - 1);
      }
      return;
    }
    validCandidates += 1;
    increment(pointHistogram, candidate.potentialPoints);
    increment(effortHistogram, candidate.perimeterCellCount);
    increment(areaHistogram, (candidate.bottom - candidate.top - 1) * (candidate.right - candidate.left - 1));
    increment(distanceHistogram, candidate.startingDistance);
    if (includeCandidates && candidate.potentialPoints >= searchMinimum) raw.push(describeRectangle(context, candidate));
    if (candidate.potentialPoints === 0) return;
    scoringCandidates += 1;
    if (candidate.potentialPoints < searchMinimum) { filteredByMinPoints += 1; return; }
    // Inclusive interior coverage via four difference-grid updates; exact even when pools truncate.
    coverage[(candidate.top + 1) * coverageStride + candidate.left + 1] += 1;
    coverage[candidate.bottom * coverageStride + candidate.left + 1] -= 1;
    coverage[(candidate.top + 1) * coverageStride + candidate.right] -= 1;
    coverage[candidate.bottom * coverageStride + candidate.right] += 1;
    if (bestPoints === null || byPoints(candidate, bestPoints) < 0) bestPoints = candidate;
    if (bestEfficiency === null || byEfficiency(candidate, bestEfficiency) < 0) bestEfficiency = candidate;
    views.highestPoints.offer(candidate); views.highestEfficiency.offer(candidate); views.lowEffort.offer(candidate);
    if (candidate.cropPoints + candidate.fertilityPoints > 0) views.farmBonuses.offer(candidate);
    if (candidate.livestock) views.livestock.offer(candidate);
    if (candidate.buildings) views.buildings.offer(candidate);
    for (const [type, count] of Object.entries({ crop: candidate.crops, fertile: candidate.fertile,
      livestock: candidate.livestock, building: candidate.buildings })) if (count) featureCandidateCounts[type] += 1;
    let frontier = frontierByEffort.get(candidate.perimeterCellCount);
    if (!frontier || candidate.potentialPoints > frontier.points) {
      frontier = { points: candidate.potentialPoints, pool: new RankingPool(poolLimit, byPoints) };
      frontierByEffort.set(candidate.perimeterCellCount, frontier);
    }
    if (candidate.potentialPoints === frontier.points) frontier.pool.offer(candidate);
  });
  const describe = (candidate) => describeRectangle(context, candidate);
  const rankingEntries = Object.entries(views).map(([key, pool]) => [key, diverse(pool.sorted(), outputLimit, diversitySimilarity).map(describe)]);
  const rankings = Object.fromEntries(rankingEntries);
  let highest = -1, paretoCount = 0;
  const paretoPool = [];
  for (const [, frontier] of [...frontierByEffort].sort((a, b) => a[0] - b[0])) {
    if (frontier.points <= highest) continue;
    highest = frontier.points;
    paretoCount += frontier.pool.count;
    paretoPool.push(...frontier.pool.sorted());
  }
  const portfolioPool = [...new Map([...Object.values(views).flatMap((pool) => pool.items), ...paretoPool]
    .map((candidate) => [rectangleKey(candidate), candidate])).values()];
  const portfolio = selectGeometricPortfolio(board, portfolioPool, { territory, maxSelected: portfolioSize });
  const available = composition.eligibleFeatureCounts;
  const upper = composition.theoreticalScoringUpperBound;
  const capturableFeatures = featureCounts();
  for (let row = 0; row < board.rows; row += 1) {
    for (let column = 0; column < board.columns; column += 1) {
      const position = row * coverageStride + column;
      coverage[position] += (row > 0 ? coverage[position - coverageStride] : 0)
        + (column > 0 ? coverage[position - 1] : 0) - (row > 0 && column > 0 ? coverage[position - coverageStride - 1] : 0);
      const index = row * board.columns + column;
      if (coverage[position] > 0 && context.eligible[index] && isFeatureCell(board.cells[index])) capturableFeatures[board.cells[index].type] += 1;
    }
  }
  return { schemaVersion: BOARD_SCHEMA_VERSION, methodVersion: BOARD_METHOD_VERSION,
    interpretation: 'Geometric scoring opportunities, not constructible words, reachable scores or puzzle targets.',
    composition, search: { ...search, validCandidates, scoringCandidates, filteredByMinPoints,
      rankedCandidates: views.highestPoints.count, obstructedCandidates: obstructedCount,
      poolLimit, outputLimit, diversitySimilarity, portfolioSize,
      rawCandidatesIncluded: includeCandidates },
    countsByPerimeterDemand: Object.fromEntries([...effortHistogram].sort((a, b) => a[0] - b[0])),
    countsByInteriorArea: Object.fromEntries([...areaHistogram].sort((a, b) => a[0] - b[0])),
    distributions: { potentialPoints: histogramSummary(pointHistogram), perimeterDemand: histogramSummary(effortHistogram),
      interiorArea: histogramSummary(areaHistogram), distanceFromStartingSquare: histogramSummary(distanceHistogram) },
    rankings, rankingCoverage: Object.fromEntries(Object.entries(views).map(([key, pool]) => [key,
      { eligible: pool.count, retained: pool.items.length, truncated: pool.count > pool.items.length }])),
    pareto: { comparison: 'A dominates B if points(A) >= points(B) and full perimeter(A) <= full perimeter(B), with at least one strict improvement.',
      candidateCount: paretoCount, candidates: diverse(paretoPool.sort(byEfficiency), outputLimit, diversitySimilarity).map(describe) },
    obstructions: { rectangleCount: obstructedCount, fractionOfConsidered: fraction(obstructedCount, search.consideredRectangles),
      reservedCellIncidences: obstructionIncidences, featureIncidencesByType: obstructionByType,
      otherwisePromising: diverse(obstructed.sorted(), outputLimit, diversitySimilarity).map(describe) },
    featureOpportunities: { candidateCounts: featureCandidateCounts, distinctCapturableFeatures: capturableFeatures,
      captureFractions: Object.fromEntries(FEATURE_KEYS.map((type) => [type, fraction(capturableFeatures[type], available[type])])) },
    bestSinglePotentialPoints: bestPoints?.potentialPoints ?? 0,
    bestEfficiency: bestEfficiency ? bestEfficiency.potentialPoints / bestEfficiency.perimeterCellCount : null,
    portfolio: { ...portfolio, poolPolicy: 'Union of bounded top pools for six ranking views and each Pareto effort tier.' },
    normalized: { bestSingleFractionOfUpperBound: fraction(bestPoints?.potentialPoints ?? 0, upper.totalPoints),
      portfolioFractionOfUpperBound: fraction(portfolio.combinedPotentialPoints, upper.totalPoints),
      portfolioBonusFraction: fraction(portfolio.cropPoints + portfolio.fertilityPoints, upper.bonusPoints),
      capturableBonusFraction: fraction(capturableFeatures.crop * FEATURE_TYPES.crop.bonusPoints
        + capturableFeatures.fertile * FEATURE_TYPES.fertile.bonusPoints, upper.bonusPoints),
      portfolioFeatureCaptureFraction: fraction(Object.values(portfolio.featureCoverage).reduce((a, b) => a + b, 0), Object.values(available).reduce((a, b) => a + b, 0)),
      validRectangleFraction: fraction(validCandidates, search.consideredRectangles) },
    ...(includeCandidates ? { candidates: raw } : {}) };
}
