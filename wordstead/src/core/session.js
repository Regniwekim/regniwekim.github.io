import { createBag, replenishRack, shuffleTiles } from './bag.js';
import { createPuzzle, commitWord } from './puzzle.js';
import { evaluatePlacement } from './placement.js';
import { getTerritoryScore } from './territory.js';

// Temporary, unbalanced target for the small demonstration vocabulary.
export const DEFAULT_TARGET = 1;
export const DEFAULT_SEED = 'wordstead-2c';

export function createSession({ rows = 15, columns = 15, seed = DEFAULT_SEED,
  target = DEFAULT_TARGET, bagOrder } = {}) {
  if (!Number.isSafeInteger(target) || target <= 0) {
    throw new RangeError('Territory target must be a positive safe integer.');
  }
  const { bag, rngState } = createBag(seed, bagOrder);
  return {
    puzzle: createPuzzle({ rows, columns }), ...replenishRack([], bag),
    seed, rngState, target, exchangeCount: 0, status: 'playing',
    source: bagOrder === undefined ? 'seeded' : 'scripted',
  };
}

export function getStrokes(state) {
  return state.puzzle.wordCount + state.exchangeCount;
}

function statusAfterAction(state) {
  if (getTerritoryScore(state.puzzle.territory) >= state.target) return 'won';
  return state.rack.length === 0 && state.bag.length === 0 ? 'exhausted' : 'playing';
}

function closedReason(state) {
  return state.status === 'playing' ? null
    : { code: 'RUN_FINISHED', message: `This run is ${state.status}. Start or restart a puzzle to play.` };
}

/** Allocate exact letters before blanks, in proposal/rack order; no resources move. */
function allocateRack(rack, positions) {
  const remaining = rack.slice();
  const allocations = [];
  const missing = new Map();
  for (const position of positions) {
    let index = remaining.findIndex((tile) => tile.letter === position.letter);
    if (index < 0) index = remaining.findIndex((tile) => tile.letter === null);
    if (index < 0) {
      missing.set(position.letter, (missing.get(position.letter) ?? 0) + 1);
    } else {
      const [tile] = remaining.splice(index, 1);
      allocations.push({ ...position, tile, blank: tile.letter === null });
    }
  }
  return { allocations, missingLetters: [...missing].map(([letter, count]) => ({ letter, count })) };
}

/** Preserve geometry/dictionary results and reason precedence, then check resources. */
export function evaluateSessionPlacement(state, proposal, dictionary) {
  const evaluation = evaluatePlacement(state.puzzle.board, proposal, dictionary);
  const rack = allocateRack(state.rack, evaluation.newPositions);
  const finished = closedReason(state);
  if (finished) return { ...evaluation, legal: false, reason: finished, rack };
  if (!evaluation.legal || !rack.missingLetters.length) return { ...evaluation, rack };
  const missing = rack.missingLetters.map(({ letter, count }) => `${letter} ×${count}`).join(', ');
  return { ...evaluation, legal: false, rack,
    reason: { code: 'MISSING_RACK_LETTERS', message: `Rack cannot supply: ${missing}.`,
      missingLetters: rack.missingLetters } };
}

/** Revalidate and delegate the sole word/claim engine before publishing any state. */
export function commitSessionWord(state, proposal, dictionary) {
  const evaluation = evaluateSessionPlacement(state, proposal, dictionary);
  const rejected = (ev) => ({ accepted: false, state, evaluation: ev, points: 0, newlyClaimed: [] });
  if (!evaluation.legal) return rejected(evaluation);
  const result = commitWord(state.puzzle, proposal, dictionary);
  if (!result.accepted) return rejected({ ...result.evaluation, rack: evaluation.rack });
  // Keep letter-cell compatibility, adding physical identity and blank provenance.
  const cells = result.state.board.cells.slice();
  for (const { index, tile, blank } of evaluation.rack.allocations) {
    cells[index] = { ...cells[index], tileId: tile.id, blank };
  }
  const spent = new Set(evaluation.rack.allocations.map(({ tile }) => tile.id));
  const resources = replenishRack(state.rack.filter((tile) => !spent.has(tile.id)), state.bag);
  const next = { ...state, ...resources,
    puzzle: { ...result.state, board: { ...result.state.board, cells } } };
  next.status = statusAfterAction(next);
  return { ...result, state: next, evaluation, consumedTiles: evaluation.rack.allocations.map(({ tile }) => tile) };
}

export function evaluateExchange(state, tileIds) {
  const finished = closedReason(state);
  if (finished) return { legal: false, reason: finished };
  if (!Array.isArray(tileIds) || tileIds.length === 0) {
    return { legal: false, reason: { code: 'EMPTY_EXCHANGE', message: 'Select at least one rack tile.' } };
  }
  if (new Set(tileIds).size !== tileIds.length
    || Array.from(tileIds).some((id) => !state.rack.some((tile) => tile.id === id))) {
    return { legal: false, reason: { code: 'INVALID_EXCHANGE_TILES', message: 'Select distinct tiles from the current rack.' } };
  }
  if (state.bag.length < tileIds.length) {
    return { legal: false, reason: { code: 'INSUFFICIENT_BAG', message: `Only ${state.bag.length} tiles remain in the bag; select no more than that.` } };
  }
  return { legal: true, reason: null };
}

/** Replacements are drawn BEFORE returns; selection order cannot affect the shuffle. */
export function exchangeTiles(state, tileIds) {
  const evaluation = evaluateExchange(state, tileIds);
  if (!evaluation.legal) return { accepted: false, state, ...evaluation };
  const selected = new Set(tileIds);
  const returned = state.rack.filter((tile) => selected.has(tile.id));
  const replacements = state.bag.slice(0, returned.length);
  let replacement = 0;
  const rack = state.rack.map((tile) => selected.has(tile.id) ? replacements[replacement++] : tile);
  const shuffled = shuffleTiles([...state.bag.slice(returned.length), ...returned], state.rngState);
  return { accepted: true, state: { ...state, ...shuffled, rack, exchangeCount: state.exchangeCount + 1 },
    returned, replacements, reason: null };
}

export function endSession(state) {
  const reason = closedReason(state);
  if (reason) return { accepted: false, state, reason };
  return { accepted: true, state: { ...state, status: 'ended' }, reason: null };
}
