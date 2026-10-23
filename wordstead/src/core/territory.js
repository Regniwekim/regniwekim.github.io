import { analyzeEnclosure } from './enclosure.js';

/** Claims are a separate dense boolean mask, with dimensions guarding reuse. */
export function createTerritory(board) {
  return {
    rows: board.rows,
    columns: board.columns,
    claimed: Array(board.cells.length).fill(false),
  };
}

function validateTerritory(board, territory) {
  if (territory.rows !== board.rows || territory.columns !== board.columns
    || territory.claimed.length !== board.cells.length) {
    throw new RangeError('Territory dimensions must match the board.');
  }
}

/** One point per unique newly claimed index from evaluateTerritory. No bonuses. */
export function calculateTerritoryPoints(newlyClaimed) {
  return new Set(newlyClaimed).size;
}

/** Total historical points, including claims later covered by sandbox letters. */
export function getTerritoryScore(territory) {
  return territory.claimed.filter(Boolean).length;
}

/**
 * Preview a claim without changing either input. Unclaimed enclosed non-letter
 * cells become newlyClaimed; existing claims never score again. All index lists
 * are deterministic row-major order. Territory must come from createTerritory
 * or claimTerritory, paired with a board of the same dimensions.
 */
export function evaluateTerritory(board, territory) {
  validateTerritory(board, territory);
  const { exterior, enclosed } = analyzeEnclosure(board);
  const newlyClaimed = enclosed.filter((index) => !territory.claimed[index]);
  return { exterior, enclosed, newlyClaimed, points: calculateTerritoryPoints(newlyClaimed) };
}

/**
 * Atomically evaluate current occupancy and return { territory, ...evaluation,
 * totalPoints }. Always copies the claim mask. Opening a fence or occupying a
 * claimed cell does not erase historical claims or points. No state is mutated.
 */
export function claimTerritory(board, territory) {
  const evaluation = evaluateTerritory(board, territory);
  const claimed = territory.claimed.slice();
  for (const index of evaluation.newlyClaimed) claimed[index] = true;
  const nextTerritory = { ...territory, claimed };
  return {
    ...evaluation,
    territory: nextTerritory,
    totalPoints: getTerritoryScore(nextTerritory),
  };
}
