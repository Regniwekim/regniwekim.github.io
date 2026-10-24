import { createSession } from '../core/session.js';
import { estimateAutomaticTarget } from './automatic-target.js';

/** Resolve an integer before using the unchanged session constructor. */
export function createTargetSession(configuration = {}, analysisOptions) {
  const { targetMode = 'automatic', ...settings } = configuration;
  if (targetMode === 'manual') {
    const session = createSession(settings);
    session.targetSelection = Object.freeze({ mode: 'manual', resolvedTarget: session.target, methodVersion: null });
    return { available: true, session, estimate: null };
  }
  if (targetMode !== 'automatic') throw new TypeError('Choose automatic or manual target selection.');
  const estimate = estimateAutomaticTarget(settings, analysisOptions);
  if (!estimate.available) return { available: false, session: null, estimate };
  const session = createSession({ ...settings, target: estimate.target, farmSeed: estimate.inputs.farmSeed });
  session.targetSelection = Object.freeze({ mode: 'automatic', resolvedTarget: estimate.target,
    methodVersion: estimate.methodVersion, vocabularyId: estimate.inputs.vocabularyId,
    boardMethod: estimate.inputs.boardMethod, letterMethod: estimate.inputs.letterMethod,
    lexicalApproximation: estimate.inputs.lexicalApproximation });
  return { available: true, session, estimate };
}

/** Uses only the original run; never re-estimates against edited setup controls. */
export function restartTargetSession(state) {
  if (state.source !== 'seeded') throw new TypeError('Scripted fixtures use their own constructors.');
  return { ...createSession({ rows: state.puzzle.board.rows, columns: state.puzzle.board.columns,
    seed: state.seed, target: state.target, farmSeed: state.farm?.seed ?? null,
    farmDensity: state.farm?.density, farmWeights: state.farm?.weights }),
  ...(state.targetSelection ? { targetSelection: state.targetSelection } : {}) };
}
