import { FEATURE_TYPES } from '../core/features.js';
import { prepareBoardAnalysis, FEATURE_KEYS } from './board-composition.js';

export function rectangleKey(rectangle) {
  return `${rectangle.top},${rectangle.left},${rectangle.bottom},${rectangle.right}`;
}

export function compareCoordinates(a, b) {
  return a.top - b.top || a.left - b.left || a.bottom - b.bottom || a.right - b.right;
}

/** Complete perimeter, corners exactly once; indices are generated only on request. */
export function rectanglePerimeter(board, rectangle) {
  validateRectangle(board, rectangle);
  const { top, left, bottom, right } = rectangle;
  const indices = [];
  for (let column = left; column <= right; column += 1) indices.push(top * board.columns + column);
  for (let row = top + 1; row < bottom; row += 1) {
    indices.push(row * board.columns + left, row * board.columns + right);
  }
  for (let column = left; column <= right; column += 1) indices.push(bottom * board.columns + column);
  return indices;
}

function validateRectangle(board, { top, left, bottom, right }) {
  if (![top, left, bottom, right].every(Number.isSafeInteger) || top < 0 || left < 0
    || bottom >= board.rows || right >= board.columns || bottom - top < 2 || right - left < 2) {
    throw new RangeError('A candidate rectangle must fit the board and have an interior.');
  }
}

export function startingRelationship(start, { top, left, bottom, right }) {
  const inside = start.row > top && start.row < bottom && start.column > left && start.column < right;
  const within = start.row >= top && start.row <= bottom && start.column >= left && start.column <= right;
  const distance = inside ? Math.min(start.row - top, bottom - start.row, start.column - left, right - start.column)
    : Math.max(top - start.row, 0, start.row - bottom) + Math.max(left - start.column, 0, start.column - right);
  return { position: inside ? 'inside' : within ? 'fence' : 'outside', onFence: within && !inside,
    inside, outside: !within, distanceToFence: distance };
}

/** Constant-time measurement against precomputed masks, including rejected fences. */
export function measureRectangle(context, rectangle) {
  const { top, left, bottom, right } = rectangle;
  const interior = (sum) => sum(top + 1, left + 1, bottom - 1, right - 1);
  const perimeter = (sum) => sum(top, left, bottom, right) - interior(sum);
  const width = right - left + 1, height = bottom - top + 1;
  const perimeterCellCount = 2 * width + 2 * height - 4;
  const basePoints = interior(context.base);
  const cropPoints = interior(context.features.crop) * FEATURE_TYPES.crop.bonusPoints;
  const fertilityPoints = interior(context.features.fertile) * FEATURE_TYPES.fertile.bonusPoints;
  return { top, left, bottom, right, basePoints, cropPoints, fertilityPoints,
    potentialPoints: basePoints + cropPoints + fertilityPoints,
    livestock: interior(context.features.livestock), buildings: interior(context.features.building),
    crops: interior(context.features.crop), fertile: interior(context.features.fertile),
    perimeterCellCount, existingFenceLetters: perimeter(context.letters),
    reservedCellObstructions: perimeter(context.blocked),
    startingDistance: startingRelationship(context.start, rectangle).distanceToFence };
}

export function describeRectangle(context, candidate) {
  const { top, left, bottom, right } = candidate;
  const width = right - left + 1, height = bottom - top + 1;
  const obstructionByType = Object.fromEntries(FEATURE_KEYS.map((type) => {
    const sum = context.blockedFeatures[type];
    return [type, sum(top, left, bottom, right) - sum(top + 1, left + 1, bottom - 1, right - 1)];
  }));
  return { id: rectangleKey(candidate), ...candidate, width, height,
    interiorArea: (width - 2) * (height - 2), grossGeometricArea: width * height,
    valid: candidate.reservedCellObstructions === 0,
    obstructionByType, otherObstructions: candidate.reservedCellObstructions - Object.values(obstructionByType).reduce((a, b) => a + b, 0),
    bonusPoints: candidate.cropPoints + candidate.fertilityPoints,
    startingSquare: startingRelationship(context.start, candidate),
    effort: { estimatedFenceEffort: candidate.perimeterCellCount, perimeterDemand: candidate.perimeterCellCount,
      newLetterPositions: candidate.perimeterCellCount - candidate.existingFenceLetters,
      horizontalSpans: [width, width], verticalSpans: [height, height], longestSpan: Math.max(width, height) },
    opportunityEfficiency: candidate.potentialPoints / candidate.perimeterCellCount };
}

export function analyzeRectangle(board, rectangle, { territory } = {}) {
  validateRectangle(board, rectangle);
  const context = prepareBoardAnalysis(board, territory);
  return describeRectangle(context, measureRectangle(context, rectangle));
}

export function searchSettings(board, options = {}) {
  const settings = { maxWidth: options.maxWidth ?? board.columns, maxHeight: options.maxHeight ?? board.rows,
    maxPerimeter: options.maxPerimeter ?? 2 * board.rows + 2 * board.columns,
    minPoints: options.minPoints ?? 1 };
  for (const [key, value] of Object.entries(settings)) {
    if (!Number.isSafeInteger(value) || value < (key === 'minPoints' ? 0 : 1)) throw new RangeError(`Invalid search limit: ${key}.`);
  }
  return settings;
}

export function visitRectangles(context, settings, visit) {
  const { board } = context;
  let considered = 0;
  const allRectangleCount = Math.max(0, (board.rows - 2) * (board.rows - 1) / 2)
    * Math.max(0, (board.columns - 2) * (board.columns - 1) / 2);
  for (let top = 0; top < board.rows - 2; top += 1) {
    for (let left = 0; left < board.columns - 2; left += 1) {
      for (let bottom = top + 2; bottom < Math.min(board.rows, top + settings.maxHeight); bottom += 1) {
        for (let right = left + 2; right < Math.min(board.columns, left + settings.maxWidth); right += 1) {
          if (2 * (bottom - top + right - left) > settings.maxPerimeter) continue;
          considered += 1;
          visit(measureRectangle(context, { top, left, bottom, right }));
        }
      }
    }
  }
  return { ...settings, allRectangleCount, consideredRectangles: considered,
    skippedBySearchLimits: allRectangleCount - considered, exhaustiveGeometry: considered === allRectangleCount };
}

/** Explicit raw diagnostic path; default summaries retain bounded ranking pools. */
export function enumerateRectangleCandidates(board, options = {}) {
  const context = prepareBoardAnalysis(board, options.territory);
  const candidates = [], obstructed = [];
  const search = visitRectangles(context, searchSettings(board, options), (candidate) => {
    if (candidate.reservedCellObstructions) {
      if (options.includeObstructed) obstructed.push(describeRectangle(context, candidate));
    } else if (candidate.potentialPoints >= (options.minPoints ?? 1)) candidates.push(describeRectangle(context, candidate));
  });
  return { search, candidates, obstructed };
}
