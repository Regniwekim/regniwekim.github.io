import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createBoard } from '../src/core/board.js';
import { generateFarm } from '../src/core/farm-layout.js';
import { createSession, exchangeTiles } from '../src/core/session.js';
import { analyzeFarmBoard, analyzeBoardBatch, boardMetrics } from '../src/analysis/board-seeds.js';
import { analyzeBoardOpportunities } from '../src/analysis/board-opportunities.js';
import { stableJson, summarize } from '../src/analysis/statistics.js';
import { parseArguments } from '../scripts/analyze-board.js';

test('seeded reports reproduce the normal game farm generator, retaining numeric/string identity', () => {
  const configuration = { rows: 8, columns: 11, seed: '42', density: 0.2,
    weights: { crop: 4, livestock: 2, building: 2, fertile: 3 } };
  const before = structuredClone(configuration);
  const report = analyzeFarmBoard(configuration);
  assert.equal(stableJson(report), stableJson(analyzeFarmBoard(configuration)));
  const board = generateFarm(createBoard(configuration), configuration);
  const expected = analyzeBoardOpportunities(board);
  assert.deepEqual(report.composition, expected.composition);
  const session = createSession({ rows: 8, columns: 11, seed: 'letters', farmSeed: '42', farmDensity: 0.2, farmWeights: configuration.weights });
  assert.deepEqual(session.puzzle.board, board);
  assert.notDeepEqual(report.layout, analyzeFarmBoard({ ...configuration, seed: 42 }).layout);
  assert.notDeepEqual(report.layout, analyzeFarmBoard({ ...configuration, seed: 'other' }).layout);
  assert.deepEqual(configuration, before);
  assert.equal(stableJson(report), stableJson(analyzeFarmBoard({ ...configuration,
    weights: { fertile: 3, building: 2, livestock: 2, crop: 4 } })));
  assert.equal(analyzeFarmBoard({ seed: 1e-20 }).generation.seed, 1e-20);
});

test('zero/high farm density, every weight extreme and tiny generated configurations', () => {
  const empty = analyzeFarmBoard({ rows: 7, columns: 7, seed: 'empty', density: 0 });
  assert.deepEqual(empty.layout, []);
  assert.equal(empty.search.validCandidates, 225);
  assert.equal(empty.search.scoringCandidates, 224);
  assert.equal(empty.bestSinglePotentialPoints, 24);
  assert.equal(empty.composition.distribution.quadrantConcentration, null);
  for (const type of ['crop', 'livestock', 'building', 'fertile']) {
    const weights = Object.fromEntries(['crop', 'livestock', 'building', 'fertile'].map((key) => [key, Number(key === type)]));
    const report = analyzeFarmBoard({ rows: 7, columns: 7, seed: 'dense', density: 1, weights });
    assert.equal(report.layout.length, 20);
    assert.ok(report.layout.every((feature) => feature.type === type));
    assert.ok(report.obstructions.rectangleCount > 0);
    assert.ok(report.portfolio.combinedPotentialPoints <= report.composition.theoreticalScoringUpperBound.totalPoints);
  }
  for (const [rows, columns] of [[1, 1], [1, 30], [30, 1], [2, 12], [12, 2], [3, 3], [3, 7]]) {
    const report = analyzeFarmBoard({ rows, columns, seed: 'small', density: 1 });
    assert.doesNotMatch(stableJson(report), /NaN|Infinity/);
  }
  const large = analyzeFarmBoard({ rows: 30, columns: 30, seed: 'extreme', density: 0.2 }, { poolLimit: 2, outputLimit: 1, portfolioSize: 0 });
  assert.equal(large.search.consideredRectangles, 164836);
  assert.equal(large.search.exhaustiveGeometry, true);
  assert.equal(large.composition.totalCells, 900);
});

test('analysis never advances session letter RNG, rack, bag, claims, counters or exchange outcomes', () => {
  const session = createSession({ seed: 'letters', farmSeed: 'separate-farm', rows: 7, columns: 9 });
  const before = structuredClone(session);
  Object.freeze(session.puzzle.board.cells);
  Object.freeze(session.puzzle.board);
  Object.freeze(session.puzzle.territory.claimed);
  Object.freeze(session.puzzle.territory);
  Object.freeze(session.rack);
  Object.freeze(session.bag);
  Object.freeze(session);
  analyzeBoardOpportunities(session.puzzle.board, { territory: session.puzzle.territory });
  analyzeFarmBoard({ seed: 'unrelated-farm' });
  assert.deepEqual(session, before);
  assert.deepEqual(exchangeTiles(session, [session.rack[0].id]), exchangeTiles(before, [before.rack[0].id]));
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('ambient randomness'); };
  try { assert.equal(analyzeFarmBoard({ rows: 5, columns: 5, seed: 'explicit' }).methodVersion, 'board-rectangles-v1'); }
  finally { Math.random = originalRandom; }
});

test('batch distributions match exact sequence members, empty batches and numeric seeds', () => {
  const configuration = { rows: 7, columns: 9, density: 0.2 };
  const options = { prefix: 'batch-test', start: 3, count: 5, maxPerimeter: 18, poolLimit: 16, outputLimit: 2 };
  const report = analyzeBoardBatch(configuration, options);
  assert.equal(stableJson(report), stableJson(analyzeBoardBatch(configuration, options)));
  const individuals = Array.from({ length: 5 }, (_, index) => boardMetrics(analyzeFarmBoard({ ...configuration, seed: `batch-test:${index + 3}` }, options)));
  for (const key of Object.keys(report.distributions)) assert.deepEqual(report.distributions[key], summarize(individuals.map((item) => item[key]).filter((value) => value !== null)));
  assert.equal(report.searchPolicy.exhaustiveGeometry, false);
  const numeric = analyzeBoardBatch(configuration, { count: 1, start: -2, numeric: true });
  assert.equal(numeric.sampling.prefix, null);
  assert.equal(numeric.outliers.bestCandidatePoints.highest[0].seed, -2);
  assert.equal(numeric.distributions.bestCandidatePoints.mean, analyzeFarmBoard({ ...configuration, seed: -2 }).bestSinglePotentialPoints);
  const empty = analyzeBoardBatch(configuration, { count: 0 });
  assert.equal(empty.distributions.bestEfficiency.mean, null);
  assert.deepEqual(empty.outliers.portfolioPoints.lowest, []);
  assert.equal(empty.noScoringCandidates, 0);
  for (const options of [{ count: -1 }, { count: 0.5 }, { start: Number.MAX_SAFE_INTEGER, count: 2 },
    { count: 0, maxWidth: 0 }, { count: 0, includeCandidates: true }]) assert.throws(() => analyzeBoardBatch(configuration, options));
  assert.throws(() => analyzeBoardBatch({ seed: 'ignored' }, { count: 0 }), TypeError);
  assert.throws(() => analyzeBoardBatch({ density: 2 }, { count: 0 }), RangeError);
});

test('CLI arguments reject ignored/inapplicable options and preserve seed types and search policy', () => {
  for (const args of [['other'], ['board', 'extra'], ['board', '--count', '5'], ['batch', '--seed', 'ignored'],
    ['batch', '--raw'], ['board', '--numeric'], ['board', '--numeric', '--seed', 'NaN'], ['batch', '--numeric', '--prefix', 'ignored'],
    ['board', '--rows', '31'], ['board', '--rows', '0'], ['board', '--density', 'NaN'], ['board', '--density', '1.1'],
    ['board', '--limit', '2.5'], ['board', '--limit'], ['board', '--json', '--json'], ['board', '--unknown'],
    ['board', '--raw'], ['board', '--raw', '--json', '--output', 'public.json'],
    ['board', '--weights', 'crop:2,crop:3'], ['batch', '--count', '-1']]) assert.throws(() => parseArguments(args));
  assert.equal(parseArguments([]).command, 'board');
  assert.equal(parseArguments(['board', '--seed', '42']).configuration.seed, '42');
  assert.equal(parseArguments(['board', '--seed', '42', '--numeric']).configuration.seed, 42);
  assert.equal(parseArguments(['board', '--seed', '1e-20', '--numeric']).configuration.seed, 1e-20);
  assert.equal(parseArguments(['batch', '--count', '0']).analysisOptions.count, 0);
  assert.equal(parseArguments(['board', '--max-perimeter', '28']).analysisOptions.maxPerimeter, 28);
  assert.equal(parseArguments(['board', '--raw', '--json', '--output', '.analysis-output/raw.json']).analysisOptions.includeCandidates, true);
});

test('CLI JSON is stable, concise human output stays bounded, and errors go to stderr', () => {
  const cli = fileURLToPath(new URL('../scripts/analyze-board.js', import.meta.url));
  const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  const first = run(['board', '--rows', '7', '--columns', '9', '--seed', '42', '--json']);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, run(['board', '--rows', '7', '--columns', '9', '--seed', '42', '--json']).stdout);
  assert.equal(JSON.parse(first.stdout).generation.seed, '42');
  const numeric = run(['board', '--rows', '7', '--seed', '42', '--numeric', '--json']);
  assert.equal(numeric.status, 0, numeric.stderr);
  assert.equal(JSON.parse(numeric.stdout).generation.seed, 42);
  const batch = run(['batch', '--rows', '5', '--columns', '8', '--count', '3', '--json']);
  assert.equal(batch.status, 0, batch.stderr);
  assert.equal(JSON.parse(batch.stdout).sampling.count, 3);
  const human = run(['board', '--rows', '7']);
  assert.equal(human.status, 0, human.stderr);
  assert.ok(human.stdout.split('\n').length < 30);
  assert.match(human.stdout, /Upper bound \(not reachable maximum\)/);
  assert.match(run(['--help']).stdout, /--max-perimeter/);
  const invalid = run(['board', '--weights', 'crop:1']);
  assert.notEqual(invalid.status, 0);
  assert.equal(invalid.stdout, '');
  assert.match(invalid.stderr, /every farm feature type/);
});

test('browser entry points and production gameplay remain isolated from board analysis', () => {
  for (const path of ['../src/main.js', '../src/ui/sandbox.js', '../src/core/session.js', '../src/vocabulary/loader.js']) {
    assert.doesNotMatch(readFileSync(new URL(path, import.meta.url), 'utf8'), /analysis\/|board-analysis|board-opportunities/);
  }
  const session = createSession();
  assert.equal(session.target, 1);
  assert.equal(session.puzzle.wordCount, 0);
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.dependencies, undefined);
});
