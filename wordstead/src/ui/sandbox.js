import { getCellIndex } from '../core/board.js';
import { isLetterCell, setLetter } from '../core/letters.js';
import { evaluateTerritory, claimTerritory, getTerritoryScore } from '../core/territory.js';
import { evaluatePlacement, getStartingSquare } from '../core/placement.js';
import { createPuzzle, commitWord } from '../core/puzzle.js';
import { createSession, evaluateSessionPlacement, commitSessionWord, evaluateExchange,
  exchangeTiles, endSession, getStrokes } from '../core/session.js';
import { createEnclosureSession } from '../core/session-fixture.js';
import { demoDictionary, DEMO_WORDS } from '../core/demo-vocabulary.js';
import { drawBoard, pointerToCell, revealSelection } from '../rendering/board.js';

/** Three isolated in-memory sessions, one shared renderer and input surface. */
export function initializeSandbox() {
  const find = (id) => document.getElementById(id);
  const canvas = find('board');
  const viewport = find('board-viewport');
  const rowInput = find('cell-row');
  const columnInput = find('cell-column');
  const wordInput = find('word');
  function session(dimensions, rackState = null) {
    const state = rackState ?? createPuzzle(dimensions);
    const board = rackState ? state.puzzle.board : state.board;
    return { state, selected: getStartingSquare(board), recentClaims: [], latestAward: 0,
      word: '', orientation: 'horizontal', exchanging: false, exchangeIds: [] };
  }
  const sessions = { rack: session(null, createSession()), words: session(), freeform: session() };
  let mode = 'rack';
  let preview = null;
  let cellSize = Number(find('cell-size').value);
  const active = () => sessions[mode];
  const puzzle = () => mode === 'rack' ? active().state.puzzle : active().state;
  const proposal = () => ({
    word: wordInput.value, ...active().selected, orientation: find('orientation').value,
  });

  const rackButtons = Array.from({ length: 7 }, (_, slot) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rack-tile';
    button.addEventListener('click', () => {
      if (mode !== 'rack' || !active().exchanging || active().state.status !== 'playing') return;
      const tile = active().state.rack[slot];
      if (!tile) return;
      const ids = active().exchangeIds;
      active().exchangeIds = ids.includes(tile.id) ? ids.filter((id) => id !== tile.id) : [...ids, tile.id];
      render();
    });
    find('rack').append(button);
    return button;
  });
  const tileLabel = (tile) => tile.letter ?? '◇ (blank)';

  function renderRack() {
    const { state, exchanging, exchangeIds } = active();
    const score = getTerritoryScore(state.puzzle.territory);
    find('goal-label').textContent = `Territory goal: ${score} / ${state.target} points`;
    find('goal-progress').max = state.target;
    find('goal-progress').value = score;
    find('rack-count').textContent = `${state.rack.length} / 7`;
    find('bag-count').textContent = state.bag.length;
    find('exchange-count').textContent = state.exchangeCount;
    find('strokes').textContent = getStrokes(state);
    find('run-info').textContent = state.source === 'scripted'
      ? 'Scripted QA fixture · full standard bag in a controlled order · restart repeats this fixture.'
      : `Letter seed: ${state.seed} · seed controls letter order only.`;
    const metrics = `${state.puzzle.wordCount} accepted words, ${state.exchangeCount} exchanges, ${getStrokes(state)} strokes.`;
    find('run-status').textContent = state.status === 'won' ? `Victory! ${score} territory points. ${metrics} Restart or create a new puzzle.`
      : state.status === 'ended' ? `Run ended by player. ${metrics} Restart or create a new puzzle.`
        : state.status === 'exhausted' ? `Resources exhausted: rack and bag empty. ${metrics} Restart or create a new puzzle.`
          : 'Run in progress. Exchanges cost one provisional stroke each.';
    const used = new Set(preview?.rack?.allocations.map(({ tile }) => tile.id) ?? []);
    rackButtons.forEach((button, slot) => {
      const tile = state.rack[slot];
      const selected = tile && exchangeIds.includes(tile.id);
      button.textContent = tile ? tile.letter ?? '◇' : '–';
      button.disabled = !tile;
      button.setAttribute('aria-pressed', String(Boolean(selected)));
      button.setAttribute('aria-label', `Slot ${slot + 1}: ${tile ? tileLabel(tile) : 'empty'}${selected ? ', selected for exchange' : ''}${used.has(tile?.id) ? ', required by preview' : ''}${!exchanging ? ', activate Exchange tiles to select' : ''}`);
      button.dataset.used = String(used.has(tile?.id));
      button.dataset.empty = String(!tile);
    });
    find('start-exchange').hidden = exchanging;
    find('start-exchange').disabled = state.status !== 'playing' || !state.rack.length || !state.bag.length;
    find('confirm-exchange').hidden = !exchanging;
    find('cancel-exchange').hidden = !exchanging;
    const check = evaluateExchange(state, exchangeIds);
    find('confirm-exchange').disabled = !check.legal;
    find('end-run').disabled = state.status !== 'playing';
    find('exchange-feedback').textContent = exchanging
      ? `${exchangeIds.length} selected · ${state.bag.length} in bag. ${check.legal ? 'Confirm to draw replacements; costs one stroke.' : check.reason.message}`
      : state.status === 'playing' && !state.bag.length ? 'Bag empty. You may still play useful rack tiles or end this run. No complete legal-move solver is implemented.' : '';
  }

  function render(message) {
    const { selected, recentClaims, latestAward, exchanging } = active();
    const { board, territory, wordCount } = puzzle();
    const evaluation = evaluateTerritory(board, territory);
    const previewTerritory = preview?.legal ? evaluateTerritory(preview.proposedBoard, territory) : null;
    const startingSquare = mode !== 'freeform' ? getStartingSquare(board) : null;
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
    const status = isLetterCell(cell) ? `committed letter ${cell.letter}${cell.blank ? ', assigned blank' : ''}${territory.claimed[index] ? ', previously claimed underneath' : ''}`
      : territory.claimed[index] ? `${recentClaims.includes(index) ? 'newly' : 'previously'} claimed land${evaluation.exterior.includes(index) ? ', now exterior' : ''}`
        : evaluation.enclosed.includes(index) ? 'enclosed, unclaimed land' : 'exterior land';
    find('selection-status').textContent = `Row ${selected.row + 1}, column ${selected.column + 1}: ${status}.`;
    for (const control of find('word-controls').querySelectorAll('input, select, button')) control.disabled = exchanging;
    find('commit-word').disabled = mode === 'freeform' || exchanging || !preview?.legal;
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
    find('rack-feedback').textContent = mode === 'rack' && preview
      ? `Spend: ${preview.rack.allocations.map(({ letter, blank, row, column }) => `${blank ? `blank → ${letter}` : letter} at (${row + 1}, ${column + 1})`).join(', ') || 'none'}. Reuse from board (free): ${preview.reusedPositions.map(({ letter, row, column }) => `${letter} at (${row + 1}, ${column + 1})`).join(', ') || 'none'}. Missing: ${preview.rack.missingLetters.map(({ letter, count }) => `${letter} ×${count}`).join(', ') || 'none'}. Preview spends nothing.` : '';
    if (mode === 'rack') renderRack();
    if (message) find('action-status').textContent = message;
  }

  function updatePreview() {
    preview = mode === 'freeform' || active().exchanging ? null : mode === 'rack'
      ? evaluateSessionPlacement(active().state, proposal(), demoDictionary)
      : evaluatePlacement(puzzle().board, proposal(), demoDictionary);
    render();
  }

  function select(cell) {
    active().selected = cell;
    if (mode !== 'freeform' && wordInput.value.trim()) updatePreview();
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

  function reset(dimensions = puzzle().board, rackState = null) {
    if (mode === 'rack' && !rackState) {
      const current = active().state;
      rackState = current.source === 'scripted' ? createEnclosureSession()
        : createSession({ rows: dimensions.rows, columns: dimensions.columns, seed: current.seed, target: current.target });
    }
    sessions[mode] = session({ rows: dimensions.rows, columns: dimensions.columns }, rackState);
    preview = null;
    wordInput.value = '';
    find('orientation').value = 'horizontal';
    syncSetup();
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
    render(mode === 'rack' ? 'Puzzle ready. Fresh rack drawn; counts and progress reset. Restart repeats its letter order.'
      : 'Empty board ready. Letters, claims, awards and word count reset for this mode.');
  }

  function syncSetup() {
    find('rows').value = puzzle().board.rows;
    find('columns').value = puzzle().board.columns;
    find('seed').required = mode === 'rack';
    find('target').required = mode === 'rack';
    find('seed').disabled = mode !== 'rack';
    find('target').disabled = mode !== 'rack';
    if (mode === 'rack') {
      find('seed').value = active().state.seed;
      find('target').value = active().state.target;
    }
  }

  function changeMode(nextMode) {
    active().word = wordInput.value;
    active().orientation = find('orientation').value;
    active().exchanging = false;
    active().exchangeIds = [];
    mode = nextMode;
    find('mode').value = mode;
    wordInput.value = active().word;
    find('orientation').value = active().orientation;
    preview = null;
    const legal = mode !== 'freeform';
    find('word-controls').hidden = !legal;
    find('freeform-actions').hidden = legal;
    find('toggle-letter').hidden = legal;
    find('word-metrics').hidden = !legal;
    find('freeform-metrics').hidden = legal;
    find('rack-play').hidden = mode !== 'rack';
    find('rack-setup').hidden = mode !== 'rack';
    find('example').hidden = mode !== 'words';
    find('create-board').textContent = mode === 'rack' ? 'New puzzle' : 'Create empty board';
    find('board-help').textContent = legal
      ? 'Tap a starting cell. Arrow keys move selection; Enter or Space previews only. Use Commit word to accept. Swipe or scroll to pan.'
      : 'Diagnostic lab: tap to toggle A. Arrow keys select; Enter or Space toggles. Claims are manual. This session is separate from legal play.';
    syncSetup();
    render(`${find('mode').selectedOptions[0].textContent} resumed. Each mode keeps its own board and progress.`);
  }
  find('mode').addEventListener('change', () => changeMode(find('mode').value));
  find('word-form').addEventListener('submit', (event) => { event.preventDefault(); updatePreview(); });
  wordInput.addEventListener('input', updatePreview);
  find('orientation').addEventListener('change', updatePreview);
  find('clear-preview').addEventListener('click', () => { preview = null; render('Preview cleared. No letters or claims changed.'); });
  find('commit-word').addEventListener('click', () => {
    if (mode === 'freeform' || active().exchanging || !preview) return;
    const result = mode === 'rack' ? commitSessionWord(active().state, proposal(), demoDictionary)
      : commitWord(active().state, proposal(), demoDictionary);
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
    render(`Accepted placement ${puzzle().wordCount}: ${formed}. Claimed ${result.newlyClaimed.length} new cells. +${result.points} territory points.`);
  });
  find('example').addEventListener('click', () => {
    if (mode !== 'words') return;
    reset({ rows: 7, columns: 7 });
    wordInput.value = 'CAR';
    find('orientation').value = 'horizontal';
    updatePreview();
    render('7×7 example ready. CAR is previewed, not committed. Follow the four moves below.');
  });
  find('rack-example').addEventListener('click', () => {
    changeMode('rack');
    reset({ rows: 7, columns: 7 }, createEnclosureSession());
    wordInput.value = 'CAR';
    updatePreview();
    render('Scripted rack QA example ready: CAR previewed, nothing spent. Follow CAR, CAB, RAT, BAT below.');
  });
  find('start-exchange').addEventListener('click', () => {
    if (mode !== 'rack' || active().state.status !== 'playing') return;
    active().exchanging = true;
    active().exchangeIds = [];
    preview = null;
    render('Exchange selection active. Word placement is paused until you confirm or cancel.');
  });
  find('cancel-exchange').addEventListener('click', () => {
    if (mode !== 'rack') return;
    active().exchanging = false;
    active().exchangeIds = [];
    updatePreview();
    render('Exchange cancelled. No tiles moved and no stroke spent.');
  });
  find('confirm-exchange').addEventListener('click', () => {
    if (mode !== 'rack' || !active().exchanging) return;
    const result = exchangeTiles(active().state, active().exchangeIds);
    if (!result.accepted) { render(result.reason.message); return; }
    active().state = result.state;
    active().exchanging = false;
    active().exchangeIds = [];
    preview = null;
    render(`Exchange complete. Returned ${result.returned.map(tileLabel).join(', ')}; drew ${result.replacements.map(tileLabel).join(', ')}. Exchanges ${result.state.exchangeCount}; strokes ${getStrokes(result.state)}.`);
  });
  find('end-run').addEventListener('click', () => {
    if (mode !== 'rack') return;
    const result = endSession(active().state);
    if (!result.accepted) return;
    active().state = result.state;
    active().exchanging = false;
    active().exchangeIds = [];
    preview = null;
    render('Unfinished run ended. Restart or create a new puzzle to play again.');
  });
  find('coordinates').addEventListener('submit', (event) => {
    event.preventDefault();
    const cell = { row: Number(rowInput.value) - 1, column: Number(columnInput.value) - 1 };
    getCellIndex(puzzle().board, cell.row, cell.column);
    select(cell);
  });
  // Unsubmitted coordinate edits must not leave a committable preview of the old cell.
  for (const input of [rowInput, columnInput]) input.addEventListener('input', () => {
    preview = null;
    find('commit-word').disabled = true;
    find('placement-feedback').textContent = 'Select cell to apply these coordinates, then preview.';
    find('placement-feedback').dataset.legality = '';
    find('formed-words').replaceChildren();
    find('rack-feedback').textContent = '';
    if (mode === 'rack') renderRack();
    const { selected, recentClaims } = active();
    const { board, territory } = puzzle();
    drawBoard(canvas, { board, territory, selected, recentClaims, cellSize,
      evaluation: evaluateTerritory(board, territory),
      startingSquare: mode !== 'freeform' ? getStartingSquare(board) : null });
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
    const dimensions = { rows: Number(find('rows').value), columns: Number(find('columns').value) };
    try {
      const rackState = mode === 'rack' ? createSession({ ...dimensions, seed: find('seed').value, target: Number(find('target').value) }) : null;
      reset(dimensions, rackState);
    } catch (error) { render(error.message); }
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
    const cell = pointerToCell(canvas, puzzle().board, cellSize, event.clientX, event.clientY);
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
      const { selected } = active();
      const { board } = puzzle();
      select({ row: Math.max(0, Math.min(board.rows - 1, selected.row + dr)),
        column: Math.max(0, Math.min(board.columns - 1, selected.column + dc)) });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) mode === 'freeform' ? toggleSelected() : updatePreview();
    }
  });
  find('vocabulary').textContent = DEMO_WORDS.join(', ');
  window.addEventListener('resize', () => render());
  changeMode('rack');
  render('Rack-limited puzzle ready. Enter a word using your rack, select its start and preview.');
}
