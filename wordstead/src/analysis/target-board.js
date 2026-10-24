import { createStandardTiles, RACK_CAPACITY } from '../core/bag.js';
import { analyzeBoardComposition, prepareBoardAnalysis } from './board-composition.js';
import { visitRectangles, compareCoordinates, rectanglePerimeter } from './board-rectangles.js';
import { compatibleRectangles } from './board-portfolio.js';

export const BOARD_TARGET_POLICY = Object.freeze({ maxSpan: RACK_CAPACITY, maxPerimeter: 24,
  maxStartingDistance: RACK_CAPACITY, totalFenceFraction: 0.4, effortReference: 16, secondaryWeight: 0.25 });

/** Two complete bounded passes, no retained ranking pool and no pool truncation. */
export function estimateBoardOpportunity(board) {
  const composition = analyzeBoardComposition(board), context = prepareBoardAnalysis(board);
  const p = BOARD_TARGET_POLICY;
  const settings = { maxWidth: Math.min(board.columns, p.maxSpan), maxHeight: Math.min(board.rows, p.maxSpan),
    maxPerimeter: p.maxPerimeter, minPoints: 1 };
  const fenceBudget = Math.floor(createStandardTiles().length * p.totalFenceFraction);
  const value = (candidate) => candidate.potentialPoints * p.effortReference / candidate.perimeterCellCount
    / (1 + candidate.startingDistance / RACK_CAPACITY);
  const better = (a, b) => b === null || value(a) > value(b)
    || (value(a) === value(b) && (a.perimeterCellCount - b.perimeterCellCount
      || a.startingDistance - b.startingDistance || compareCoordinates(a, b)) < 0);
  let primary = null, secondary = null, obstructed = 0, distant = 0, eligible = 0;
  const search = visitRectangles(context, settings, (candidate) => {
    if (candidate.reservedCellObstructions) { obstructed += 1; return; }
    if (candidate.startingDistance > p.maxStartingDistance) { distant += 1; return; }
    if (!candidate.potentialPoints) return;
    eligible += 1;
    if (better(candidate, primary)) primary = candidate;
  });
  const firstFence = new Set(primary ? rectanglePerimeter(board, primary) : []);
  let sharedFencePositions = 0, distinctFenceDemand = firstFence.size;
  if (primary) visitRectangles(context, settings, (candidate) => {
    if (candidate.reservedCellObstructions || candidate.startingDistance > p.maxStartingDistance
      || !candidate.potentialPoints || !compatibleRectangles(primary, candidate)) return;
    const incremental = rectanglePerimeter(board, candidate).filter((index) => !firstFence.has(index)).length;
    // Start connection is charged once, without assuming free shared-letter construction.
    if (firstFence.size + incremental + primary.startingDistance > fenceBudget) return;
    if (better(candidate, secondary)) {
      secondary = candidate;
      distinctFenceDemand = firstFence.size + incremental;
      sharedFencePositions = candidate.perimeterCellCount - incremental;
    }
  });
  return { methodVersion: 'board-rectangles-v1', theoreticalUpperBound: composition.theoreticalScoringUpperBound.totalPoints,
    search: { ...search, maxStartingDistance: p.maxStartingDistance, passes: primary ? 2 : 1,
      obstructed, distant, eligible, retainedPoolLimit: null, truncated: false },
    policy: { ...p, fenceBudget }, primary, secondary, distinctFenceDemand, sharedFencePositions,
    primaryValue: primary ? value(primary) : 0, secondaryValue: secondary ? value(secondary) : 0,
    opportunity: primary ? value(primary) + p.secondaryWeight * (secondary ? value(secondary) : 0) : 0,
    utilityPointAdjustment: 0,
    interpretation: 'Two greedy bounded geometric opportunities, not an optimal portfolio or playable word sequence.' };
}
