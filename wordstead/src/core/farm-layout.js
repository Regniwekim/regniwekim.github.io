import { seedToState, shuffleTiles, nextRandom } from './bag.js';
import { getStartingSquare } from './placement.js';
import { createFeatureCell, FEATURE_TYPES } from './features.js';

export const DEFAULT_FARM_SEED = 'wordstead-farm-2d';
export const DEFAULT_FARM_DENSITY = 0.08;
export const DEFAULT_FARM_WEIGHTS = Object.freeze({ crop: 4, livestock: 2, building: 2, fertile: 3 });

/** Independent PRNG stream. Density is a fraction of eligible empty interior cells. */
export function generateFarm(board, { seed = DEFAULT_FARM_SEED, density = DEFAULT_FARM_DENSITY,
  weights = DEFAULT_FARM_WEIGHTS } = {}) {
  if (!Number.isFinite(density) || density < 0 || density > 1) {
    throw new RangeError('Farm density must be between zero and one.');
  }
  const types = Object.keys(FEATURE_TYPES);
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)
    || Object.keys(weights).some((type) => !Object.hasOwn(FEATURE_TYPES, type))
    || types.some((type) => !Object.hasOwn(weights, type) || !Number.isFinite(weights[type]) || weights[type] < 0)) {
    throw new TypeError('Supply a nonnegative finite weight for every farm feature type.');
  }
  const total = types.reduce((sum, type) => sum + weights[type], 0);
  if (!Number.isFinite(total) || total <= 0) throw new RangeError('Farm weights must have a positive finite total.');
  const start = getStartingSquare(board);
  const eligible = [];
  for (let row = 1; row < board.rows - 1; row += 1) {
    for (let column = 1; column < board.columns - 1; column += 1) {
      const index = row * board.columns + column;
      if (board.cells[index] === null && Math.abs(row - start.row) + Math.abs(column - start.column) > 1) eligible.push(index);
    }
  }
  let { bag: positions, rngState } = shuffleTiles(eligible, seedToState(seed));
  const cells = board.cells.slice();
  for (const index of positions.slice(0, Math.floor(eligible.length * density))) {
    let value;
    ({ value, rngState } = nextRandom(rngState));
    const choice = value / 0x100000000 * total;
    let cumulative = 0;
    const type = types.find((item) => { cumulative += weights[item]; return choice < cumulative; })
      ?? types.findLast((item) => weights[item] > 0); // Rounding at subnormal positive weights.
    cells[index] = createFeatureCell(type);
  }
  return { ...board, cells };
}
