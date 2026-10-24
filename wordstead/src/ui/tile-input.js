import { placeDraftTile, returnDraftTile, assignDraftBlank } from '../core/draft.js';
import { pointerToCell, cellToView } from '../rendering/board.js';

const DRAG_THRESHOLD = 8;

/** Pointer gestures publish draft changes ONLY at a successful release.
 * The board's ordinary surface keeps native scrolling; drafted tile handles and
 * rack buttons alone reserve touch gestures for dragging. */
export function initializeTileInput({ canvas, viewport, rackButtons, enabled, getState,
  getDraft, setDraft, getCellSize, selectCell, refresh, redraw = () => {} }) {
  const find = (id) => document.getElementById(id);
  const handles = new Map();
  const suppressed = new WeakSet();
  const dialog = find('blank-dialog');
  const ghost = find('tile-ghost');
  let selected = null;
  let gesture = null;
  let drop = null;
  let blankChoice = null;
  let blankFocus = null;
  const tileById = (id) => getState().rack.find((tile) => tile.id === id);
  const draftById = (id) => getDraft().tiles.find((tile) => tile.tileId === id);
  const describe = (tile) => `physical tile ${tile.tileId}${tile.assignedLetter ? `, blank assigned ${tile.assignedLetter}` : `, ${tile.letter}`}`;

  function cancelSelection() {
    selected = null;
    refresh('Tile selection cancelled. Draft unchanged.');
  }

  function chooseBlank(tile, callback) {
    blankChoice = callback;
    blankFocus = document.activeElement;
    find('blank-title').textContent = `Assign blank tile ${tile.id}`;
    dialog.showModal();
  }
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = letter;
    button.setAttribute('aria-label', `Assign blank as ${letter}`);
    button.addEventListener('click', () => {
      const callback = blankChoice;
      blankChoice = null;
      dialog.close();
      callback?.(letter);
    });
    find('blank-letters').append(button);
  }
  find('cancel-blank').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    const cancelled = blankChoice !== null;
    blankChoice = null;
    if (cancelled) blankFocus?.focus({ preventScroll: true });
  });

  function selectTile(tile) {
    if (!enabled() || !tile) return;
    const drafted = draftById(tile.id);
    if (selected?.tileId === tile.id) {
      if (drafted) returnSelected();
      else cancelSelection();
      return;
    }
    const choose = (assignedLetter) => {
      selected = { tileId: tile.id, letter: tile.letter ?? assignedLetter,
        assignedLetter: tile.letter === null ? assignedLetter : null };
      refresh(`Selected ${describe(selected)}. Choose a board cell to ${drafted ? 'move' : 'place'} it.`);
      canvas.focus({ preventScroll: true });
    };
    if (tile.letter === null && !drafted) chooseBlank(tile, choose);
    else choose(drafted?.assignedLetter);
  }

  function returnSelected() {
    if (!enabled() || !selected) return;
    const slot = getState().rack.findIndex((tile) => tile.id === selected.tileId);
    setDraft(returnDraftTile(getDraft(), selected.tileId));
    selected = null;
    refresh(`Tile returned to its original rack slot ${slot + 1}. No resources spent.`);
    rackButtons[slot]?.focus({ preventScroll: true });
  }

  function activateCell({ row, column }) {
    if (!enabled()) return;
    const cell = { row, column };
    if (selected) {
      const result = placeDraftTile(getState(), getDraft(), { ...selected, ...cell });
      if (result.accepted) {
        const placed = selected;
        setDraft(result.draft);
        selected = null;
        refresh(`Placed ${describe(placed)} at row ${cell.row + 1}, column ${cell.column + 1}. Select the next rack tile.`);
      } else refresh(`Placement rejected: ${result.reason.message} Tile and draft unchanged.`);
    } else {
      const tile = getDraft().tiles.find((item) => item.row === cell.row && item.column === cell.column);
      if (tile) selectTile(tileById(tile.tileId));
      else refresh('Select a rack tile first, then choose an available board cell.');
    }
  }

  function cellAt(event) {
    const rect = viewport.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX >= rect.right
      || event.clientY < rect.top || event.clientY >= rect.bottom) return null;
    return pointerToCell(canvas, getState().puzzle.board, getCellSize(), event.clientX, event.clientY);
  }

  function begin(event, source, tile) {
    if (!enabled() || !tile || !event.isPrimary || event.button !== 0 || gesture) return;
    suppressed.delete(source);
    const drafted = draftById(tile.id);
    const assignment = drafted?.assignedLetter ?? (selected?.tileId === tile.id ? selected.assignedLetter : null);
    // Assign an unassigned blank with a tap first. No provisional letter is guessed.
    if (tile.letter === null && !assignment) return;
    gesture = { pointerId: event.pointerId, source, x: event.clientX, y: event.clientY, dragging: false,
      tile: { tileId: tile.id, letter: tile.letter ?? assignment, assignedLetter: assignment } };
    source.setPointerCapture(event.pointerId);
  }
  function finish(cancelled = false, event = null) {
    if (!gesture) return;
    const current = gesture;
    gesture = null;
    drop = null;
    ghost.hidden = true;
    current.source.dataset.dragging = 'false';
    find('drag-status').textContent = '';
    if (current.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId);
    if (current.dragging || cancelled) suppressed.add(current.source);
    if (cancelled) { refresh('Drag cancelled. Tile and draft unchanged.'); return; }
    if (!current.dragging) return; // The following native click handles taps and keyboard activation.
    const cell = cellAt(event);
    const ownSlot = rackButtons.find((button) => {
      const rect = button.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX < rect.right
        && event.clientY >= rect.top && event.clientY < rect.bottom
        && button.dataset.tileId !== '' && Number(button.dataset.tileId) === current.tile.tileId;
    });
    if (ownSlot && draftById(current.tile.tileId)) {
      setDraft(returnDraftTile(getDraft(), current.tile.tileId));
      selected = null;
      refresh('Draft tile returned to its original rack slot. No resources spent.');
    } else if (cell) {
      const result = placeDraftTile(getState(), getDraft(), { ...current.tile, ...cell });
      if (result.accepted) {
        setDraft(result.draft);
        selected = null;
        selectCell(cell);
        refresh(`Dropped ${describe(current.tile)} at row ${cell.row + 1}, column ${cell.column + 1}.`);
      } else refresh(`Drop rejected: ${result.reason.message} Tile and draft unchanged.`);
    } else refresh('Drop cancelled outside the board. Tile and draft unchanged.');
  }
  window.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (!gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= DRAG_THRESHOLD) return;
    gesture.dragging = true;
    gesture.source.dataset.dragging = 'true';
    event.preventDefault();
    ghost.hidden = false;
    ghost.textContent = `${gesture.tile.assignedLetter ? '◇ ' : ''}${gesture.tile.letter}`;
    ghost.style.left = `${event.clientX + 12}px`;
    ghost.style.top = `${event.clientY - 48}px`;
    const cell = cellAt(event);
    const result = cell ? placeDraftTile(getState(), getDraft(), { ...gesture.tile, ...cell }) : null;
    drop = cell ? { ...cell, legal: result.accepted } : null;
    ghost.dataset.legal = String(Boolean(result?.accepted));
    const status = cell
      ? `Row ${cell.row + 1}, column ${cell.column + 1}: ${result.accepted ? 'eligible drop' : result.reason.message}`
      : 'Outside board: release to cancel, or return to the tile’s original rack slot.';
    if (find('drag-status').textContent !== status) find('drag-status').textContent = status;
    redraw();
  }, { passive: false });
  window.addEventListener('pointerup', (event) => {
    if (event.pointerId === gesture?.pointerId) finish(false, event);
  });
  window.addEventListener('pointercancel', (event) => {
    if (event.pointerId === gesture?.pointerId) finish(true);
  });
  window.addEventListener('blur', () => finish(true));
  function bindSource(button, getTile, isDraft = false) {
    button.addEventListener('pointerdown', (event) => begin(event, button, getTile()));
    button.addEventListener('lostpointercapture', () => { if (gesture?.source === button) finish(true); });
    button.addEventListener('dragstart', (event) => event.preventDefault());
    button.addEventListener('click', (event) => {
      if (suppressed.has(button)) { suppressed.delete(button); event.preventDefault(); return; }
      const tile = getTile();
      if (isDraft && selected && selected.tileId !== tile?.id) activateCell(draftById(tile.id));
      else selectTile(tile);
    });
  }
  rackButtons.forEach((button, slot) => bindSource(button, () => getState().rack[slot]));
  find('cancel-tile').addEventListener('click', cancelSelection);
  find('return-tile').addEventListener('click', returnSelected);
  find('change-blank').addEventListener('click', () => {
    if (!enabled() || !selected || tileById(selected.tileId)?.letter !== null) return;
    const tileId = selected.tileId;
    chooseBlank(tileById(tileId), (letter) => {
      if (draftById(tileId)) setDraft(assignDraftBlank(getState(), getDraft(), tileId, letter).draft);
      selected = { tileId, letter, assignedLetter: letter };
      refresh(`Blank tile ${tileId} now represents ${letter}.`);
    });
  });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || dialog.open || !enabled()) return;
    if (gesture) finish(true);
    else if (selected) cancelSelection();
  });

  function render() {
    const available = enabled();
    const draft = getDraft();
    if (!available) selected = null;
    find('tile-selection').textContent = selected ? `Selected ${describe(selected)}. ${draftById(selected.tileId)
      ? 'Choose another cell to move, or return it to the rack.' : 'Choose an available board cell.'}` : 'No tile selected.';
    find('tile-selection').hidden = !selected;
    find('cancel-tile').disabled = !selected;
    find('return-tile').disabled = !available || !selected || !draftById(selected.tileId);
    find('change-blank').disabled = !available || !selected || tileById(selected.tileId)?.letter !== null;
    for (const [id, button] of handles) {
      if (!available || !draft.tiles.some((tile) => tile.tileId === id)) { button.remove(); handles.delete(id); }
    }
    if (available) for (const tile of draft.tiles) {
      let button = handles.get(tile.tileId);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'draft-handle';
        bindSource(button, () => tileById(tile.tileId), true);
        handles.set(tile.tileId, button);
        find('draft-handles').append(button);
      }
      const { x, y } = cellToView(tile, getCellSize());
      Object.assign(button.style, { left: `${x}px`, top: `${y}px`, width: `${getCellSize()}px`, height: `${getCellSize()}px` });
      button.setAttribute('aria-label', `Draft ${describe(tile)} at row ${tile.row + 1}, column ${tile.column + 1}. Pick up to move or return.`);
      button.setAttribute('aria-pressed', String(selected?.tileId === tile.tileId));
    }
  }
  return { render, activateCell, get selected() { return selected; }, get drop() { return drop; },
    reset() { finish(true); selected = null; if (dialog.open) dialog.close(); },
    cancelSelection };
}
