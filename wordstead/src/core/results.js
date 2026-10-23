import { getPuzzleScore, getCapturedFeatures } from './features.js';
import { getChargedExchanges } from './session.js';

export const RESULT_HEADINGS = Object.freeze({
  won: 'Harvest Complete!',
  ended: 'Farm Unfinished',
  exhausted: 'Out of Tiles',
});

/** A terminal snapshot, never a preview or a second source of gameplay state. */
export function getSessionResults(session) {
  if (!Object.hasOwn(RESULT_HEADINGS, session.status)) return null;
  const captured = getCapturedFeatures(session.puzzle);
  const count = (type) => captured.features.filter((feature) => feature.type === type).length;
  const { rows, columns } = session.puzzle.board;
  return Object.freeze({
    status: session.status,
    ...getPuzzleScore(session.puzzle),
    target: session.target,
    wordCount: session.puzzle.wordCount,
    exchangeCount: session.exchangeCount,
    freeExchangesUsed: session.freeExchangesUsed ?? 0,
    chargedExchanges: getChargedExchanges(session),
    captured: Object.freeze({ crops: count('crop'), fertile: count('fertile'),
      livestock: captured.livestock, buildings: captured.buildings }),
    board: Object.freeze({ rows, columns }),
  });
}

const quantity = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

/** Fixed newlines and explicit fields keep shares consistent and spoiler-free. */
export function formatResultsShare(results) {
  if (!results || !Object.hasOwn(RESULT_HEADINGS, results.status)) {
    throw new TypeError('Sharing requires terminal session results.');
  }
  return [
    'WORDSTEAD',
    RESULT_HEADINGS[results.status],
    '',
    `${results.totalPoints}/${results.target} farm points`,
    `${quantity(results.wordCount, 'word')} · ${quantity(results.exchangeCount, 'exchange')}`,
    `${results.basePoints} territory + ${quantity(results.bonusPoints, 'farm bonus point')}`,
    '',
    'Build a farm, one word at a time.',
    'https://games.regniwekim.com/wordstead/',
  ].join('\n');
}
