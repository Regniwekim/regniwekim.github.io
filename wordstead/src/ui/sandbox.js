import { createBoard, getCellIndex } from '../core/board.js';
import { isLetterCell, setLetter } from '../core/letters.js';
import { createTerritory, evaluateTerritory, claimTerritory, getTerritoryScore } from '../core/territory.js';
import { drawBoard, pointerToCell, revealSelection } from '../rendering/board.js';

/** Development-only arbitrary occupancy editor. No word legality is implied. */
export function initializeSandbox() {
  const find = (id) => document.getElementById(id);
  const canvas = find('board');
  const viewport = find('board-viewport');
  const rowInput = find('cell-row');
  const columnInput = find('cell-column');
  let board = createBoard();
  let territory = createTerritory(board);
  let evaluation = evaluateTerritory(board, territory);
  let recentClaims = [];
  let selected = { row: 0, column: 0 };
  let cellSize = Number(find('cell-size').value);

  function render(message) {
    evaluation = evaluateTerritory(board, territory);
    drawBoard(canvas, { board, territory, evaluation, recentClaims, selected, cellSize });
    find('territory-score').textContent = getTerritoryScore(territory);
    find('enclosed-count').textContent = evaluation.enclosed.length;
    find('claimable-count').textContent = evaluation.newlyClaimed.length;
    find('board-summary').textContent = `${board.rows} rows × ${board.columns} columns · ${cellSize}px cells`;
    rowInput.max = board.rows;
    columnInput.max = board.columns;
    rowInput.value = selected.row + 1;
    columnInput.value = selected.column + 1;
    const index = getCellIndex(board, selected.row, selected.column);
    const cell = board.cells[index];
    const status = isLetterCell(cell) ? `letter ${cell.letter}${territory.claimed[index] ? ', previously claimed underneath' : ''}`
      : territory.claimed[index] ? `${recentClaims.includes(index) ? 'newly' : 'previously'} claimed land${evaluation.exterior.includes(index) ? ', now exterior' : ''}`
        : evaluation.enclosed.includes(index) ? 'enclosed, unclaimed land' : 'exterior land';
    find('selection-status').textContent = `Row ${selected.row + 1}, column ${selected.column + 1}: ${status}.`;
    if (message) find('action-status').textContent = message;
  }

  function toggleSelected() {
    const cell = board.cells[getCellIndex(board, selected.row, selected.column)];
    const removing = isLetterCell(cell);
    board = setLetter(board, selected.row, selected.column, removing ? null : 'A');
    recentClaims = [];
    render();
    find('action-status').textContent = `${removing ? 'Removed letter from' : 'Placed test letter A at'} row ${selected.row + 1}, column ${selected.column + 1}. ${evaluation.points} unclaimed enclosed cells.`;
  }

  function reset(nextBoard = createBoard({ rows: board.rows, columns: board.columns })) {
    board = nextBoard;
    territory = createTerritory(board);
    recentClaims = [];
    selected = { row: 0, column: 0 };
    find('rows').value = board.rows;
    find('columns').value = board.columns;
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
    render('Empty board ready. Score and all claims reset.');
  }

  find('coordinates').addEventListener('submit', (event) => {
    event.preventDefault();
    selected = { row: Number(rowInput.value) - 1, column: Number(columnInput.value) - 1 };
    getCellIndex(board, selected.row, selected.column);
    render('Cell selected. Use Toggle selected letter to edit it.');
    revealSelection(viewport, selected, cellSize);
  });
  find('toggle-letter').addEventListener('click', toggleSelected);
  find('inspect').addEventListener('click', () => {
    render();
    find('action-status').textContent = `${evaluation.enclosed.length} enclosed cells; ${evaluation.points} points available to claim.`;
  });
  find('claim').addEventListener('click', () => {
    const result = claimTerritory(board, territory);
    territory = result.territory;
    recentClaims = result.newlyClaimed;
    render(`Claimed ${result.newlyClaimed.length} new cells. +${result.points} territory points. Total ${result.totalPoints}.`);
  });
  find('reset').addEventListener('click', () => reset());
  find('dimensions').addEventListener('submit', (event) => {
    event.preventDefault();
    reset(createBoard({ rows: Number(find('rows').value), columns: Number(find('columns').value) }));
  });
  find('cell-size').addEventListener('change', () => {
    cellSize = Number(find('cell-size').value);
    render('Cell display size changed.');
    revealSelection(viewport, selected, cellSize);
  });

  // A tap toggles once. Scrolling/panning gestures must never place a tile.
  let press = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.isPrimary && event.button === 0) {
      press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  });
  canvas.addEventListener('pointercancel', () => { press = null; });
  canvas.addEventListener('pointerup', (event) => {
    const start = press;
    press = null;
    if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
    const cell = pointerToCell(canvas, board, cellSize, event.clientX, event.clientY);
    if (!cell) return;
    selected = cell;
    canvas.focus({ preventScroll: true });
    toggleSelected();
  });
  canvas.addEventListener('keydown', (event) => {
    const movements = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (movements[event.key]) {
      event.preventDefault();
      const [row, column] = movements[event.key];
      selected = {
        row: Math.max(0, Math.min(board.rows - 1, selected.row + row)),
        column: Math.max(0, Math.min(board.columns - 1, selected.column + column)),
      };
      render();
      revealSelection(viewport, selected, cellSize);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) toggleSelected();
    }
  });
  window.addEventListener('resize', () => render());
  render('Sandbox ready. Tap a cell to toggle a test letter, or use the coordinate controls.');
}
