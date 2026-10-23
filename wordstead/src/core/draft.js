import { isLetterCell, createLetterCell } from './letters.js';
import { extractAffectedWords } from './placement.js';
import { evaluateSessionPlacement, commitSessionWord } from './session.js';

// Ephemeral intent only. The authoritative rack, bag and puzzle never move here.
export const createDraft = () => ({ tiles: [] });
const reason = (code, message) => ({ code, message });
const at = (a, b) => a.row === b.row && a.column === b.column;
const inBounds = (board, tile) => Number.isSafeInteger(tile.row) && Number.isSafeInteger(tile.column)
  && tile.row >= 0 && tile.row < board.rows && tile.column >= 0 && tile.column < board.columns;

/** Removal may leave a split. Keep every remaining tile, but block commitment. */
export function inspectDraft(board, draft) {
  const { tiles } = draft;
  const reject = (code, message) => ({ coherent: false, orientation: null, reason: reason(code, message) });
  if (!tiles.length) return reject('EMPTY_DRAFT', 'Select a rack tile, then place it on the board.');
  if (new Set(tiles.map((tile) => tile.tileId)).size !== tiles.length
    || tiles.some((tile, index) => !inBounds(board, tile) || typeof tile.letter !== 'string' || !/^[A-Z]$/.test(tile.letter)
      || board.cells[tile.row * board.columns + tile.column] !== null
      || tiles.slice(0, index).some((other) => at(tile, other)))) {
    return reject('INVALID_DRAFT', 'Draft tiles must be distinct, assigned letters on available board cells.');
  }
  if (tiles.length === 1) return { coherent: true, orientation: null, reason: null };
  const horizontal = tiles.every((tile) => tile.row === tiles[0].row);
  const vertical = tiles.every((tile) => tile.column === tiles[0].column);
  if (!horizontal && !vertical) return reject('DRAFT_AXIS', 'Keep draft tiles in one straight row or column; no branches or diagonals.');
  const orientation = horizontal ? 'horizontal' : 'vertical';
  const axis = horizontal ? 'column' : 'row';
  const values = tiles.map((tile) => tile[axis]);
  for (let value = Math.min(...values); value <= Math.max(...values); value += 1) {
    const position = { ...tiles[0], [axis]: value };
    if (!tiles.some((tile) => at(tile, position))
      && !isLetterCell(board.cells[position.row * board.columns + position.column])) {
      return { coherent: false, orientation, reason: reason('DRAFT_GAP',
        'Draft has an empty gap. Fill the gap, return a tile, undo, or clear to repair it.') };
    }
  }
  return { coherent: true, orientation, reason: null };
}

/** Place or move one physical tile atomically. Invalid drops return the SAME draft. */
export function placeDraftTile(state, draft, { tileId, row, column, assignedLetter }) {
  const reject = (code, message) => ({ accepted: false, draft, reason: reason(code, message) });
  if (state.status !== 'playing') return reject('RUN_FINISHED', 'This run is finished. Restart to place tiles.');
  const tile = state.rack.find((item) => item.id === tileId);
  if (!tile) return reject('INVALID_TILE_ALLOCATION', 'That physical tile is no longer in the rack.');
  const previous = draft.tiles.find((item) => item.tileId === tileId);
  const assignment = tile.letter === null ? assignedLetter ?? previous?.assignedLetter : null;
  if (tile.letter === null && (typeof assignment !== 'string' || !/^[A-Z]$/.test(assignment))) {
    return reject('BLANK_ASSIGNMENT', 'Choose an A–Z letter for this blank.');
  }
  const position = { tileId, letter: tile.letter ?? assignment, assignedLetter: assignment, row, column };
  const board = state.puzzle.board;
  if (!inBounds(board, position)) return reject('OUT_OF_BOUNDS', 'Choose a cell inside the board.');
  if (board.cells[row * board.columns + column] !== null) return reject('CELL_OCCUPIED', 'Letters and reserved farm features cannot be replaced.');
  if (draft.tiles.some((other) => other.tileId !== tileId && at(other, position))) {
    return reject('DRAFT_OCCUPIED', 'Another draft tile is here. Return or move it first.');
  }
  const next = { tiles: [...draft.tiles.filter((item) => item.tileId !== tileId), position] };
  const structural = inspectDraft(board, next);
  if (!structural.coherent) return { accepted: false, draft, reason: structural.reason };
  return { accepted: true, draft: next, reason: null };
}

export function returnDraftTile(draft, tileId) {
  return draft.tiles.some((tile) => tile.tileId === tileId)
    ? { tiles: draft.tiles.filter((tile) => tile.tileId !== tileId) } : draft;
}

export const undoDraft = (draft) => draft.tiles.length ? { tiles: draft.tiles.slice(0, -1) } : draft;

export function assignDraftBlank(state, draft, tileId, letter) {
  const tile = draft.tiles.find((item) => item.tileId === tileId);
  if (state.status !== 'playing' || !tile || typeof letter !== 'string' || !/^[A-Z]$/.test(letter)
    || !state.rack.some((item) => item.id === tileId && item.letter === null)) {
    return { accepted: false, draft, reason: reason('BLANK_ASSIGNMENT', 'Choose an A–Z letter for a current drafted blank.') };
  }
  return { accepted: true, draft: { tiles: draft.tiles.map((item) => item.tileId === tileId
    ? { ...item, letter, assignedLetter: letter } : item) }, reason: null };
}

/** Infer complete runs from logical occupancy; dictionary decisions stay in placement.js. */
export function evaluateDraft(state, draft, dictionary) {
  const board = state.puzzle.board;
  const structural = inspectDraft(board, draft);
  const failed = (failure) => ({ legal: false, reason: failure, structural, proposal: null,
    positions: draft.tiles.map((tile) => ({ ...tile, index: tile.row * board.columns + tile.column, status: 'new' })),
    newPositions: [], reusedPositions: [], conflictPositions: [], words: [], proposedBoard: null,
    rack: { allocations: [], missingLetters: [] } });
  if (state.status !== 'playing') return failed(reason('RUN_FINISHED', 'This run is finished. Restart to play.'));
  if (!structural.coherent) return failed(structural.reason);
  const cells = board.cells.slice();
  for (const tile of draft.tiles) cells[tile.row * board.columns + tile.column] = createLetterCell(tile.letter);
  const candidate = { ...board, cells };
  const runs = extractAffectedWords(candidate, draft.tiles);
  const orientation = structural.orientation ?? runs[0]?.orientation ?? 'horizontal';
  const run = runs.find((item) => item.orientation === orientation);
  const first = run?.positions[0] ?? draft.tiles[0];
  const proposal = { word: run?.text ?? draft.tiles[0].letter, row: first.row, column: first.column, orientation };
  return { ...evaluateSessionPlacement(state, proposal, dictionary, draft.tiles), structural };
}

/** Reconstruct and revalidate at the sole rack-aware commitment boundary. */
export function commitSessionDraft(state, draft, dictionary) {
  const evaluation = evaluateDraft(state, draft, dictionary);
  if (!evaluation.legal) return { accepted: false, state, draft, evaluation, newlyClaimed: [], points: 0 };
  const result = commitSessionWord(state, evaluation.proposal, dictionary, draft.tiles);
  return { ...result, evaluation: { ...result.evaluation, structural: evaluation.structural },
    draft: result.accepted ? createDraft() : draft };
}
