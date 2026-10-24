import { getCellIndex } from '../core/board.js';
import { isLetterCell, setLetter } from '../core/letters.js';
import { evaluateTerritory, claimTerritory, getTerritoryScore } from '../core/territory.js';
import { evaluatePlacement, getStartingSquare } from '../core/placement.js';
import { createPuzzle, commitWord } from '../core/puzzle.js';
import { evaluateExchange,
  exchangeTiles, endSession, getStrokes, getRackCapacity, getExchangeCredits, getChargedExchanges } from '../core/session.js';
import { getPuzzleScore, isFeatureCell, FEATURE_TYPES, summarizeFeatures } from '../core/features.js';
import { MAX_RACK_CAPACITY } from '../core/bag.js';
import { DEFAULT_FARM_SEED, DEFAULT_FARM_DENSITY } from '../core/farm-layout.js';
import { createFarmSession } from '../core/farm-fixture.js';
import { createDraft, evaluateDraft, commitSessionDraft, undoDraft } from '../core/draft.js';
import { createEnclosureSession } from '../core/session-fixture.js';
import { demoDictionary } from '../core/demo-vocabulary.js';
import { drawBoard, pointerToCell, revealSelection } from '../rendering/board.js';
import { initializeTileInput } from './tile-input.js';
import { renderRackSlots } from './rack.js';
import { initializeResults } from './results.js';
import { createTargetSession, restartTargetSession } from '../analysis/target-session.js';
import { initializeTargetSetup } from './target-setup.js';
import { createDailyMode } from './daily-mode.js';
import { restartDailySession } from '../daily/challenge.js';
import { createSave, appendAction, withDraft, wordAction, hasProgress } from '../persistence/history.js';
import { createSaveSlot } from '../persistence/storage.js';
import { initializeSaveControls } from './save-controls.js';
import { initializeHistory } from './history.js';
import { initializeFeedback, commitmentFeedback } from './feedback.js';

/** Four isolated in-memory sessions, one shared renderer and input surface. */
export function initializeSandbox({ dictionary, vocabulary, now, getStorage = () => window.localStorage,
  saveToken = () => crypto.randomUUID(), saveKeyPrefix = '', feedbackFactory = initializeFeedback }) {
  if (typeof dictionary?.has !== 'function') throw new TypeError('Load the gameplay vocabulary before initialization.');
  const find = (id) => document.getElementById(id);
  const resultsView = initializeResults({ find });
  const saveView = initializeSaveControls({ find });
  const slots = Object.fromEntries(['daily', 'free'].map((key) => [key,
    createSaveSlot({ mode: key, dictionary, getStorage, token: saveToken, keyPrefix: saveKeyPrefix })]));
  const restored = { daily: slots.daily.load(), free: slots.free.load() };
  const canvas = find('board');
  const viewport = find('board-viewport');
  const rowInput = find('cell-row');
  const columnInput = find('cell-column');
  const wordInput = find('word');
  function session(dimensions, rackState = null, qa = false) {
    const state = rackState ?? createPuzzle(dimensions);
    const board = rackState ? state.puzzle.board : state.board;
    return { state, selected: getStartingSquare(board), recentClaims: [], latestAward: 0,
      word: '', orientation: 'horizontal', exchanging: false, exchangeIds: [], draft: createDraft(),
      dictionary: qa ? demoDictionary : dictionary, vocabularyName: qa ? 'Hand-selected demo · QA fixture only' : vocabulary.name,
      save: rackState?.source === 'seeded' ? createSave(rackState.daily ? 'daily' : 'free', rackState) : null };
  }
  function recovered(result) {
    return { ...session(null, result.state), draft: result.draft, save: result.save };
  }
  const sessions = { rack: restored.free ? recovered(restored.free)
    : session(null, createTargetSession({ farmSeed: DEFAULT_FARM_SEED }).session), words: session(), freeform: session() };
  let productionRack = sessions.rack;
  const dailyMode = createDailyMode({ now });
  const historyView = initializeHistory({ find, getStorage, keyPrefix: saveKeyPrefix,
    today: dailyMode.today, confirm: saveView.confirm });
  let dailyResult = restored.daily ? { available: true, session: restored.daily.state } : dailyMode.startToday();
  sessions.daily = restored.daily ? recovered(restored.daily) : dailyResult.available ? session(null, dailyResult.session) : null;
  for (const [key, run] of [['daily', sessions.daily], ['free', sessions.rack]]) {
    if (!restored[key] && run) slots[key].write(run.save);
  }
  let mode = 'rack';
  const isRackMode = () => mode === 'rack' || mode === 'daily';
  const targetSetup = initializeTargetSetup({ find, isRackMode: () => mode === 'rack' });
  let preview = null;
  let boardView = null;
  let cellSize = Number(find('cell-size').value);
  const active = () => sessions[mode];
  const activeSlot = () => isRackMode() ? slots[mode === 'daily' ? 'daily' : 'free'] : null;
  function persist(action) {
    const current = active();
    // Observe only accepted production actions, independently of active-save success.
    if (action && mode === 'daily') historyView.capture(current.state);
    if (!isRackMode() || !current?.save) return;
    if (action) current.save = appendAction(current.save, action);
    current.save = withDraft(current.save, current.draft);
    activeSlot().write(current.save);
  }
  function replaceRun(message, label, action, savedRack = false) {
    const current = savedRack && mode === 'rack' && !active()?.save ? productionRack : active();
    if (isRackMode() && current && hasProgress(current.state, current.draft)) {
      saveView.confirm(message, label, action);
    } else action();
  }
  const puzzle = () => isRackMode() ? active().state.puzzle : active().state;
  const proposal = () => ({
    word: wordInput.value, ...active().selected, orientation: find('orientation').value,
  });

  const rackButtons = Array.from({ length: MAX_RACK_CAPACITY }, (_, slot) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rack-tile';
    button.addEventListener('click', () => {
      if (!isRackMode() || !active().exchanging || active().state.status !== 'playing') return;
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
  const feedback = feedbackFactory({ find, getView: () => boardView, rackButtons, getStorage });
  const tileInput = initializeTileInput({ canvas, viewport, rackButtons,
    feedback: (event) => feedback.emit(event),
    enabled: () => isRackMode() && Boolean(active()) && !active().exchanging && active().state.status === 'playing',
    getState: () => active().state, getDraft: () => active().draft,
    setDraft: (draft) => {
      if (draft === active().draft) return;
      active().draft = draft;
      persist();
    }, getCellSize: () => cellSize,
    selectCell: (cell) => { active().selected = cell; },
    refresh: (message) => { if (isRackMode()) updatePreview(message); else render(message); },
    redraw: () => {
      if (boardView) drawBoard(canvas, { ...boardView, drop: tileInput.drop, selectedTileId: tileInput.selected?.tileId });
    } });

  function renderRack() {
    const { state, exchanging, exchangeIds } = active();
    const score = getPuzzleScore(state.puzzle).totalPoints;
    const capacity = getRackCapacity(state);
    const credits = getExchangeCredits(state);
    find('goal-label').textContent = `Farm points: ${score} / ${state.target}`;
    find('goal-progress').max = state.target;
    find('goal-progress').value = score;
    find('rack-count').textContent = `${state.rack.length} / ${capacity}`;
    find('free-credits').textContent = credits;
    find('charged-exchanges').textContent = getChargedExchanges(state);
    find('bag-count').textContent = state.bag.length;
    find('exchange-count').textContent = state.exchangeCount;
    find('strokes').textContent = getStrokes(state);
    find('run-info').textContent = state.daily
      ? `Daily Puzzle · ${state.daily.date} · ${state.daily.formatVersion} · Automatic target · Experimental.`
      : state.source === 'scripted'
      ? `Scripted ${state.farmFixture ? FEATURE_TYPES[state.farmFixture].label + ' farm' : 'rack'} QA fixture · full standard bag in a controlled order · restart repeats this fixture.`
      : `Letter seed: ${state.seed} · Farm seed: ${state.farm?.seed ?? 'none'} · density: ${state.farm?.density ?? 0}. Seeds are independent. ${state.targetSelection?.mode === 'automatic' ? 'Automatic target · Experimental.' : 'Manual target.'}`;
    const metrics = `${state.puzzle.wordCount} accepted words, ${state.exchangeCount} exchanges.`;
    find('run-status').textContent = state.status === 'won' ? `Harvest Complete! ${score} / ${state.target} farm points. ${metrics} Results are over the board; collapse the window to inspect your farm.`
      : state.status === 'ended' ? `Farm Unfinished. ${score} / ${state.target} farm points. ${metrics} Results are over the board; collapse the window to inspect your farm.`
        : state.status === 'exhausted' ? `Out of Tiles: rack and bag empty. ${score} / ${state.target} farm points. ${metrics} Results are over the board; collapse the window to inspect your farm.`
          : '';
    const used = new Set(active().draft.tiles.map((tile) => tile.tileId));
    renderRackSlots(find('rack'), rackButtons, { state, draft: active().draft,
      selectedTileId: tileInput.selected?.tileId, exchanging, exchangeIds });
    find('start-exchange').hidden = exchanging;
    find('start-exchange').disabled = state.status !== 'playing' || !state.rack.length || !state.bag.length || used.size > 0;
    find('confirm-exchange').hidden = !exchanging;
    find('cancel-exchange').hidden = !exchanging;
    find('cancel-exchange').disabled = state.status !== 'playing';
    const check = evaluateExchange(state, exchangeIds);
    find('confirm-exchange').disabled = !check.legal;
    find('end-run').disabled = state.status !== 'playing';
    find('exchange-feedback').textContent = exchanging
      ? `${exchangeIds.length} selected · ${state.bag.length} in bag. ${check.legal ? credits > 0 ? 'Confirm to use one free exchange credit; no stroke charged.' : 'Confirm to draw replacements; costs one stroke.' : check.reason.message}`
      : used.size ? 'Return or clear all draft tiles before exchanging.'
        : state.status === 'playing' && !state.bag.length ? 'Bag empty. You may still play useful rack tiles or end this run. No complete legal-move solver is implemented.' : '';
    find('undo-draft').disabled = !used.size || state.status !== 'playing' || exchanging;
    find('clear-draft').disabled = !used.size || state.status !== 'playing' || exchanging;
  }

  function render(message) {
    find('play-daily').setAttribute('aria-pressed', String(mode === 'daily'));
    find('play-free').setAttribute('aria-pressed', String(mode === 'rack'));
    find('board-title').textContent = mode === 'daily' ? 'Daily Puzzle' : mode === 'rack'
      ? active()?.state.source === 'scripted' ? 'Free Play · QA fixture' : 'Free Play'
      : mode === 'words' ? 'Legal word placement lab' : 'Freeform enclosure lab';
    find('setup-panel').hidden = mode === 'daily';
    find('view-title').textContent = mode === 'rack' ? 'Free Play settings' : 'Lab board settings';
    find('economy-metrics').hidden = !isRackMode();
    find('end-run').hidden = !isRackMode();
    historyView.render(mode === 'daily' ? active()?.state : null);
    saveView.render(activeSlot(), isRackMode() && Boolean(active()) && !active().save);
    find('daily-context').hidden = mode !== 'daily';
    find('play-surface').hidden = !active();
    if (mode === 'daily') {
      const today = dailyMode.today();
      const date = active()?.state.daily.date;
      find('daily-info').textContent = date
        ? `Active challenge: ${date} · UTC. ${date !== today ? `Resuming your previous challenge. Today's challenge (${today}) is available. Start today's challenge replaces this Daily save and discards its progress.` : 'Today’s farm.'}`
        : `Daily Puzzle unavailable for ${today}. ${dailyResult.message} Free Play and the labs are still available.`;
      find('start-today').disabled = date === today;
      find('start-today').hidden = date === today;
      if (date && !dailyResult.available) find('daily-info').textContent += ` New challenge unavailable: ${dailyResult.message}`;
    }
    if (!active()) { resultsView.render(null); return; }
    find('vocabulary-note').textContent = `${active().vocabularyName}. English word list; not an official Scrabble dictionary. Credits and acceptance policy are linked in the footer.`;
    const { selected, recentClaims, latestAward, exchanging } = active();
    const { board, territory, wordCount } = puzzle();
    const evaluation = evaluateTerritory(board, territory);
    const previewTerritory = preview?.legal ? evaluateTerritory(preview.proposedBoard, territory) : null;
    const startingSquare = mode !== 'freeform' ? getStartingSquare(board) : null;
    boardView = { board, territory, evaluation, recentClaims, selected, cellSize,
      preview, previewTerritory, startingSquare, draft: isRackMode() ? active().draft : null,
      selectedTileId: isRackMode() ? tileInput.selected?.tileId : null, drop: isRackMode() ? tileInput.drop : null };
    drawBoard(canvas, boardView);
    find('territory-score').textContent = getTerritoryScore(territory);
    const score = getPuzzleScore(puzzle());
    find('farm-score').textContent = score.bonusPoints;
    find('farm-score').title = `${score.cropPoints} crop points + ${score.fertilityPoints} fertility points`;
    find('farm-metric').hidden = !isRackMode();
    find('word-count').textContent = wordCount;
    find('latest-award').textContent = `+${latestAward}`;
    find('enclosed-count').textContent = evaluation.enclosed.length;
    find('claimable-count').textContent = evaluation.newlyClaimed.length;
    find('board-summary').textContent = `${board.rows} rows × ${board.columns} columns · ${cellSize}px cells`;
    find('starting-square').textContent = startingSquare
      ? wordCount ? 'Connect your next word to the fence.' : `First word: cross ☆ at row ${startingSquare.row + 1}, column ${startingSquare.column + 1}.`
      : 'Freeform diagnostic edits do not follow word rules.';
    rowInput.max = board.rows;
    columnInput.max = board.columns;
    rowInput.value = selected.row + 1;
    columnInput.value = selected.column + 1;
    const index = getCellIndex(board, selected.row, selected.column);
    const cell = board.cells[index];
    const drafted = isRackMode() && active().draft.tiles.find((tile) => tile.row === selected.row && tile.column === selected.column);
    const status = drafted ? `draft letter ${drafted.letter}, physical tile ${drafted.tileId}${drafted.assignedLetter ? ', assigned blank' : ''}`
      : isFeatureCell(cell) ? `${FEATURE_TYPES[cell.type].label}, ${territory.claimed[index] ? 'captured; capture bonus already activated' : 'uncaptured; bonus not yet activated'}. ${FEATURE_TYPES[cell.type].effect} Reserved for this feature; letters cannot be placed here`
      : isLetterCell(cell) ? `committed letter ${cell.letter}${cell.blank ? ', assigned blank' : ''}${territory.claimed[index] ? ', previously claimed underneath' : ''}`
      : territory.claimed[index] ? `${recentClaims.includes(index) ? 'newly' : 'previously'} claimed land${evaluation.exterior.includes(index) ? ', now exterior' : ''}`
        : evaluation.enclosed.includes(index) ? 'enclosed, unclaimed land' : 'exterior land';
    find('selection-status').textContent = `Row ${selected.row + 1}, column ${selected.column + 1}: ${status}.`;
    canvas.setAttribute('aria-label', `Interactive letter fence board. Row ${selected.row + 1}, column ${selected.column + 1}: ${status}.`);
    for (const control of find('word-controls').querySelectorAll('input, select, button')) {
      control.disabled = exchanging || (isRackMode() && active().state.status !== 'playing');
    }
    // A nonempty draft can be explicitly checked even when its preview is invalid.
    // Only the existing atomic commit transition may accept or reject it.
    find('commit-word').disabled = mode === 'freeform' || exchanging || !preview
      || (isRackMode() && (active().state.status !== 'playing' || !active().draft.tiles.length));
    find('placement-feedback').textContent = preview
      ? preview.legal
        ? `Valid preview · ${preview.words.map((run) => run.text).join(', ')}. Ready to commit: +${previewTerritory.points + summarizeFeatures(board, previewTerritory.newlyClaimed).bonusPoints} farm points from ${previewTerritory.points} enclosed cells.`
        : `${isRackMode() ? 'Draft not ready' : 'Invalid preview'}: ${preview.reason.message}`
      : isRackMode() ? active().state.status !== 'playing' ? 'Run finished. Restart or create a new puzzle.'
        : 'Select a tile, then choose a board cell.'
        : 'No preview. Enter a word and choose a starting cell, then preview.';
    find('draft-direction').textContent = isRackMode() && preview
      ? `Draft direction: ${preview.structural.orientation ?? 'undecided (one tile)'}. ${preview.structural.coherent ? 'Straight and contiguous.' : preview.structural.reason.message}${preview.reason ? ` Diagnostic: ${preview.reason.code}.` : ''}` : '';
    find('placement-feedback').dataset.legality = preview ? (preview.legal ? 'valid' : 'invalid') : '';
    find('formed-words').replaceChildren(...(preview?.words ?? []).map((run) => {
      const item = document.createElement('li');
      const first = run.positions[0];
      item.textContent = `${run.text} · ${run.orientation} · (${first.row + 1}, ${first.column + 1}) · ${run.valid ? 'in vocabulary' : 'unknown'}`;
      return item;
    }));
    find('rack-feedback').textContent = isRackMode() && preview
      ? !preview.structural.coherent
        ? `${active().draft.tiles.length} draft tiles remain in their original rack slots. Repair the draft to evaluate the completed word. Nothing spent.`
        : `Spend: ${preview.rack.allocations.map(({ letter, blank, row, column }) => `${blank ? `blank → ${letter}` : letter} at (${row + 1}, ${column + 1})`).join(', ') || 'none'}. Reuse from board (free): ${preview.reusedPositions.map(({ letter, row, column }) => `${letter} at (${row + 1}, ${column + 1})`).join(', ') || 'none'}. Missing: ${preview.rack.missingLetters.map(({ letter, count }) => `${letter} ×${count}`).join(', ') || 'none'}. Preview spends nothing.` : '';
    if (isRackMode()) renderRack();
    resultsView.render(isRackMode() ? active().state : null);
    tileInput.render();
    if (message) find('action-status').textContent = message;
  }

  function updatePreview(message) {
    preview = mode === 'freeform' || active().exchanging ? null : isRackMode()
      ? active().draft.tiles.length ? evaluateDraft(active().state, active().draft, active().dictionary) : null
      : evaluatePlacement(puzzle().board, proposal(), active().dictionary);
    render(typeof message === 'string' ? message : undefined);
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

  function reset(dimensions = puzzle().board, rackState = null, qa = active().dictionary === demoDictionary) {
    feedback.cancel();
    tileInput.reset();
    if (isRackMode() && !rackState) {
      const current = active().state;
      rackState = mode === 'daily' ? restartDailySession(current) : current.farmFixture ? createFarmSession(current.farmFixture)
        : current.source === 'scripted' ? createEnclosureSession()
          : restartTargetSession(current);
    }
    sessions[mode] = session({ rows: dimensions.rows, columns: dimensions.columns }, rackState, qa);
    if (mode === 'rack' && sessions.rack.save) productionRack = sessions.rack;
    persist();
    preview = null;
    wordInput.value = '';
    find('orientation').value = 'horizontal';
    syncSetup();
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
    render(isRackMode() ? 'Puzzle ready. Fresh rack drawn; counts and progress reset. Restart repeats its letter order.'
      : 'Empty board ready. Letters, claims, awards and word count reset for this mode.');
    revealSelection(viewport, active().selected, cellSize);
  }

  function syncSetup() {
    const daily = mode === 'daily';
    find('dimensions').hidden = daily;
    find('setup-help').hidden = daily;
    if (daily) {
      for (const control of find('dimensions').querySelectorAll('input, select, button')) control.disabled = true;
      return;
    }
    for (const control of find('dimensions').querySelectorAll('input, select, button')) control.disabled = false;
    find('rows').value = puzzle().board.rows;
    find('columns').value = puzzle().board.columns;
    find('seed').required = isRackMode();
    find('seed').disabled = !isRackMode();
    find('target-mode').disabled = !isRackMode();
    for (const id of ['farm-seed', 'farm-density']) {
      find(id).disabled = !isRackMode();
      find(id).required = isRackMode();
    }
    if (isRackMode()) {
      find('seed').value = active().state.seed;
      find('target').value = active().state.target;
      find('farm-seed').value = active().state.farm?.seed ?? DEFAULT_FARM_SEED;
      find('farm-density').value = active().state.farm?.density ?? DEFAULT_FARM_DENSITY;
      find('target-mode').value = active().state.targetSelection?.mode ?? 'manual';
    }
    targetSetup.invalidate();
  }

  function changeMode(nextMode) {
    feedback.cancel();
    tileInput.reset();
    if (active()) {
      active().word = wordInput.value;
      active().orientation = find('orientation').value;
      active().exchanging = false;
      active().exchangeIds = [];
    }
    mode = nextMode;
    find('mode').value = mode;
    if (!isRackMode()) find('development-tools').open = true;
    if (!active()) { preview = null; render(); return; }
    wordInput.value = active().word;
    find('orientation').value = active().orientation;
    preview = null;
    const legal = mode !== 'freeform';
    find('word-controls').hidden = !legal;
    find('word-form').hidden = mode !== 'words';
    find('clear-preview').hidden = mode !== 'words';
    find('rack-controls').hidden = !isRackMode();
    find('rack-context').hidden = !isRackMode();
    find('word-title').textContent = isRackMode() ? 'Your rack' : 'Place a word';
    find('draft-actions').hidden = !isRackMode();
    find('freeform-actions').hidden = legal;
    find('toggle-letter').hidden = legal;
    find('word-metrics').hidden = !legal;
    find('freeform-metrics').hidden = legal;
    find('rack-play').hidden = !isRackMode();
    find('rack-setup').hidden = !isRackMode();
    find('example').hidden = mode !== 'words';
    find('create-board').textContent = isRackMode() ? 'New Puzzle' : 'Create empty board';
    find('board-help').textContent = isRackMode()
      ? 'Select a rack tile, then tap an empty cell or use board arrows and Enter/Space. Tap a draft tile to move it. Drag from rack or draft tiles; swipe empty or committed cells to pan. Escape cancels selection.' : legal
      ? 'Tap a starting cell. Arrow keys move selection; Enter or Space previews only. Use Commit word to accept. Swipe or scroll to pan.'
      : 'Diagnostic lab: tap to toggle A. Arrow keys select; Enter or Space toggles. Claims are manual. This session is separate from legal play.';
    syncSetup();
    if (isRackMode()) updatePreview();
    render(`${find('mode').selectedOptions[0].textContent} resumed. Each mode keeps its own board and progress.`);
  }
  find('daily-free-play').addEventListener('click', () => changeMode('rack'));
  find('play-daily').addEventListener('click', () => changeMode('daily'));
  find('play-free').addEventListener('click', () => changeMode('rack'));
  find('open-help').addEventListener('click', (event) => {
    event.preventDefault();
    find('how-to-play').open = true;
    find('help-summary').focus();
    find('how-to-play').scrollIntoView({ block: 'start' });
  });
  find('new-puzzle-link').addEventListener('click', (event) => {
    event.preventDefault();
    find('setup-panel').open = true;
    find('view-title').focus();
    find('setup-panel').scrollIntoView({ block: 'start' });
  });
  find('start-today').addEventListener('click', () => {
    if (mode !== 'daily' || active()?.state.daily.date === dailyMode.today()) return;
    replaceRun('Start today’s challenge? This replaces the single Daily save and discards the active challenge’s progress.', 'Start today’s challenge', () => {
      dailyResult = dailyMode.startToday();
      if (dailyResult.available) {
        tileInput.reset();
        sessions.daily = session(null, dailyResult.session);
        persist();
        preview = null;
        viewport.scrollTop = 0;
        viewport.scrollLeft = 0;
        changeMode('daily');
      } else render();
    });
  });
  find('mode').addEventListener('change', () => changeMode(find('mode').value));
  find('word-form').addEventListener('submit', (event) => { event.preventDefault(); updatePreview(); });
  wordInput.addEventListener('input', updatePreview);
  find('orientation').addEventListener('change', updatePreview);
  find('clear-preview').addEventListener('click', () => { preview = null; render('Preview cleared. No letters or claims changed.'); });
  find('commit-word').addEventListener('click', () => {
    if (mode === 'freeform' || active().exchanging || !preview) return;
    const previousStatus = active().state.status;
    const result = isRackMode() ? commitSessionDraft(active().state, active().draft, active().dictionary)
      : commitWord(active().state, proposal(), active().dictionary);
    if (!result.accepted) {
      preview = result.evaluation;
      render(`Placement rejected: ${result.evaluation.reason.message}`);
      feedback.emit(commitmentFeedback(result, previousStatus));
      return;
    }
    active().state = result.state;
    if (isRackMode()) { active().draft = result.draft; tileInput.reset(); persist(wordAction(result)); }
    active().recentClaims = result.newlyClaimed;
    active().latestAward = result.points;
    preview = null;
    const formed = result.evaluation.words.map((run) => run.text).join(', ');
    wordInput.value = '';
    const rewards = result.farmRewards;
    const captured = rewards?.features.map(({ type }) => FEATURE_TYPES[type].label).join(', ');
    const farmMessage = captured ? ` Captured: ${captured}. +${rewards.cropPoints} crop points, +${rewards.fertilityPoints} fertility points; rack capacity +${rewards.rackCapacityGained}; free exchange credits +${rewards.buildings}.` : '';
    render(`Accepted placement ${puzzle().wordCount}: ${formed}. Claimed ${result.newlyClaimed.length} new cells. +${result.points} total points.${farmMessage}`);
    feedback.emit(commitmentFeedback(result, previousStatus));
  });
  find('example').addEventListener('click', () => {
    if (mode !== 'words') return;
    reset({ rows: 7, columns: 7 }, null, true);
    wordInput.value = 'CAR';
    find('orientation').value = 'horizontal';
    updatePreview();
    render('7×7 example ready. CAR is previewed, not committed. Follow the four moves below.');
  });
  find('rack-example').addEventListener('click', () => {
    changeMode('rack');
    reset({ rows: 7, columns: 7 }, createEnclosureSession(), true);
    render('Scripted rack QA example ready. Place C, A, R in row 4, columns 4–6, then commit. Follow CAR, CAB, RAT, BAT below.');
  });
  find('farm-example').addEventListener('click', () => {
    const type = find('farm-example-type').value;
    changeMode('rack');
    reset({ rows: 7, columns: 7 }, createFarmSession(type), true);
    render(`${FEATURE_TYPES[type].label} farm QA ready at (5, 5). Build CAR, CAB, RAT, BAT using rack tiles. ${FEATURE_TYPES[type].effect}`);
  });
  find('start-exchange').addEventListener('click', () => {
    if (!isRackMode() || active().state.status !== 'playing' || active().draft.tiles.length) return;
    tileInput.reset();
    active().exchanging = true;
    active().exchangeIds = [];
    preview = null;
    render('Exchange selection active. Word placement is paused until you confirm or cancel.');
  });
  find('cancel-exchange').addEventListener('click', () => {
    if (!isRackMode()) return;
    active().exchanging = false;
    active().exchangeIds = [];
    updatePreview();
    render('Exchange cancelled. No tiles moved and no stroke spent.');
  });
  find('confirm-exchange').addEventListener('click', () => {
    if (!isRackMode() || !active().exchanging) return;
    const result = exchangeTiles(active().state, active().exchangeIds);
    if (!result.accepted) { render(result.reason.message); return; }
    const exchangedSlots = active().state.rack.flatMap((tile, slot) => active().exchangeIds.includes(tile.id) ? [slot] : []);
    active().state = result.state;
    persist({ type: 'exchange', tileIds: [...active().exchangeIds] });
    active().exchanging = false;
    active().exchangeIds = [];
    preview = null;
    render(`Exchange complete. Returned ${result.returned.map(tileLabel).join(', ')}; drew ${result.replacements.map(tileLabel).join(', ')}. ${result.freeExchange ? 'Used one free exchange credit; no stroke charged.' : 'Charged one stroke.'} Exchanges ${result.state.exchangeCount}; strokes ${getStrokes(result.state)}.`);
    feedback.emit({ type: 'tiles-exchanged', slots: exchangedSlots });
  });
  find('end-run').addEventListener('click', () => {
    if (!isRackMode()) return;
    const result = endSession(active().state);
    if (!result.accepted) return;
    active().state = result.state;
    active().draft = createDraft();
    persist({ type: 'end' });
    tileInput.reset();
    active().exchanging = false;
    active().exchangeIds = [];
    preview = null;
    render('Unfinished run ended. Restart or create a new puzzle to play again.');
    feedback.emit({ type: 'run-ended' });
  });
  find('undo-draft').addEventListener('click', () => {
    if (!isRackMode() || active().exchanging || active().state.status !== 'playing') return;
    const returnedId = active().draft.tiles.at(-1)?.tileId;
    tileInput.reset();
    active().draft = undoDraft(active().draft);
    persist();
    updatePreview();
    render('Most recently placed or moved tile returned to its original rack slot.');
    if (returnedId !== undefined) feedback.emit({ type: 'tile-returned', slots: [active().state.rack.findIndex((tile) => tile.id === returnedId)] });
  });
  find('clear-draft').addEventListener('click', () => {
    if (!isRackMode() || active().exchanging || active().state.status !== 'playing') return;
    const returnedIds = new Set(active().draft.tiles.map((tile) => tile.tileId));
    tileInput.reset();
    active().draft = createDraft();
    persist();
    updatePreview();
    render('Draft cleared. Every tile remains in its original rack slot; nothing spent.');
    if (returnedIds.size) feedback.emit({ type: 'tile-returned', slots: active().state.rack.flatMap((tile, slot) => returnedIds.has(tile.id) ? [slot] : []) });
  });
  find('coordinates').addEventListener('submit', (event) => {
    event.preventDefault();
    const cell = { row: Number(rowInput.value) - 1, column: Number(columnInput.value) - 1 };
    getCellIndex(puzzle().board, cell.row, cell.column);
    select(cell);
  });
  // Unsubmitted coordinate edits must not leave a committable preview of the old cell.
  for (const input of [rowInput, columnInput]) input.addEventListener('input', () => {
    if (isRackMode()) return; // Coordinates move the cursor, never move an assembled draft.
    preview = null;
    find('commit-word').disabled = true;
    find('placement-feedback').textContent = 'Select cell to apply these coordinates, then preview.';
    find('placement-feedback').dataset.legality = '';
    find('formed-words').replaceChildren();
    find('rack-feedback').textContent = '';
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
  find('reset').addEventListener('click', () => replaceRun('Restart this puzzle? Its saved actions and draft will be discarded. The original farm, tiles and target will repeat.', 'Restart puzzle', () => reset()));
  find('dimensions').addEventListener('submit', (event) => {
    event.preventDefault();
    if (mode === 'daily') return;
    const dimensions = { rows: Number(find('rows').value), columns: Number(find('columns').value) };
    try {
      let rackState = null;
      if (isRackMode()) {
        const configuration = targetSetup.resolve();
        if (!configuration) return;
        const result = createTargetSession(configuration);
        if (!result.available) { targetSetup.calculate(); return; }
        rackState = result.session;
      }
      replaceRun('Create a new Free Play puzzle? This replaces your Free Play save and discards its progress. Daily progress is kept.', 'New Free Play puzzle', () => reset(dimensions, rackState, false), true);
    } catch (error) { render(error.message); }
  });
  find('cell-size').addEventListener('change', () => {
    feedback.cancel();
    cellSize = Number(find('cell-size').value);
    render('Cell display size changed.');
    revealSelection(viewport, active().selected, cellSize);
  });

  // A tap selects (or toggles in the lab); panning never edits or commits.
  let press = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.isPrimary && event.button === 0) press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) press.moved = true;
  });
  canvas.addEventListener('pointercancel', () => { press = null; });
  canvas.addEventListener('pointerup', (event) => {
    const start = press;
    press = null;
    if (!start || start.moved || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
    if (!active()) return;
    const cell = pointerToCell(canvas, puzzle().board, cellSize, event.clientX, event.clientY);
    if (!cell) return;
    select(cell);
    canvas.focus({ preventScroll: true });
    if (mode === 'freeform') toggleSelected();
    else if (isRackMode()) tileInput.activateCell(cell);
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
      if (!event.repeat) {
        if (mode === 'freeform') toggleSelected();
        else if (isRackMode()) tileInput.activateCell(active().selected);
        else updatePreview();
      }
    }
  });
  window.addEventListener('resize', () => {
    feedback.cancel();
    render();
    if (active()) revealSelection(viewport, active().selected, cellSize);
  });
  window.addEventListener('storage', (event) => {
    historyView.changed(event);
    for (const slot of Object.values(slots)) {
      if (event.key === null || event.key === slot.key) slot.changed();
    }
    render();
  });
  find('reload-save').addEventListener('click', () => {
    if (!isRackMode()) return;
    const slot = activeSlot();
    const load = () => {
      if (mode === 'rack' && !active()?.save && slot.info.kind !== 'conflict') {
        sessions.rack = productionRack;
        changeMode(mode);
        return;
      }
      const result = slot.load();
      if (result) {
        sessions[mode] = recovered(result);
        if (mode === 'rack') productionRack = sessions.rack;
      } else if (slot.info.kind === 'empty' && active()?.save) {
        reset();
      } else if (mode === 'rack' && !active()?.save) sessions.rack = productionRack;
      changeMode(mode);
    };
    replaceRun('Reload this mode’s saved version? Unsaved progress in this tab will be discarded.', 'Reload saved version', load);
  });
  find('replace-save').addEventListener('click', () => {
    const slot = activeSlot();
    if (!slot || !active()?.save) return;
    const approval = slot.replacementToken();
    saveView.confirm('Replace the other tab’s saved version with this run? Its saved progress will be discarded. Other tabs will be warned.', 'Replace saved version', () => {
      slot.replace(withDraft(active().save, active().draft), approval);
      render();
    });
  });
  find('discard-save').addEventListener('click', () => {
    const slot = activeSlot();
    if (!slot) return;
    const approval = slot.replacementToken();
    saveView.confirm('Discard this mode’s unusable save? Only this Wordstead save will be removed. The current playable run can then be saved.', 'Discard unusable save', () => {
      if (slot.discard(approval)) persist();
      render();
    });
  });
  changeMode('daily');
  render('Daily Puzzle ready. Select a physical rack tile, then place it on the board.');
  if (active()) revealSelection(viewport, active().selected, cellSize);
}
