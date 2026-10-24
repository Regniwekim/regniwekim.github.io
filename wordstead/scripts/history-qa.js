import { createDailySession } from '../src/daily/challenge.js';
import { commitSessionWord, evaluateSessionPlacement, exchangeTiles } from '../src/core/session.js';
import { createSave, appendAction, wordAction, withDraft } from '../src/persistence/history.js';

/** Development-only fixed observation from persistence QA, not a puzzle solver. */
export function prepareHistoryVictory(dictionary, date = '2026-10-23') {
  let state = createDailySession(date).session;
  let save = createSave('daily', state);
  const moves = [
    { word: 'TIGER', row: 7, column: 5, orientation: 'horizontal' },
    { word: 'HEIGHT', row: 2, column: 5, orientation: 'vertical' },
    { word: 'HORSE', row: 2, column: 5, orientation: 'horizontal' },
    { word: 'EITHER', row: 2, column: 9, orientation: 'vertical' },
  ];
  for (const [index, move] of moves.entries()) {
    let evaluation;
    for (let attempt = 0; attempt < 150; attempt++) {
      evaluation = evaluateSessionPlacement(state, move, dictionary);
      if (evaluation.legal) break;
      if (evaluation.reason.code !== 'MISSING_RACK_LETTERS') throw new Error(evaluation.reason.message);
      const held = new Set(evaluation.rack.allocations.map(({ tile }) => tile.id));
      const ids = state.rack.filter((tile) => !held.has(tile.id)).map((tile) => tile.id);
      const exchanged = exchangeTiles(state, ids);
      if (!exchanged.accepted) throw new Error('Fixed QA exchange failed.');
      state = exchanged.state; save = appendAction(save, { type: 'exchange', tileIds: ids });
    }
    if (!evaluation.legal) throw new Error('Fixed QA tiles unavailable.');
    const result = commitSessionWord(state, move, dictionary);
    if (!result.accepted) throw new Error(result.evaluation.reason.message);
    if (index === moves.length - 1) {
      if (result.state.status !== 'won') throw new Error('Fixed QA enclosure did not reach its target.');
      return { state, finished: result.state,
        save: withDraft(save, { tiles: wordAction(result).assignments }),
        completedSave: appendAction(save, wordAction(result)) };
    }
    state = result.state; save = appendAction(save, wordAction(result));
  }
}
