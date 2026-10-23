import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../src/core/board.js';
import { setLetter } from '../src/core/letters.js';
import {
  createTerritory, evaluateTerritory, claimTerritory,
  calculateTerritoryPoints, getTerritoryScore,
} from '../src/core/territory.js';
import { boardFromDiagram, freezeBoard } from './fixtures.js';

const ring = () => boardFromDiagram(['.....', '.###.', '.#.#.', '.###.', '.....']);
function freezeTerritory(territory) {
  Object.freeze(territory.claimed);
  return Object.freeze(territory);
}

test('claims initialize independently and deterministically', () => {
  const board = createBoard();
  const first = createTerritory(board);
  const second = createTerritory(board);
  assert.deepEqual(first, { rows: 15, columns: 15, claimed: Array(225).fill(false) });
  assert.deepEqual(first, second);
  assert.notEqual(first.claimed, second.claimed);
  assert.equal(getTerritoryScore(first), 0);
});

test('preview exposes enclosed unclaimed land without awarding it permanently', () => {
  const board = freezeBoard(ring());
  const territory = freezeTerritory(createTerritory(board));
  const evaluation = evaluateTerritory(board, territory);
  assert.deepEqual(evaluation.enclosed, [12]);
  assert.deepEqual(evaluation.newlyClaimed, [12]);
  assert.equal(evaluation.points, 1);
  assert.equal(getTerritoryScore(territory), 0);
  assert.deepEqual(evaluateTerritory(board, territory), evaluation);
});

test('claim awards exactly once and copies state even for a repeated zero-point claim', () => {
  const board = freezeBoard(ring());
  const territory = freezeTerritory(createTerritory(board));
  const first = claimTerritory(board, territory);
  freezeTerritory(first.territory);
  const again = claimTerritory(board, first.territory);
  assert.deepEqual(first.newlyClaimed, [12]);
  assert.equal(first.points, 1);
  assert.equal(first.totalPoints, 1);
  assert.equal(first.territory.claimed[12], true);
  assert.deepEqual(again.newlyClaimed, []);
  assert.deepEqual(again.enclosed, [12]);
  assert.equal(again.points, 0);
  assert.equal(again.totalPoints, 1);
  assert.deepEqual(again.territory, first.territory);
  assert.notEqual(again.territory.claimed, first.territory.claimed);
  assert.equal(territory.claimed[12], false);
});

test('opening and reclosing a fence retains historical claims without rescoring', () => {
  const board = ring();
  const first = claimTerritory(board, createTerritory(board));
  const open = setLetter(board, 2, 3, null);
  const opened = claimTerritory(open, freezeTerritory(first.territory));
  assert.deepEqual(opened.enclosed, []);
  assert.ok(opened.exterior.includes(12));
  assert.equal(opened.territory.claimed[12], true);
  assert.equal(opened.totalPoints, 1);
  assert.equal(opened.points, 0);
  assert.equal(claimTerritory(board, opened.territory).points, 0);
});

test('covering claimed land with a letter preserves its claim and awards no points', () => {
  const board = ring();
  const first = claimTerritory(board, createTerritory(board));
  const occupied = setLetter(board, 2, 2, 'B');
  const result = claimTerritory(occupied, first.territory);
  assert.deepEqual(result.enclosed, []);
  assert.deepEqual(result.newlyClaimed, []);
  assert.equal(result.points, 0);
  assert.equal(result.totalPoints, 1);
  assert.equal(result.territory.claimed[12], true);
  assert.equal(claimTerritory(setLetter(occupied, 2, 2, null), result.territory).points, 0);
});

test('later enclosure awards only additional land, with exact index fixtures', () => {
  const board = boardFromDiagram(['.........', '.###.###.', '.#.#.#...', '.###.###.', '.........']);
  const first = claimTerritory(board, createTerritory(board));
  assert.deepEqual(first.newlyClaimed, [20]);
  const second = claimTerritory(setLetter(board, 2, 7, 'A'), freezeTerritory(first.territory));
  assert.deepEqual(second.enclosed, [20, 24]);
  assert.deepEqual(second.newlyClaimed, [24]);
  assert.equal(second.points, 1);
  assert.equal(second.totalPoints, 2);
});

test('multi-cell enclosure excludes internal letters from score', () => {
  const board = freezeBoard(boardFromDiagram(['#####', '#...#', '#.#.#', '#...#', '#####']));
  const result = claimTerritory(board, freezeTerritory(createTerritory(board)));
  assert.deepEqual(result.newlyClaimed, [6, 7, 8, 11, 13, 16, 17, 18]);
  assert.equal(result.points, 8);
  assert.equal(result.totalPoints, 8);
  assert.equal(result.territory.claimed[12], false);
});

test('non-letter metadata neither blocks nor changes one-point scoring', () => {
  const board = ring();
  board.cells[12] = { kind: 'feature', bonus: 999 };
  const result = claimTerritory(freezeBoard(board), createTerritory(board));
  assert.equal(result.points, 1);
  assert.deepEqual(result.newlyClaimed, [12]);
});

test('no enclosed land yields no claims or points', () => {
  const board = createBoard({ rows: 1, columns: 5 });
  const territory = freezeTerritory(createTerritory(board));
  const result = claimTerritory(board, territory);
  assert.deepEqual(result.enclosed, []);
  assert.deepEqual(result.newlyClaimed, []);
  assert.equal(result.points, 0);
  assert.equal(result.totalPoints, 0);
  assert.deepEqual(result.territory, territory);
});

test('point helper counts unique cells, never duplicate indices', () => {
  assert.equal(calculateTerritoryPoints([]), 0);
  assert.equal(calculateTerritoryPoints([3, 5, 7]), 3);
  assert.equal(calculateTerritoryPoints([3, 3, 5]), 2);
});

test('claim APIs reject mismatched board dimensions and mask lengths', () => {
  const board = createBoard({ rows: 3, columns: 5 });
  const wrongShape = createTerritory(createBoard({ rows: 5, columns: 3 }));
  const wrongLength = { ...createTerritory(board), claimed: [] };
  for (const territory of [wrongShape, wrongLength]) {
    assert.throws(() => evaluateTerritory(board, territory), RangeError);
    assert.throws(() => claimTerritory(board, territory), RangeError);
  }
});
