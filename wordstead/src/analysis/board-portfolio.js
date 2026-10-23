import { isLetterCell } from '../core/letters.js';
import { summarizeFeatures } from '../core/features.js';
import { isCollectible } from './board-composition.js';
import { compareCoordinates, rectanglePerimeter, rectangleKey } from './board-rectangles.js';

function intersectionArea(a, b) {
  return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + 1)
    * Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left) + 1);
}
const interior = (r) => ({ top: r.top + 1, left: r.left + 1, bottom: r.bottom - 1, right: r.right - 1 });

export function rectangleInteriorOverlap(a, b) { return intersectionArea(interior(a), interior(b)); }

/** Interiors may not intersect any part of the other rectangle. Boundaries may share letters. */
export function compatibleRectangles(a, b) {
  return intersectionArea(interior(a), b) === 0 && intersectionArea(interior(b), a) === 0;
}

export function interiorSimilarity(a, b) {
  const area = (r) => (r.bottom - r.top - 1) * (r.right - r.left - 1);
  const overlap = rectangleInteriorOverlap(a, b);
  return overlap / (area(a) + area(b) - overlap);
}

/** Bounded greedy marginal points / distinct incremental full fence positions. */
export function selectGeometricPortfolio(board, candidates, { territory, maxSelected = 3 } = {}) {
  if (!Number.isSafeInteger(maxSelected) || maxSelected < 0) throw new RangeError('Portfolio size must be nonnegative.');
  const pool = [...new Map(candidates.filter((candidate) => candidate.reservedCellObstructions === 0
    && candidate.potentialPoints > 0).map((candidate) => [rectangleKey(candidate), candidate])).values()];
  const selected = [], covered = new Set(), fence = new Set();
  let rawSummedPerimeterDemand = 0;
  while (selected.length < maxSelected) {
    let best = null;
    for (const candidate of pool) {
      if (selected.some((item) => !compatibleRectangles(item.candidate, candidate))) continue;
      const perimeter = rectanglePerimeter(board, candidate);
      const incrementalFence = perimeter.filter((index) => !fence.has(index)).length;
      // Compatibility ensures disjoint interiors; still measure marginal eligible cells explicitly.
      const indices = [];
      for (let row = candidate.top + 1; row < candidate.bottom; row += 1) {
        for (let column = candidate.left + 1; column < candidate.right; column += 1) {
          const index = row * board.columns + column;
          if (!covered.has(index) && isCollectible(board, index, territory)) indices.push(index);
        }
      }
      const features = summarizeFeatures(board, indices);
      const marginalPoints = indices.length + features.bonusPoints;
      if (marginalPoints === 0 || incrementalFence === 0) continue;
      const entry = { candidate, perimeter, indices, incrementalFence, marginalPoints };
      const comparison = best === null ? -1 : best.marginalPoints * incrementalFence - marginalPoints * best.incrementalFence
        || best.marginalPoints - marginalPoints || incrementalFence - best.incrementalFence
        || compareCoordinates(candidate, best.candidate);
      if (comparison < 0) best = entry;
    }
    if (best === null) break;
    best.indices.forEach((index) => covered.add(index));
    best.perimeter.forEach((index) => fence.add(index));
    rawSummedPerimeterDemand += best.candidate.perimeterCellCount;
    selected.push(best);
  }
  const features = summarizeFeatures(board, [...covered].sort((a, b) => a - b));
  return { interpretation: 'Greedy geometric portfolio estimate; not a legal word-placement sequence or globally optimal set.',
    selectionMethod: 'Greedy marginal points / incremental distinct full fence positions; then points, demand, coordinates.',
    compatibility: 'Disjoint interiors; neither interior may intersect the other rectangle, including its fence. Shared boundaries allowed.',
    maxSelected, poolSize: pool.length,
    selected: selected.map(({ candidate, marginalPoints, incrementalFence }) => ({
      id: rectangleKey(candidate), top: candidate.top, left: candidate.left, bottom: candidate.bottom, right: candidate.right,
      individualPotentialPoints: candidate.potentialPoints, marginalPotentialPoints: marginalPoints,
      incrementalFenceDemand: incrementalFence })),
    combinedPotentialPoints: covered.size + features.bonusPoints, basePoints: covered.size,
    cropPoints: features.cropPoints, fertilityPoints: features.fertilityPoints,
    rawSummedPerimeterDemand, distinctFenceDemand: fence.size,
    sharedFencePositionsSaved: rawSummedPerimeterDemand - fence.size,
    distinctNewLetterPositions: [...fence].filter((index) => !isLetterCell(board.cells[index])).length,
    distinctCoveredCells: covered.size,
    featureCoverage: { crop: features.features.filter((feature) => feature.type === 'crop').length,
      fertile: features.features.filter((feature) => feature.type === 'fertile').length,
      livestock: features.livestock, building: features.buildings } };
}
