import { createBoard } from '../core/board.js';
import { createBag } from '../core/bag.js';
import { DEFAULT_SEED } from '../core/session.js';
import { generateFarm, DEFAULT_FARM_SEED, DEFAULT_FARM_DENSITY, DEFAULT_FARM_WEIGHTS } from '../core/farm-layout.js';
import { VOCABULARY } from '../vocabulary/manifest.js';
import { estimateBoardOpportunity } from './target-board.js';
import { estimateLetterFlexibility, assertTargetLexicon, TARGET_LEXICON } from './target-letters.js';

export const TARGET_METHOD_VERSION = 'auto-target-v1';
export const TARGET_SCHEMA_VERSION = 1;
export const TARGET_DISCOUNT = 0.55;
export const UNAVAILABLE_MESSAGES = Object.freeze({
  NO_COLLECTIBLE_TERRITORY: 'This board has no collectible interior territory. Change the board dimensions.',
  NO_ELIGIBLE_CANDIDATES: 'No scoring fences fit this experimental search. Change settings or choose Manual; this does not prove the puzzle is unsolvable.',
  INCOMPATIBLE_ANALYSIS: 'The target model and vocabulary are incompatible. Choose Manual or reload a compatible version.',
  UNSUPPORTED_CONFIGURATION: 'Automatic targets support fresh seeded boards with 1–30 rows and columns.',
  INVALID_CONFIGURATION: 'Check the board dimensions, seeds, density and feature weights.',
});

export function selectConservativeTarget(board, letters) {
  const beforeBounds = Math.floor(board.opportunity * TARGET_DISCOUNT * letters.multiplier);
  // A positive measured opportunity permits the minimum 1; zero opportunities never reach this stage.
  const target = Math.min(board.theoreticalUpperBound, Math.max(1, beforeBounds));
  return { target, calibration: { discount: TARGET_DISCOUNT, beforeBounds, lowerBound: 1,
    upperBound: board.theoreticalUpperBound, letterMultiplier: letters.multiplier } };
}

export function estimateAutomaticTarget(configuration = {}, { model = TARGET_LEXICON } = {}) {
  const base = { schemaVersion: TARGET_SCHEMA_VERSION, methodVersion: TARGET_METHOD_VERSION };
  const unavailable = (reason, details = {}) => ({ ...base, available: false, target: null, reason,
    message: UNAVAILABLE_MESSAGES[reason], ...details });
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) return unavailable('INVALID_CONFIGURATION');
  const { rows = 15, columns = 15, seed = DEFAULT_SEED, farmSeed = DEFAULT_FARM_SEED,
    farmDensity = DEFAULT_FARM_DENSITY, farmWeights = DEFAULT_FARM_WEIGHTS,
    vocabularyId = VOCABULARY.id, methodVersion = TARGET_METHOD_VERSION, bagOrder } = configuration;
  if (![rows, columns].every((n) => Number.isSafeInteger(n) && n > 0)) return unavailable('INVALID_CONFIGURATION');
  if (rows > 30 || columns > 30 || bagOrder !== undefined) return unavailable('UNSUPPORTED_CONFIGURATION');
  try { assertTargetLexicon(model); } catch { return unavailable('INCOMPATIBLE_ANALYSIS'); }
  if (vocabularyId !== VOCABULARY.id || methodVersion !== TARGET_METHOD_VERSION) return unavailable('INCOMPATIBLE_ANALYSIS');
  let generated, ordered;
  try {
    generated = createBoard({ rows, columns });
    if (farmSeed !== null) generated = generateFarm(generated, { seed: farmSeed, density: farmDensity, weights: farmWeights });
    ordered = createBag(seed).bag;
  } catch (error) {
    if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
    return unavailable('INVALID_CONFIGURATION');
  }
  const inputs = { rows, columns, seed, farmSeed, farmDensity: farmSeed === null ? 0 : farmDensity,
    farmWeights: { ...farmWeights }, vocabularyId, vocabularySha256: VOCABULARY.sha256,
    boardMethod: 'board-rectangles-v1', letterMethod: 'rack-lexical-v1', lexicalApproximation: model.methodVersion,
    profileSha256: model.profileSha256 };
  const board = estimateBoardOpportunity(generated);
  if (board.theoreticalUpperBound === 0) return unavailable('NO_COLLECTIBLE_TERRITORY', { inputs, board });
  if (!board.primary) return unavailable('NO_ELIGIBLE_CANDIDATES', { inputs, board });
  const letters = estimateLetterFlexibility(ordered, model);
  return { ...base, available: true, ...selectConservativeTarget(board, letters), inputs, board, letters,
    warnings: ['Experimental analytical target; reachability and human difficulty have not been measured.'] };
}
