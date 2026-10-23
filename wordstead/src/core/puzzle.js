import { createBoard } from './board.js';
import { evaluatePlacement } from './placement.js';
import { createTerritory, claimTerritory } from './territory.js';

/** Minimal legal-play state. Total score is derived exclusively from claims. */
export function createPuzzle(dimensions) {
  const board = createBoard(dimensions);
  return { board, territory: createTerritory(board), wordCount: 0 };
}

/** Re-evaluate current state at commit time; never trust a cached preview.
 * All work completes before returning a replacement state, including claims. */
export function commitWord(state, proposal, dictionary) {
  const evaluation = evaluatePlacement(state.board, proposal, dictionary);
  if (!evaluation.legal) {
    return { accepted: false, state, evaluation, newlyClaimed: [], points: 0 };
  }
  const board = evaluation.proposedBoard;
  const claim = claimTerritory(board, state.territory);
  return {
    accepted: true,
    state: { board, territory: claim.territory, wordCount: state.wordCount + 1 },
    evaluation, newlyClaimed: claim.newlyClaimed, points: claim.points,
  };
}
