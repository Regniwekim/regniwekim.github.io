import { isLetterCell } from '../core/letters.js';
import { isFeatureCell, FEATURE_TYPES } from '../core/features.js';
import { getStartingSquare } from '../core/placement.js';
import { RACK_CAPACITY, MAX_RACK_CAPACITY } from '../core/bag.js';

export const FEATURE_KEYS = Object.freeze(Object.keys(FEATURE_TYPES));
export const featureCounts = () => Object.fromEntries(FEATURE_KEYS.map((type) => [type, 0]));
export const fraction = (value, total) => total > 0 ? value / total : null;

/** Analysis accepts the existing dense board and optional authoritative claim mask. */
export function validateBoard(board, territory) {
  if (!board || !Number.isSafeInteger(board.rows) || board.rows < 1
    || !Number.isSafeInteger(board.columns) || board.columns < 1
    || !Number.isSafeInteger(board.rows * board.columns)
    || !Array.isArray(board.cells) || board.cells.length !== board.rows * board.columns
    || Array.from(board.cells).some((cell) => cell === undefined)) {
    throw new TypeError('Analysis requires a valid dense Wordstead board.');
  }
  if (territory !== undefined && (!territory || territory.rows !== board.rows || territory.columns !== board.columns
    || !Array.isArray(territory.claimed) || territory.claimed.length !== board.cells.length
    || Array.from(territory.claimed).some((value) => typeof value !== 'boolean'))) {
    throw new TypeError('Analysis territory must be a matching dense boolean claim mask.');
  }
}

export function isCollectible(board, index, territory) {
  const row = Math.floor(index / board.columns);
  const column = index % board.columns;
  const start = getStartingSquare(board);
  return row > 0 && row < board.rows - 1 && column > 0 && column < board.columns - 1
    && !(row === start.row && column === start.column)
    && !isLetterCell(board.cells[index]) && !territory?.claimed[index];
}

/** Optimistic eligible-interior upper bound; this does not assert reachability. */
export function analyzeBoardComposition(board, { territory } = {}) {
  validateBoard(board, territory);
  const start = getStartingSquare(board);
  const counts = featureCounts();
  const eligibleFeatures = featureCounts();
  const capturedFeatures = featureCounts();
  const byRow = Array.from({ length: board.rows }, featureCounts);
  const byColumn = Array.from({ length: board.columns }, featureCounts);
  const quadrants = Array.from({ length: 4 }, featureCounts);
  let emptyCells = 0, letterCells = 0, reservedCells = 0, otherReservedCells = 0, basePoints = 0;
  let startDistanceSum = 0, featureTotal = 0;
  for (let index = 0; index < board.cells.length; index += 1) {
    const cell = board.cells[index];
    const row = Math.floor(index / board.columns), column = index % board.columns;
    const eligible = isCollectible(board, index, territory);
    if (cell === null) emptyCells += 1;
    else if (isLetterCell(cell)) letterCells += 1;
    else { reservedCells += 1; if (!isFeatureCell(cell)) otherReservedCells += 1; }
    if (eligible) basePoints += 1;
    if (!isFeatureCell(cell)) continue;
    counts[cell.type] += 1;
    byRow[row][cell.type] += 1;
    byColumn[column][cell.type] += 1;
    quadrants[(row < start.row ? 0 : 2) + (column < start.column ? 0 : 1)][cell.type] += 1;
    if (eligible) eligibleFeatures[cell.type] += 1;
    if (territory?.claimed[index]) capturedFeatures[cell.type] += 1;
    featureTotal += 1;
    startDistanceSum += Math.abs(row - start.row) + Math.abs(column - start.column);
  }
  const cropPoints = eligibleFeatures.crop * FEATURE_TYPES.crop.bonusPoints;
  const fertilityPoints = eligibleFeatures.fertile * FEATURE_TYPES.fertile.bonusPoints;
  const interiorCells = Math.max(0, board.rows - 2) * Math.max(0, board.columns - 2);
  const quadrantTotals = quadrants.map((counts) => Object.values(counts).reduce((sum, value) => sum + value, 0));
  const capacity = Math.min(MAX_RACK_CAPACITY, RACK_CAPACITY + capturedFeatures.livestock);
  return { rows: board.rows, columns: board.columns, totalCells: board.cells.length,
    interiorCells, perimeterCells: board.cells.length - interiorCells, startingSquare: start,
    emptyCells, letterCells, reservedCells, reservedFeatureCells: featureTotal, otherReservedCells,
    claimedCells: territory?.claimed.filter(Boolean).length ?? 0, featureCounts: counts,
    eligibleFeatureCounts: eligibleFeatures,
    distribution: { byRow, byColumn, quadrantOrder: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
      quadrants, quadrantTotals, featureDensity: featureTotal / board.cells.length,
      // HHI in four center-split bins; not an area-corrected clustering statistic.
      quadrantConcentration: featureTotal ? quadrantTotals.reduce((sum, value) => sum + (value / featureTotal) ** 2, 0) : null,
      largestQuadrantFraction: featureTotal ? Math.max(...quadrantTotals) / featureTotal : null,
      meanDistanceFromStart: fraction(startDistanceSum, featureTotal),
      normalizedMeanDistanceFromStart: fraction(startDistanceSum, featureTotal * (board.rows + board.columns - 2)) },
    theoreticalScoringUpperBound: { interpretation: 'Optimistic upper bound, not a reachable maximum.',
      basePoints, cropPoints, fertilityPoints, bonusPoints: cropPoints + fertilityPoints,
      totalPoints: basePoints + cropPoints + fertilityPoints,
      exclusions: ['outside perimeter land', 'starting square', 'committed letters', 'previous claims'] },
    utility: { totalLivestock: counts.livestock, totalBuildings: counts.building,
      potentialRackCapacityRewards: eligibleFeatures.livestock,
      potentialAdditionalRackSlots: Math.min(MAX_RACK_CAPACITY - capacity, eligibleFeatures.livestock),
      potentialFreeExchangeCredits: eligibleFeatures.building } };
}

/** Integral image: all queries use inclusive logical bounds, no per-rectangle scans. */
export function prefixSum(board, valueAt) {
  const stride = board.columns + 1;
  const data = new Float64Array((board.rows + 1) * stride);
  for (let row = 0; row < board.rows; row += 1) {
    let running = 0;
    for (let column = 0; column < board.columns; column += 1) {
      running += valueAt(row * board.columns + column);
      data[(row + 1) * stride + column + 1] = data[row * stride + column + 1] + running;
    }
  }
  return (top, left, bottom, right) => bottom < top || right < left ? 0
    : data[(bottom + 1) * stride + right + 1] - data[top * stride + right + 1]
      - data[(bottom + 1) * stride + left] + data[top * stride + left];
}

export function prepareBoardAnalysis(board, territory) {
  validateBoard(board, territory);
  const eligible = board.cells.map((_, index) => isCollectible(board, index, territory));
  const features = Object.fromEntries(FEATURE_KEYS.map((type) => [type,
    prefixSum(board, (index) => Number(eligible[index] && isFeatureCell(board.cells[index]) && board.cells[index].type === type))]));
  return { board, territory, start: getStartingSquare(board), eligible,
    base: prefixSum(board, (index) => Number(eligible[index])), features,
    blocked: prefixSum(board, (index) => Number(board.cells[index] !== null && !isLetterCell(board.cells[index]))),
    letters: prefixSum(board, (index) => Number(isLetterCell(board.cells[index]))),
    blockedFeatures: Object.fromEntries(FEATURE_KEYS.map((type) => [type,
      prefixSum(board, (index) => Number(isFeatureCell(board.cells[index]) && board.cells[index].type === type))])) };
}
