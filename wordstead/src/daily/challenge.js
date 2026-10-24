import { validateDailyDate } from './date.js';
import { VOCABULARY } from '../vocabulary/manifest.js';
import { TARGET_METHOD_VERSION } from '../analysis/automatic-target.js';
import { createTargetSession, restartTargetSession } from '../analysis/target-session.js';

export const DAILY_FORMAT = 'wordstead-daily-v1';
// Released v1 settings are literals: changing Free Play defaults cannot change dailies.
export const DAILY_CONFIGURATION = Object.freeze({ rows: 15, columns: 15, farmDensity: 0.08,
  farmWeights: Object.freeze({ crop: 4, livestock: 2, building: 2, fertile: 3 }), targetMode: 'automatic',
  vocabularyId: 'esdb-en-us-60-1e5b7d3-ws1', methodVersion: 'auto-target-v1' });
export const DAILY_RULES = Object.freeze({ gameplay: 'wordstead-rules-2d-v1',
  farmGeneration: 'wordstead-farm-2d-v1', bag: 'wordstead-standard-100-v1', startingRack: 7,
  vocabularySha256: '724ed98404895a23d5c3db1c205aae3369c6a66f9b34b46cadb4b91f068f4532' });

/** Pure, fixed configuration. No user settings or ambient clock enter this boundary. */
export function defineDailyChallenge(date) {
  validateDailyDate(date);
  return Object.freeze({ date, formatVersion: DAILY_FORMAT,
    letterSeed: `${DAILY_FORMAT}:letters:${date}`, farmSeed: `${DAILY_FORMAT}:farm:${date}`,
    ...DAILY_CONFIGURATION, rules: DAILY_RULES });
}

/** One candidate only in v1. Structural checks do not establish word solvability. */
export function createDailySession(date, analysisOptions) {
  const definition = defineDailyChallenge(date);
  const unavailable = (reason, message, estimate = null) => ({ available: false, session: null,
    definition: Object.freeze({ ...definition, resolvedTarget: null }), reason, message, estimate });
  if (VOCABULARY.id !== definition.vocabularyId || VOCABULARY.sha256 !== DAILY_RULES.vocabularySha256
    || TARGET_METHOD_VERSION !== definition.methodVersion) {
    return unavailable('INCOMPATIBLE_DAILY_VERSION', 'This daily revision needs its original vocabulary and target model.');
  }
  const result = createTargetSession({ ...DAILY_CONFIGURATION,
    seed: definition.letterSeed, farmSeed: definition.farmSeed }, analysisOptions);
  const { estimate } = result;
  if (!result.available) return unavailable(estimate.reason, estimate.message, estimate);
  if (!Number.isSafeInteger(estimate.target) || estimate.target < 1
    || !(estimate.board.theoreticalUpperBound > 0) || !estimate.board.primary
    || estimate.target > estimate.board.theoreticalUpperBound) {
    return unavailable('INVALID_DAILY_TARGET', 'The daily challenge failed its structural target checks.', estimate);
  }
  const resolved = Object.freeze({ ...definition, resolvedTarget: estimate.target });
  const daily = Object.freeze({ date, formatVersion: DAILY_FORMAT,
    vocabularyId: definition.vocabularyId, targetMethod: definition.methodVersion, rules: DAILY_RULES });
  return { available: true, definition: resolved, estimate, session: { ...result.session, daily } };
}

/** Replay the active date and resolved target, even after midnight; never read the clock. */
export function restartDailySession(state) {
  if (state.daily?.formatVersion !== DAILY_FORMAT) throw new TypeError('Unsupported daily challenge revision.');
  return { ...restartTargetSession(state), daily: state.daily };
}
