import { getCellIndex } from './board.js';
import { getTerritoryScore } from './territory.js';

// Milestone 2D playtest values, not final balance. Features reserve one land cell.
export const FEATURE_TYPES = Object.freeze({
  crop: Object.freeze({ label: 'Crop', symbol: 'C', bonusPoints: 3,
    effect: '1 territory point + 3 crop bonus points on capture.' }),
  livestock: Object.freeze({ label: 'Livestock', symbol: 'L', bonusPoints: 0,
    effect: '1 territory point; +1 rack capacity on capture, up to nine. Extra tiles come from the bag.' }),
  building: Object.freeze({ label: 'Building', symbol: 'B', bonusPoints: 0,
    effect: '1 territory point; one free exchange credit on capture. Bag requirements still apply.' }),
  fertile: Object.freeze({ label: 'Fertile ground', symbol: 'F', bonusPoints: 1,
    effect: '1 territory point + 1 fertility point for this cell only.' }),
});
export function createFeatureCell(type) {
  if (typeof type !== 'string' || !Object.hasOwn(FEATURE_TYPES, type)) throw new TypeError('Unknown farm feature type.');
  return { kind: 'feature', type };
}

export function isFeatureCell(cell) {
  return cell !== null && typeof cell === 'object' && cell.kind === 'feature'
    && typeof cell.type === 'string' && Object.hasOwn(FEATURE_TYPES, cell.type);
}

/** Authoring helper: never overwrite letters, features or other metadata. */
export function placeFeature(board, row, column, type) {
  const index = getCellIndex(board, row, column);
  const cell = createFeatureCell(type);
  if (board.cells[index] !== null) throw new RangeError('Farm features require an empty cell.');
  const cells = board.cells.slice();
  cells[index] = cell;
  return { ...board, cells };
}

/** Only callers holding authoritative newly-claimed indices award these deltas. */
export function summarizeFeatures(board, indices) {
  const features = [...new Set(indices)].filter((index) => isFeatureCell(board.cells[index]))
    .map((index) => ({ index, type: board.cells[index].type }));
  const count = (type) => features.filter((feature) => feature.type === type).length;
  const cropPoints = count('crop') * FEATURE_TYPES.crop.bonusPoints;
  const fertilityPoints = count('fertile') * FEATURE_TYPES.fertile.bonusPoints;
  return { features, cropPoints, fertilityPoints, bonusPoints: cropPoints + fertilityPoints,
    livestock: count('livestock'), buildings: count('building') };
}

/** Claims are the sole capture authority; no mutable captured or score fields. */
export function getCapturedFeatures(puzzle) {
  return summarizeFeatures(puzzle.board, puzzle.territory.claimed.flatMap((claimed, index) => claimed ? [index] : []));
}

export function getPuzzleScore(puzzle) {
  const basePoints = getTerritoryScore(puzzle.territory);
  const { cropPoints, fertilityPoints, bonusPoints } = getCapturedFeatures(puzzle);
  return { basePoints, cropPoints, fertilityPoints, bonusPoints, totalPoints: basePoints + bonusPoints };
}
