import { createSession, commitSessionWord, exchangeTiles, endSession } from '../core/session.js';
import { createDraft, inspectDraft } from '../core/draft.js';
import { DEFAULT_FARM_WEIGHTS } from '../core/farm-layout.js';
import { createDailySession, DAILY_FORMAT, DAILY_RULES } from '../daily/challenge.js';
import { validateDailyDate } from '../daily/date.js';
import { VOCABULARY } from '../vocabulary/manifest.js';
import { TARGET_METHOD_VERSION } from '../analysis/automatic-target.js';
import { TARGET_LEXICON } from '../analysis/target-lexicon-v1.js';

export const SAVE_SCHEMA = 1;
export const SAVE_LIMITS = Object.freeze({ characters: 262144, actions: 1000, seedCharacters: 256 });
export const SAVE_IDENTITY = Object.freeze({ ...DAILY_RULES, vocabulary: VOCABULARY.id,
  shuffle: 'fnv1a-mulberry32-fisher-yates-v1' });
const fail = (message) => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const shape = (value, keys) => object(value) && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
// Key order is not part of compatibility. Values here have bounded, explicit shapes.
const equal = (a, b) => a === b || (object(a) && object(b)
  && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => Object.hasOwn(b, key) && equal(a[key], b[key])));
const seed = (value) => (typeof value === 'string' && value.trim().length > 0 && value.length <= SAVE_LIMITS.seedCharacters)
  || (typeof value === 'number' && Number.isFinite(value));
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const tileId = (value) => Number.isInteger(value) && value >= 0 && value < 100;
const letter = (value) => typeof value === 'string' && /^[A-Z]$/.test(value);
const position = (value, board) => Number.isInteger(value.row) && value.row >= 0 && value.row < board.rows
  && Number.isInteger(value.column) && value.column >= 0 && value.column < board.columns;

function validateSelection(selection, target) {
  const manual = { mode: 'manual', resolvedTarget: target, methodVersion: null };
  const automatic = { mode: 'automatic', resolvedTarget: target, methodVersion: TARGET_METHOD_VERSION,
    vocabularyId: VOCABULARY.id, boardMethod: 'board-rectangles-v1', letterMethod: 'rack-lexical-v1',
    lexicalApproximation: TARGET_LEXICON.methodVersion };
  check(equal(selection, manual) || equal(selection, automatic), 'Incompatible target selection version or resolved target.');
}

function configuration(state) {
  return { rows: state.puzzle.board.rows, columns: state.puzzle.board.columns, seed: state.seed,
    farmSeed: state.farm?.seed ?? null, farmDensity: state.farm?.density ?? 0,
    farmWeights: { ...(state.farm?.weights ?? DEFAULT_FARM_WEIGHTS) }, target: state.target,
    targetSelection: { ...state.targetSelection } };
}

/** Call only when creating a fresh production attempt. Scripted fixtures never enter saves. */
export function createSave(mode, state) {
  check(['daily', 'free'].includes(mode) && state.source === 'seeded', 'Only seeded Daily and Free Play runs can be saved.');
  check((mode === 'daily') === Boolean(state.daily), 'Save mode does not match the session.');
  return { schemaVersion: SAVE_SCHEMA, mode, identity: { ...SAVE_IDENTITY },
    daily: state.daily ? { date: state.daily.date, formatVersion: state.daily.formatVersion } : null,
    configuration: configuration(state), actions: [], draft: createDraft() };
}

/** Record the allocation actually accepted by the commitment boundary, including explicit blanks. */
export function wordAction(result) {
  check(result.accepted, 'Rejected words cannot enter the history.');
  const { word, row, column, orientation } = result.evaluation.proposal;
  return { type: 'word', proposal: { word, row, column, orientation },
    assignments: result.evaluation.rack.allocations.map(({ tile, blank, letter: glyph, row: r, column: c }) => ({
      tileId: tile.id, row: r, column: c, letter: glyph, assignedLetter: blank ? glyph : null,
    })) };
}

export const appendAction = (save, action) => ({ ...save, actions: [...save.actions, action], draft: createDraft() });
export const withDraft = (save, draft) => ({ ...save, draft: { tiles: draft.tiles.map((tile) => ({ ...tile })) } });
export const hasProgress = (state, draft) => Boolean(state && (state.puzzle.wordCount || state.exchangeCount
  || state.status !== 'playing' || draft.tiles.length));

/** Validate ownership independently of committability: arbitrary returns can leave a legitimate gap. */
export function restoreDraft(state, draft) {
  check(shape(draft, ['tiles']) && Array.isArray(draft.tiles) && draft.tiles.length <= 9, 'Malformed saved draft.');
  check(state.status === 'playing' || draft.tiles.length === 0, 'Finished runs cannot contain a draft.');
  const board = state.puzzle.board;
  const ids = new Set(), cells = new Set();
  for (const tile of draft.tiles) {
    check(shape(tile, ['tileId', 'letter', 'assignedLetter', 'row', 'column']) && tileId(tile.tileId)
      && letter(tile.letter) && position(tile, board), 'Invalid draft tile or position.');
    const physical = state.rack.find((item) => item.id === tile.tileId);
    const index = tile.row * board.columns + tile.column;
    check(physical && !ids.has(tile.tileId) && !cells.has(index) && board.cells[index] === null,
      'Draft tiles must belong to the rack and occupy distinct empty cells.');
    check(physical.letter === null ? tile.assignedLetter === tile.letter
      : tile.letter === physical.letter && tile.assignedLetter === null, 'Invalid saved blank assignment.');
    ids.add(tile.tileId); cells.add(index);
  }
  const structural = inspectDraft(board, draft);
  check(structural.coherent || ['EMPTY_DRAFT', 'DRAFT_GAP'].includes(structural.reason.code), 'Invalid saved draft geometry.');
  return { tiles: draft.tiles.map((tile) => ({ ...tile })) };
}

function validateConfiguration(c) {
  check(shape(c, ['rows', 'columns', 'seed', 'farmSeed', 'farmDensity', 'farmWeights', 'target', 'targetSelection']), 'Malformed original settings.');
  check([c.rows, c.columns].every((n) => positive(n) && n <= 30) && seed(c.seed)
    && (c.farmSeed === null || seed(c.farmSeed)) && Number.isFinite(c.farmDensity)
    && c.farmDensity >= 0 && c.farmDensity <= 1 && positive(c.target), 'Invalid board, seeds, density or target.');
  check(shape(c.farmWeights, ['crop', 'livestock', 'building', 'fertile'])
    && Object.values(c.farmWeights).every((n) => Number.isFinite(n) && n >= 0)
    && Number.isFinite(Object.values(c.farmWeights).reduce((a, b) => a + b, 0))
    && Object.values(c.farmWeights).some((n) => n > 0), 'Invalid farm weights.');
  validateSelection(c.targetSelection, c.target);
}

function reconstruct(save, mode) {
  check(shape(save, ['schemaVersion', 'mode', 'identity', 'daily', 'configuration', 'actions', 'draft']), 'Malformed save structure.');
  check(save.schemaVersion === SAVE_SCHEMA, 'Unsupported save schema version.');
  check(['daily', 'free'].includes(mode) && save.mode === mode, 'Save belongs to a different game mode.');
  check(equal(save.identity, SAVE_IDENTITY), 'Incompatible vocabulary, bag, generator or gameplay rules.');
  const c = save.configuration;
  validateConfiguration(c);
  if (mode === 'daily') {
    check(shape(save.daily, ['date', 'formatVersion']) && save.daily.formatVersion === DAILY_FORMAT, 'Incompatible daily format.');
    validateDailyDate(save.daily.date);
    const result = createDailySession(save.daily.date);
    check(result.available && equal(configuration(result.session), c), 'Daily settings or expected target no longer match this challenge.');
    return result.session;
  }
  check(save.daily === null, 'Free Play cannot contain a daily identity.');
  // Automatic Free Play targets are already resolved. Never re-estimate an existing attempt.
  return { ...createSession(c), targetSelection: Object.freeze({ ...c.targetSelection }) };
}

function validateAction(action, board) {
  check(object(action), 'Malformed saved action.');
  if (action.type === 'word') {
    check(shape(action, ['type', 'proposal', 'assignments'])
      && shape(action.proposal, ['word', 'row', 'column', 'orientation']), 'Malformed word action.');
    const p = action.proposal;
    check(typeof p.word === 'string' && /^[A-Z]{1,30}$/.test(p.word) && position(p, board)
      && ['horizontal', 'vertical'].includes(p.orientation), 'Invalid saved word proposal.');
    check(Array.isArray(action.assignments) && action.assignments.length > 0 && action.assignments.length <= 9,
      'Invalid physical word allocation.');
    for (const a of action.assignments) check(shape(a, ['tileId', 'row', 'column', 'letter', 'assignedLetter'])
      && tileId(a.tileId) && position(a, board) && letter(a.letter)
      && (a.assignedLetter === null || letter(a.assignedLetter)), 'Invalid physical tile assignment.');
  } else if (action.type === 'exchange') {
    check(shape(action, ['type', 'tileIds']) && Array.isArray(action.tileIds) && action.tileIds.length > 0
      && action.tileIds.length <= 9 && action.tileIds.every(tileId), 'Invalid saved exchange.');
  } else check(action.type === 'end' && shape(action, ['type']), 'Unsupported saved action.');
}

/** Pure all-or-nothing replay; no recovered partial state escapes on failure. */
export function restoreSave(save, mode, dictionary) {
  let state = reconstruct(save, mode);
  check(Array.isArray(save.actions) && save.actions.length <= SAVE_LIMITS.actions, 'Saved action history exceeds the supported limit.');
  for (const action of save.actions) {
    validateAction(action, state.puzzle.board);
    const result = action.type === 'word' ? commitSessionWord(state, action.proposal, dictionary, action.assignments)
      : action.type === 'exchange' ? exchangeTiles(state, action.tileIds) : endSession(state);
    check(result.accepted, 'Saved action failed the current rules, tile resources or terminal-state checks.');
    state = result.state;
  }
  return { state, draft: restoreDraft(state, save.draft), save };
}

export function serializeSave(save) {
  validateConfiguration(save.configuration);
  check(save.actions.length <= SAVE_LIMITS.actions, 'This run exceeds the local action-history limit.');
  const raw = JSON.stringify(save);
  check(raw.length <= SAVE_LIMITS.characters, 'This save exceeds the local size limit.');
  return raw;
}

export function parseSave(raw, mode, dictionary) {
  try {
    check(typeof raw === 'string' && raw.length <= SAVE_LIMITS.characters, 'Saved payload exceeds the local size limit.');
    let save;
    try { save = JSON.parse(raw); } catch { fail('Saved data is not valid JSON.'); }
    return { ok: true, ...restoreSave(save, mode, dictionary) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Save could not be restored.' };
  }
}
