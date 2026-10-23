import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../src/core/board.js';
import { analyzeEnclosure } from '../src/core/enclosure.js';
import { boardFromDiagram, coordinates, freezeBoard } from './fixtures.js';

const fixtures = [
  ['empty board', ['.....', '.....', '.....'], []],
  ['one letter', ['.....', '..#..', '.....'], []],
  ['horizontal divider reaching both edges', ['.....', '#####', '.....'], []],
  ['vertical divider reaching both edges', ['..#..', '..#..', '..#..'], []],
  ['open U', ['.....', '.#.#.', '.#.#.', '.###.', '.....'], []],
  ['square ring', ['.....', '.###.', '.#.#.', '.###.', '.....'], [[2, 2]]],
  ['rectangular ring', ['.......', '.#####.', '.#...#.', '.#...#.', '.#####.', '.......'],
    [[2, 2], [2, 3], [2, 4], [3, 2], [3, 3], [3, 4]]],
  ['side gap leaks', ['.....', '.###.', '.#...', '.###.', '.....'], []],
  ['diagonal line does not enclose', ['#....', '.#...', '..#..', '...#.', '....#'], []],
  ['diagonal land gap is not a passage', ['.....', '..##.', '.#.#.', '.###.', '.....'], [[2, 2]]],
  ['four cardinal letters isolate a cell despite diagonal letter contacts',
    ['.....', '..#..', '.#.#.', '..#..', '.....'], [[2, 2]]],
  ['open boundary U cannot borrow the top edge', ['.#.#.', '.#.#.', '.###.', '.....'], []],
  ['open boundary U cannot borrow the bottom edge', ['.....', '.###.', '.#.#.', '.#.#.'], []],
  ['open boundary U cannot borrow the left edge', ['###..', '..#..', '###..', '.....'], []],
  ['open boundary U cannot borrow the right edge', ['..###', '..#..', '..###', '.....'], []],
  ['actual letter ring touching perimeter', ['###..', '#.#..', '###..', '.....'], [[1, 1]]],
  ['letters on every edge form a real ring', ['#####', '#...#', '#####'], [[1, 1], [1, 2], [1, 3]]],
  ['two independent regions', ['.........', '.###.###.', '.#.#.#.#.', '.###.###.', '.........'], [[2, 2], [2, 6]]],
  ['letters within a region never count as land', ['.......', '.#####.', '.#...#.', '.#.#.#.', '.#...#.', '.#####.', '.......'],
    [[2, 2], [2, 3], [2, 4], [3, 2], [3, 4], [4, 2], [4, 3], [4, 4]]],
  ['irregular L region', ['......', '.####.', '.#..#.', '.#.##.', '.###..', '......'], [[2, 2], [2, 3], [3, 2]]],
  ['wide board', ['.#####...', '.#...#...', '.#####...'], [[1, 2], [1, 3], [1, 4]]],
  ['tall board', ['.#.', '#.#', '#.#', '#.#', '.#.', '...', '...', '...'], [[1, 1], [2, 1], [3, 1]]],
  ['single row', ['##.##..#'], []],
  ['single column', ['#', '.', '#', '.', '#'], []],
  ['one empty cell', ['.'], []],
  ['one letter cell', ['#'], []],
  ['fully occupied board', ['###', '###', '###'], []],
  ['no row wrapping between right and left edges', ['###.', '#.##', '####'], [[1, 1]]],
];

for (const [name, diagram, expected] of fixtures) {
  test(name, () => {
    const board = freezeBoard(boardFromDiagram(diagram));
    const before = structuredClone(board);
    const result = analyzeEnclosure(board);
    assert.deepEqual(coordinates(board, result.enclosed), expected);
    assert.deepEqual(analyzeEnclosure(board), result, 'deterministic evaluation');
    assert.deepEqual(board, before, 'no mutation');

    const passable = board.cells.flatMap((cell, index) => cell === null ? [index] : []);
    assert.deepEqual([...result.exterior, ...result.enclosed].sort((a, b) => a - b), passable);
    assert.equal(new Set([...result.exterior, ...result.enclosed]).size, passable.length);
    for (const [row, column] of coordinates(board, result.enclosed)) {
      assert.ok(row > 0 && row < board.rows - 1 && column > 0 && column < board.columns - 1);
    }
  });
}

test('non-letter cell metadata is passable and can be enclosed', () => {
  const open = boardFromDiagram(['.....', '.###.', '.#...', '.###.', '.....']);
  open.cells[2 * open.columns + 3] = { kind: 'feature', feature: 'future' };
  assert.deepEqual(analyzeEnclosure(freezeBoard(open)).enclosed, []);
  const closed = boardFromDiagram(['.....', '.###.', '.#.#.', '.###.', '.....']);
  closed.cells[12] = { kind: 'feature', letter: 'decorative, not occupancy' };
  assert.deepEqual(analyzeEnclosure(freezeBoard(closed)).enclosed, [12]);
});

test('iterative fill handles a large exterior without recursion limits', () => {
  const result = analyzeEnclosure(createBoard({ rows: 250, columns: 400 }));
  assert.equal(result.exterior.length, 100000);
  assert.deepEqual(result.enclosed, []);
});
