import { createStandardTiles } from './bag.js';
import { createSession } from './session.js';

/** QA only: a complete standard bag with CARABTAA moved to the front. */
export function createEnclosureBagOrder() {
  const remaining = createStandardTiles();
  const prefix = [...'CARABTAA'].map((letter) => {
    const index = remaining.findIndex((tile) => tile.letter === letter);
    return remaining.splice(index, 1)[0];
  });
  return [...prefix, ...remaining].map((tile) => tile.id);
}

export function createEnclosureSession() {
  return createSession({ rows: 7, columns: 7, seed: 'enclosure-qa', target: 1,
    bagOrder: createEnclosureBagOrder() });
}

export const ENCLOSURE_MOVES = Object.freeze([
  { word: 'CAR', row: 3, column: 3, orientation: 'horizontal' },
  { word: 'CAB', row: 3, column: 3, orientation: 'vertical' },
  { word: 'RAT', row: 3, column: 5, orientation: 'vertical' },
  { word: 'BAT', row: 5, column: 3, orientation: 'horizontal' },
].map(Object.freeze));
