import { createBoard } from './core/board.js';

// Application boundary: create model state and present its status through the DOM.
// Future input will request core transitions, then refresh DOM/Canvas views.
const board = createBoard();
const boardSummary = document.querySelector('#board-summary');

boardSummary.textContent = `${board.rows} rows × ${board.columns} columns · Empty board initialized`;
