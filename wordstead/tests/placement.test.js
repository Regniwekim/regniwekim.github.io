import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, getCell } from '../src/core/board.js';
import { createLetterCell, setLetter } from '../src/core/letters.js';
import { createDictionary, normalizeWord } from '../src/core/dictionary.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { evaluatePlacement, extractAffectedWords, getStartingSquare } from '../src/core/placement.js';
import { freezeBoard } from './fixtures.js';

const dictionary = createDictionary(['CAT', 'CATS', 'CAR', 'CART', 'CARTS', 'CAB', 'RAT', 'BAT', 'AT', 'BAR', 'BE', 'HA', 'AR', 'TOO', 'ON']);
const move = (word = 'CAT', row = 3, column = 3, orientation = 'horizontal') => ({ word, row, column, orientation });
function letters(lines) {
  const board = createBoard({ rows: lines.length, columns: lines[0].length });
  board.cells = lines.join('').split('').map((c) => c === '.' ? null : createLetterCell(c));
  return freezeBoard(board);
}
const evaluate = (board, proposal) => evaluatePlacement(board, proposal, dictionary);
const reason = (board, proposal) => evaluate(board, proposal).reason?.code;

test('ASCII normalization is consistent; rejects Unicode expansions, punctuation and non-text', () => {
  assert.equal(normalizeWord('  cAt  '), 'CAT');
  const local = createDictionary(['cat', ' At ']);
  assert.equal(local.has('cAt'), true);
  assert.equal(local.has(' AT '), true);
  for (const word of ['', ' ', 'C AT', 'C4T', 'CAT!', 'café', 'ß', 'ı', null, 12, {}]) {
    assert.equal(normalizeWord(word), null);
    assert.equal(local.has(word), false);
    assert.equal(reason(createBoard(), move(word)), 'INVALID_WORD');
  }
  assert.throws(() => createDictionary(['CAT', '2']), TypeError);
  assert.equal(evaluate(createBoard({ rows: 7, columns: 7 }), move('cat')).proposal.word, 'CAT');
});

test('dictionary dependency is explicit and must be synchronous boolean membership', () => {
  const board = createBoard({ rows: 7, columns: 7 });
  for (const dependency of [undefined, {}, { has: () => Promise.resolve(true) }, { has: () => 1 }]) {
    assert.throws(() => evaluatePlacement(board, move(), dependency), TypeError);
  }
});

test('horizontal and vertical geometry on a rectangular board preserves input', () => {
  for (const orientation of ['horizontal', 'vertical']) {
    const board = freezeBoard(createBoard({ rows: 5, columns: 7 }));
    const result = evaluate(board, move('CAT', 2, 3, orientation));
    assert.equal(result.legal, true);
    assert.equal(result.newPositions.length, 3);
    assert.deepEqual(result.reusedPositions, []);
    assert.equal(result.words.length, 1);
    assert.equal(result.words[0].text, 'CAT');
    assert.equal(result.words[0].orientation, orientation);
    assert.deepEqual(result.newPositions.map(({ row, column }) => [row, column]), orientation === 'horizontal'
      ? [[2, 3], [2, 4], [2, 5]] : [[2, 3], [3, 3], [4, 3]]);
    assert.ok(board.cells.every((cell) => cell === null));
    assert.notEqual(result.proposedBoard.cells, board.cells);
  }
});

test('bounds reject overflow on all four edges without row wrapping', () => {
  const board = createBoard({ rows: 5, columns: 7 });
  for (const proposal of [move('CAT', -1, 3), move('CAT', 2, -1), move('CAT', 5, 1),
    move('CAT', 2, 7), move('CAT', 2, 5), move('CAT', 3, 3, 'vertical')]) {
    const result = evaluate(board, proposal);
    assert.equal(result.reason.code, 'OUT_OF_BOUNDS');
    assert.equal(result.proposedBoard, null);
    assert.ok(result.positions.some((p) => p.status === 'outside'));
  }
});

test('exact ends at top, bottom, left and right board edges are legal', () => {
  for (const [rows, columns, proposal] of [
    [1, 3, move('CAT', 0, 0)], [3, 1, move('CAT', 0, 0, 'vertical')],
    [3, 5, move('CAT', 1, 0)], [3, 5, move('CAT', 1, 2)],
    [5, 3, move('CAT', 0, 1, 'vertical')], [5, 3, move('CAT', 2, 1, 'vertical')],
  ]) assert.equal(evaluate(createBoard({ rows, columns }), proposal).legal, true);
});

test('invalid orientations and noninteger coordinates give stable rejection codes', () => {
  const board = createBoard();
  for (const orientation of ['diagonal', 'Horizontal', '', null, undefined, 'toString', '__proto__']) {
    assert.equal(reason(board, { word: 'CAT', row: 3, column: 3, orientation }), 'INVALID_ORIENTATION');
  }
  assert.equal(reason(board, { word: 'CAT', row: 1, column: 1 }), 'INVALID_ORIENTATION');
  for (const value of [1.5, NaN, Infinity, '3', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(reason(board, { word: 'CAT', row: value, column: 3, orientation: 'horizontal' }), 'INVALID_COORDINATES');
    assert.equal(reason(board, { word: 'CAT', row: 3, column: value, orientation: 'horizontal' }), 'INVALID_COORDINATES');
  }
});

test('starting square uses lower/right center consistently for odd, even and degenerate shapes', () => {
  for (const [rows, columns, row, column] of [[7, 7, 3, 3], [4, 6, 2, 3], [1, 6, 0, 3], [6, 1, 3, 0], [1, 1, 0, 0]]) {
    const board = createBoard({ rows, columns });
    assert.deepEqual(getStartingSquare(board), { row, column });
    if (columns > 1) assert.equal(evaluate(board, move('AT', row, column - 1)).legal, true);
    else if (rows > 1) assert.equal(evaluate(board, move('AT', row - 1, column, 'vertical')).legal, true);
    else assert.equal(reason(board, move('A', 0, 0)), 'FIRST_WORD_TOO_SHORT');
  }
});

test('first move requires two letters, center coverage and dictionary membership', () => {
  const board = createBoard({ rows: 7, columns: 7 });
  assert.equal(reason(board, move('A')), 'FIRST_WORD_TOO_SHORT');
  assert.equal(reason(board, move('CAT', 0, 0)), 'START_SQUARE_REQUIRED');
  assert.equal(reason(board, move('ZZZ')), 'UNKNOWN_WORD');
  assert.equal(evaluate(board, move()).legal, true);
});

test('matching letters are reused by identity while mismatches cannot be overwritten', () => {
  const board = letters(['.......', '.......', '.......', '...CAR.', '.......', '.......', '.......']);
  const result = evaluate(board, move('CAB', 3, 3, 'vertical'));
  assert.equal(result.legal, true);
  assert.deepEqual(result.reusedPositions.map((p) => p.index), [24]);
  assert.equal(result.proposedBoard.cells[24], board.cells[24]);
  assert.equal(getCell(board, 4, 3), null);
  const conflict = evaluate(board, move('BAT'));
  assert.equal(conflict.reason.code, 'LETTER_CONFLICT');
  assert.equal(conflict.conflictPositions.length, 2);
  assert.equal(conflict.proposedBoard, null);
});

test('non-letter metadata is blocked rather than silently replaced or treated as a fence', () => {
  const board = createBoard({ rows: 7, columns: 7 });
  const feature = { kind: 'feature', letter: 'C', bonus: 5 };
  board.cells[24] = feature;
  freezeBoard(board);
  const result = evaluate(board, move());
  assert.equal(result.reason.code, 'CELL_OCCUPIED');
  assert.equal(board.cells[24], feature);
  assert.equal(result.positions[0].status, 'blocked');
});

test('disconnected and diagonal-only words are rejected; zero-new-letter moves are rejected', () => {
  const board = letters(['.......', '.......', '.......', '...CAT.', '.......', '.......', '.......']);
  assert.equal(reason(board, move('BAT', 0, 0)), 'DISCONNECTED');
  assert.equal(reason(board, move('AT', 4, 1)), 'DISCONNECTED');
  assert.equal(reason(board, move('CAT')), 'NO_NEW_LETTERS');
});

test('single-letter adjacent extension validates the FULL contiguous word, not raw input', () => {
  const board = letters(['.......', '.......', '..CAT..', '.......', '.......']);
  const extension = evaluate(board, move('s', 2, 5));
  assert.equal(extension.legal, true);
  assert.deepEqual(extension.words.map((run) => run.text), ['CATS']);
  assert.equal(extension.newPositions.length, 1);
  assert.equal(reason(board, move('X', 2, 5)), 'UNKNOWN_WORD');
  assert.equal(evaluate(board, move('S', 2, 5, 'vertical')).legal, true);
});

test('a placement can bridge existing letters beyond BOTH ends of its supplied span', () => {
  const board = letters(['.......', '.......', '..C.T..', '.......', '.......']);
  const result = evaluate(board, move('A', 2, 3));
  assert.equal(result.legal, true);
  assert.deepEqual(result.words.map((run) => run.text), ['CAT']);
  assert.deepEqual(result.words[0].positions.map((p) => [p.row, p.column]), [[2, 2], [2, 3], [2, 4]]);
});

test('placing across an existing matching letter extracts the run once', () => {
  const board = letters(['.......', '.......', '...A...', '.......', '.......']);
  const result = evaluate(board, move('CAT', 2, 2));
  assert.equal(result.legal, true);
  assert.equal(result.newPositions.length, 2);
  assert.equal(result.reusedPositions.length, 1);
  assert.deepEqual(result.words.map((run) => run.text), ['CAT']);
});

test('one new tile may create both horizontal and vertical complete words', () => {
  const board = letters(['.......', '...B...', '..C.T..', '...T...', '.......']);
  const result = evaluate(board, move('A', 2, 3));
  assert.equal(result.legal, true);
  assert.deepEqual(result.words.map((run) => run.text), ['CAT', 'BAT']);
});

test('multiple perpendicular words are all checked; one invalid cross rejects atomically', () => {
  const board = letters(['.......', '..HA...', '.......', '.E.....', '.......']);
  const result = evaluate(board, move('BAR', 2, 1));
  assert.equal(result.legal, true);
  assert.deepEqual(result.words.map((run) => run.text), ['BAR', 'BE', 'HA', 'AR']);
  const seen = [];
  const rejectCross = { has(text) { seen.push(text); return text !== 'HA'; } };
  const rejected = evaluatePlacement(board, move('BAR', 2, 1), rejectCross);
  assert.equal(rejected.reason.code, 'UNKNOWN_WORD');
  assert.deepEqual(rejected.reason.words.map((run) => run.text), ['HA']);
  assert.deepEqual(seen, ['BAR', 'BE', 'HA', 'AR']);
  assert.equal(getCell(board, 2, 1), null);
});

test('same text at different locations is retained; unchanged word runs are not revalidated', () => {
  const board = letters(['.......', '.......', '.......', '..NN...', '.......']);
  const result = evaluate(board, move('TOO', 2, 1));
  assert.equal(result.legal, true);
  assert.deepEqual(result.words.map((run) => run.text), ['TOO', 'ON', 'ON']);
  assert.notEqual(result.words[1].positions[0].index, result.words[2].positions[0].index);
});

test('word extraction omits singletons: no multi-letter run is not a word', () => {
  const board = letters(['A....', '.....', '..T..']);
  assert.deepEqual(extractAffectedWords(board, [{ row: 0, column: 0 }]), []);
});

test('demonstration vocabulary supports enclosure, extensions and ordinary cross words', () => {
  for (const word of ['CAR', 'CAB', 'RAT', 'BAT', 'CATS', 'AT', 'BAR', 'FARM']) assert.equal(demoDictionary.has(word), true);
  assert.equal(demoDictionary.has('ZZZ'), false);
  assert.equal(demoDictionary.has('a perfectly good phrase'), false);
});
