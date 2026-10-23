import { getCellIndex } from '../core/board.js';
import { isLetterCell, setLetter } from '../core/letters.js';
import { evaluateTerritory, claimTerritory, getTerritoryScore } from '../core/territory.js';
import { evaluatePlacement, getStartingSquare } from '../core/placement.js';
import { createPuzzle, commitWord } from '../core/puzzle.js';
import { demoDictionary, DEMO_WORDS } from '../core/demo-vocabulary.js';
import { drawBoard, pointerToCell, revealSelection } from '../rendering/board.js';

/** Two isolated in-memory sessions, one shared renderer and input surface. */
export function initializeSandbox() {
  const find = (id) => document.getElementById(id);
  const canvas = find('board');
  const viewport = find('board-viewport');
  const rowInput = find('cell-row');
  const columnInput = find('cell-column');
  const wordInput = find('word');
  function session(dimensions) {
    const state = createPuzzle(dimensions);
    return { state, selected: getStartingSquare(state.board), recentClaims: [], latestAward: 0 };
  }
  const sessions = { words: session(), freeform: session() };
  let mode = 'words';
  let preview = null;
  let cellSize = Number(find('cell-size').value);
  const active = () => sessions[mode];
  const proposal = () => ({
    word: wordInput.value, ...active().selected, orientation: find('orientation').value,
  });

  function render(message) {
    const { state: { board, territory, wordCount }, selected, recentClaims, latestAward } = active();
    const evaluation = evaluateTerritory(board, territory);
    const previewTerritory = preview?.legal ? evaluateTerritory(preview.proposedBoard, territory) : null;
    const startingSquare = mode === 'words' ? getStartingSquare(board) : null;
    drawBoard(canvas, { board, territory, evaluation, recentClaims, selected, cellSize,
      preview, previewTerritory, startingSquare });
    find('territory-score').textContent = getTerritoryScore(territory);
    find('word-count').textContent = wordCount;
    find('latest-award').textContent = `+${latestAward}`;
    find('enclosed-count').textContent = evaluation.enclosed.length;
    find('claimable-count').textContent = evaluation.newlyClaimed.length;
    find('board-summary').textContent = `${board.rows} rows × ${board.columns} columns · ${cellSize}px cells`;
    find('starting-square').textContent = startingSquare
      ? `First word: cross ☆ at row ${startingSquare.row + 1}, column ${startingSquare.column + 1}.`
      : 'Freeform diagnostic edits do not follow word rules.';
    rowInput.max = board.rows;
    columnInput.max = board.columns;
    rowInput.value = selected.row + 1;
    columnInput.value = selected.column + 1;
    const index = getCellIndex(board, selected.row, selected.column);
    const cell = board.cells[index];
    const status = isLetterCell(cell) ? `committed letter ${cell.letter}${territory.claimed[index] ? ', previously claimed underneath' : ''}`
      : territory.claimed[index] ? `${recentClaims.includes(index) ? 'newly' : 'previously'} claimed land${evaluation.exterior.includes(index) ? ', now exterior' : ''}`
        : evaluation.enclosed.includes(index) ? 'enclosed, unclaimed land' : 'exterior land';
    find('selection-status').textContent = `Row ${selected.row + 1}, column ${selected.column + 1}: ${status}.`;
    find('commit-word').disabled = mode !== 'words' || !preview?.legal;
    find('placement-feedback').textContent = preview
      ? preview.legal
        ? `Valid preview: ${preview.newPositions.length} new, ${preview.reusedPositions.length} reused letters. Would claim ${previewTerritory.points} cells (+${previewTerritory.points}). Commit word to accept.`
        : `Invalid preview [${preview.reason.code}]: ${preview.reason.message}`
      : 'No preview. Enter a word and choose a starting cell, then preview.';
    find('placement-feedback').dataset.legality = preview ? (preview.legal ? 'valid' : 'invalid') : '';
    find('formed-words').replaceChildren(...(preview?.words ?? []).map((run) => {
      const item = document.createElement('li');
      const first = run.positions[0];
      item.textContent = `${run.text} · ${run.orientation} · (${first.row + 1}, ${first.column + 1}) · ${run.valid ? 'in vocabulary' : 'unknown'}`;
      return item;
    }));
    if (message) find('action-status').textContent = message;
  }

  function updatePreview() {
    preview = mode === 'words' ? evaluatePlacement(active().state.board, proposal(), demoDictionary) : null;
    render();
  }

  function select(cell) {
    active().selected = cell;
    if (mode === 'words' && wordInput.value.trim()) updatePreview();
    else render();
    revealSelection(viewport, cell, cellSize);
  }

  function toggleSelected() {
    if (mode !== 'freeform') return;
    const current = active();
    const { board } = current.state;
    const { row, column } = current.selected;
    const removing = isLetterCell(board.cells[getCellIndex(board, row, column)]);
    current.state = { ...current.state, board: setLetter(board, row, column, removing ? null : 'A') };
    current.recentClaims = [];
    render(`${removing ? 'Removed test letter' : 'Placed test letter A'} at row ${row + 1}, column ${column + 1}.`);
  }

  function reset(dimensions = active().state.board) {
    sessions[mode] = session({ rows: dimensions.rows, columns: dimensions.columns });
    preview = null;
    wordInput.value = '';
    find('rows').value = dimensions.rows;
    find('columns').value = dimensions.columns;
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
    render('Empty board ready. Letters, claims, awards and word count reset for this mode.');
  }

  find('mode').addEventListener('change', () => {
    mode = find('mode').value;
    preview = null;
    const legal = mode === 'words';
    find('word-controls').hidden = !legal;
    find('freeform-actions').hidden = legal;
    find('toggle-letter').hidden = legal;
    find('word-metrics').hidden = !legal;
    find('freeform-metrics').hidden = legal;
    find('board-help').textContent = legal
      ? 'Tap a starting cell. Arrow keys move selection; Enter or Space previews only. Use Commit word to accept. Swipe or scroll to pan.'
      : 'Diagnostic lab: tap to toggle A. Arrow keys select; Enter or Space toggles. Claims are manual. This session is separate from legal play.';
    find('rows').value = active().state.board.rows;
    find('columns').value = active().state.board.columns;
    render(legal ? 'Legal word placement resumed. Lab edits are kept separate.' : 'Freeform enclosure lab resumed. Arbitrary edits affect only this lab.');
  });
  find('word-form').addEventListener('submit', (event) => { event.preventDefault(); updatePreview(); });
  wordInput.addEventListener('input', updatePreview);
  find('orientation').addEventListener('change', updatePreview);
  find('clear-preview').addEventListener('click', () => { preview = null; render('Preview cleared. No letters or claims changed.'); });
  find('commit-word').addEventListener('click', () => {
    if (mode !== 'words' || !preview) return;
    const result = commitWord(active().state, proposal(), demoDictionary);
    if (!result.accepted) {
      preview = result.evaluation;
      render(`Placement rejected: ${result.evaluation.reason.message}`);
      return;
    }
    active().state = result.state;
    active().recentClaims = result.newlyClaimed;
    active().latestAward = result.points;
    preview = null;
    const formed = result.evaluation.words.map((run) => run.text).join(', ');
    wordInput.value = '';
    render(`Accepted placement ${result.state.wordCount}: ${formed}. Claimed ${result.newlyClaimed.length} new cells. +${result.points} territory points.`);
  });
  find('example').addEventListener('click', () => {
    reset({ rows: 7, columns: 7 });
    wordInput.value = 'CAR';
    find('orientation').value = 'horizontal';
    updatePreview();
    render('7×7 example ready. CAR is previewed, not committed. Follow the four moves below.');
  });
  find('coordinates').addEventListener('submit', (event) => {
    event.preventDefault();
    const cell = { row: Number(rowInput.value) - 1, column: Number(columnInput.value) - 1 };
    getCellIndex(active().state.board, cell.row, cell.column);
    select(cell);
  });
  // Unsubmitted coordinate edits must not leave a committable preview of the old cell.
  for (const input of [rowInput, columnInput]) input.addEventListener('input', () => {
    preview = null;
    find('commit-word').disabled = true;
    find('placement-feedback').textContent = 'Select cell to apply these coordinates, then preview.';
    find('placement-feedback').dataset.legality = '';
    find('formed-words').replaceChildren();
    const { state: { board, territory }, selected, recentClaims } = active();
    drawBoard(canvas, { board, territory, selected, recentClaims, cellSize,
      evaluation: evaluateTerritory(board, territory),
      startingSquare: mode === 'words' ? getStartingSquare(board) : null });
  });
  find('toggle-letter').addEventListener('click', toggleSelected);
  find('inspect').addEventListener('click', () => {
    if (mode !== 'freeform') return;
    const { board, territory } = active().state;
    const evaluation = evaluateTerritory(board, territory);
    render(`${evaluation.enclosed.length} enclosed cells; ${evaluation.points} points available to claim.`);
  });
  find('claim').addEventListener('click', () => {
    if (mode !== 'freeform') return;
    const current = active();
    const result = claimTerritory(current.state.board, current.state.territory);
    current.state = { ...current.state, territory: result.territory };
    current.recentClaims = result.newlyClaimed;
    current.latestAward = result.points;
    render(`Claimed ${result.newlyClaimed.length} new cells. +${result.points} territory points. Total ${result.totalPoints}.`);
  });
  find('reset').addEventListener('click', () => reset());
  find('dimensions').addEventListener('submit', (event) => {
    event.preventDefault();
    reset({ rows: Number(find('rows').value), columns: Number(find('columns').value) });
  });
  find('cell-size').addEventListener('change', () => {
    cellSize = Number(find('cell-size').value);
    render('Cell display size changed.');
    revealSelection(viewport, active().selected, cellSize);
  });

  // A tap selects (or toggles in the lab); panning never edits or commits.
  let press = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.isPrimary && event.button === 0) press = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointercancel', () => { press = null; });
  canvas.addEventListener('pointerup', (event) => {
    const start = press;
    press = null;
    if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
    const cell = pointerToCell(canvas, active().state.board, cellSize, event.clientX, event.clientY);
    if (!cell) return;
    select(cell);
    canvas.focus({ preventScroll: true });
    if (mode === 'freeform') toggleSelected();
  });
  canvas.addEventListener('keydown', (event) => {
    const movements = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (movements[event.key]) {
      event.preventDefault();
      const [dr, dc] = movements[event.key];
      const { selected, state: { board } } = active();
      select({ row: Math.max(0, Math.min(board.rows - 1, selected.row + dr)),
        column: Math.max(0, Math.min(board.columns - 1, selected.column + dc)) });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) mode === 'freeform' ? toggleSelected() : updatePreview();
    }
  });
  find('vocabulary').textContent = DEMO_WORDS.join(', ');
  window.addEventListener('resize', () => render());
  render('Word placement ready. Enter a word, select its start and preview before committing.');
}
