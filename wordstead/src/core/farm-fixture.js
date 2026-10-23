import { createEnclosureBagOrder } from './session-fixture.js';
import { createSession } from './session.js';
import { placeFeature } from './features.js';

/** Dedicated QA fixtures; the original 2C/2C.1 fixture is untouched. */
export function createFarmSession(type) {
  const state = createSession({ rows: 7, columns: 7, seed: 'enclosure-qa',
    target: type === 'crop' ? 4 : type === 'fertile' ? 2 : 20, bagOrder: createEnclosureBagOrder() });
  return { ...state, farmFixture: type,
    puzzle: { ...state.puzzle, board: placeFeature(state.puzzle.board, 4, 4, type) } };
}
