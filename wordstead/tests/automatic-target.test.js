import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createBoard } from '../src/core/board.js';
import { createBag } from '../src/core/bag.js';
import { generateFarm } from '../src/core/farm-layout.js';
import { createFeatureCell } from '../src/core/features.js';
import { estimateAutomaticTarget, TARGET_METHOD_VERSION } from '../src/analysis/automatic-target.js';
import { estimateBoardOpportunity } from '../src/analysis/target-board.js';
import { approximateRack, estimateLetterFlexibility, letterAdjustment, TARGET_LEXICON, assertTargetLexicon } from '../src/analysis/target-letters.js';
import { parseRack } from '../src/analysis/rack.js';
import { enumerateRectangleCandidates, rectanglePerimeter } from '../src/analysis/board-rectangles.js';
import { compatibleRectangles } from '../src/analysis/board-portfolio.js';
import { stableJson } from '../src/analysis/statistics.js';
import { BOARD_METHOD_VERSION } from '../src/analysis/board-opportunities.js';
import { evaluateTargetMatrix, evaluateLexicon } from '../scripts/target-calibration.js';
import { parseArguments } from '../scripts/analyze-targets.js';
import { fitLexicon } from '../scripts/fit-target-lexicon.js';

function freeze(object) {
  if (object && typeof object === 'object' && !Object.isFrozen(object)) { Object.values(object).forEach(freeze); Object.freeze(object); }
  return object;
}

test('identical frozen configuration yields fixed versioned target without ambient randomness', () => {
  const input = freeze({ rows: 15, columns: 15, seed: 'wordstead-2c', farmSeed: 'wordstead-farm-2d', farmDensity: 0.08 });
  const before = JSON.stringify(input), random = Math.random;
  try {
    Math.random = () => { throw new Error('Ambient randomness'); };
    const report = estimateAutomaticTarget(input);
    assert.equal(report.target, 12);
    assert.equal(report.methodVersion, TARGET_METHOD_VERSION);
    assert.equal(report.inputs.boardMethod, 'board-rectangles-v1');
    assert.equal(report.inputs.boardMethod, BOARD_METHOD_VERSION);
    assert.equal(report.inputs.letterMethod, 'rack-lexical-v1');
    assert.equal(report.inputs.vocabularyId, 'esdb-en-us-60-1e5b7d3-ws1');
    assert.deepEqual(estimateAutomaticTarget(input), report);
    assert.equal(JSON.stringify(input), before);
  } finally { Math.random = random; }
});

test('calibration factorial pins positive integer bounds, seed sensitivity and capped large-board growth', () => {
  const batch = evaluateTargetMatrix({ count: 8, letterCount: 8, prefix: 'wordstead-3c3-test-v1' });
  assert.equal(batch.count, 1152);
  assert.equal(batch.unavailable, 0);
  assert.ok(batch.relativeUpperBound.quantiles.p100 <= 1);
  assert.ok(batch.letterSeedTargetRanges.quantiles.p100 > 0);
  assert.ok(batch.letterSeedTargetRanges.quantiles.p100 <= 3);
  assert.ok(batch.farmSeedTargetRanges.quantiles.p100 > 0);
  for (const { rows, columns } of batch.byConfiguration) {
    const report = estimateAutomaticTarget({ rows, columns });
    assert.ok(Number.isSafeInteger(report.target) && report.target > 0);
    assert.ok(report.target <= report.board.theoreticalUpperBound);
  }
  assert.equal(estimateAutomaticTarget({ rows: 30, columns: 30, farmDensity: 0 }).target,
    estimateAutomaticTarget({ rows: 15, columns: 15, farmDensity: 0 }).target);
});

test('tiny, malformed, unsupported, incompatible and heuristic-unavailable results are distinct', () => {
  for (const [rows, columns] of [[1, 1], [1, 30], [2, 20], [3, 3]]) {
    const report = estimateAutomaticTarget({ rows, columns });
    assert.equal(report.target, null);
    assert.equal(report.reason, 'NO_COLLECTIBLE_TERRITORY');
  }
  for (const configuration of [null, [], { rows: 0 }, { columns: 1.5 }, { seed: '' }, { farmSeed: '' }, { farmDensity: -1 }, { farmWeights: {} }]) {
    assert.equal(estimateAutomaticTarget(configuration).reason, 'INVALID_CONFIGURATION');
  }
  assert.equal(estimateAutomaticTarget({ rows: 31 }).reason, 'UNSUPPORTED_CONFIGURATION');
  assert.equal(estimateAutomaticTarget({ bagOrder: [] }).reason, 'UNSUPPORTED_CONFIGURATION');
  assert.equal(estimateAutomaticTarget({ vocabularyId: 'future' }).reason, 'INCOMPATIBLE_ANALYSIS');
  assert.equal(estimateAutomaticTarget({ methodVersion: 'auto-target-v2' }).reason, 'INCOMPATIBLE_ANALYSIS');
  const dense = estimateAutomaticTarget({ rows: 30, columns: 30, farmDensity: 1 });
  assert.equal(dense.reason, 'NO_ELIGIBLE_CANDIDATES');
  assert.ok(dense.board.theoreticalUpperBound > 0);
  assert.match(dense.message, /does not prove.*unsolvable/);
});

test('explicit bounded geometry agrees with an independent raw candidate scan and shared-fence budget', () => {
  const board = freeze(generateFarm(createBoard({ rows: 10, columns: 12 }), { seed: 'bounded-scan', density: 0.2 }));
  const before = JSON.stringify(board), report = estimateBoardOpportunity(board);
  const { candidates, search } = enumerateRectangleCandidates(board, { maxWidth: 7, maxHeight: 7, maxPerimeter: 24 });
  const eligible = candidates.filter((r) => r.startingDistance <= 7 && r.potentialPoints > 0);
  const value = (r) => r.potentialPoints * 16 / r.perimeterCellCount / (1 + r.startingDistance / 7);
  assert.equal(report.search.consideredRectangles, search.consideredRectangles);
  assert.equal(report.search.eligible, eligible.length);
  assert.equal(report.primaryValue, Math.max(...eligible.map(value)));
  assert.ok(Math.max(report.primary.bottom - report.primary.top, report.primary.right - report.primary.left) < 7);
  assert.equal(report.search.retainedPoolLimit, null);
  assert.equal(report.search.truncated, false);
  if (report.secondary) {
    assert.ok(compatibleRectangles(report.primary, report.secondary));
    const union = new Set([...rectanglePerimeter(board, report.primary), ...rectanglePerimeter(board, report.secondary)]);
    assert.equal(union.size, report.distinctFenceDemand);
    assert.ok(union.size + report.primary.startingDistance <= 40);
    const alternatives = eligible.filter((r) => compatibleRectangles(r, report.primary)
      && new Set([...rectanglePerimeter(board, report.primary), ...rectanglePerimeter(board, r)]).size + report.primary.startingDistance <= 40);
    assert.equal(report.secondaryValue, Math.max(...alternatives.map(value)));
  }
  assert.equal(JSON.stringify(board), before);
});

test('obstructions reduce opportunities; utility has no invented points; density is not an ease ordering', () => {
  const plain = createBoard({ rows: 7, columns: 7 });
  const utility = { ...plain, cells: plain.cells.slice() };
  utility.cells[8] = createFeatureCell('livestock');
  const livestock = estimateBoardOpportunity(utility);
  utility.cells[8] = createFeatureCell('building');
  const building = estimateBoardOpportunity(utility);
  assert.equal(livestock.opportunity, building.opportunity);
  assert.equal(livestock.utilityPointAdjustment, 0);
  assert.equal(livestock.theoreticalUpperBound, estimateBoardOpportunity(plain).theoreticalUpperBound);
  const blocked = { ...plain, cells: plain.cells.map(() => ({ reserved: true })) };
  assert.equal(estimateBoardOpportunity(blocked).opportunity, 0);
  assert.ok(estimateBoardOpportunity(blocked).theoreticalUpperBound > 0);
  const sparse = estimateAutomaticTarget({ rows: 30, columns: 30, farmDensity: 0.08 });
  const dense = estimateAutomaticTarget({ rows: 30, columns: 30, farmDensity: 0.25 });
  assert.ok(dense.board.search.obstructed > sparse.board.search.obstructed);
  assert.ok(dense.target < sparse.target);
  const crops = estimateAutomaticTarget({ farmWeights: { crop: 1, livestock: 0, building: 0, fertile: 0 } });
  const livestockOnly = estimateAutomaticTarget({ farmWeights: { crop: 0, livestock: 1, building: 0, fertile: 0 } });
  assert.ok(crops.board.theoreticalUpperBound > livestockOnly.board.theoreticalUpperBound);
  assert.ok(crops.target > livestockOnly.target);
});

test('letter model responds to real seeded opening/future resources and keeps outliers bounded', () => {
  const input = freeze(createBag('wordstead-3c1-batch:177').bag), before = JSON.stringify(input);
  const low = estimateLetterFlexibility(input), high = estimateLetterFlexibility(createBag('blank-qa-636').bag);
  assert.ok(low.opening.overall < high.opening.overall);
  assert.ok(low.futureMean > low.opening.overall);
  assert.notEqual(low.multiplier, high.multiplier);
  assert.deepEqual(low.futureWindows.map((item) => item.start), [7, 17, 28, 39, 50, 60, 71, 82, 93]);
  assert.match(low.interpretation, /not predicted/);
  assert.equal(JSON.stringify(input), before);
  for (const rack of ['JQXZKUV', 'BCDFGHT', 'AAEELLS', 'AEIRSTN', 'AEIRST?', 'AEIRS??']) {
    const values = approximateRack(parseRack(rack));
    for (const value of Object.values(values)) assert.ok(value >= 0 && value <= 1);
  }
  for (const opening of [0, 0.5, 1]) for (const future of [0, 0.5, 1]) {
    const adjusted = letterAdjustment(opening, future);
    assert.ok(adjusted.multiplier >= 0.9 && adjusted.multiplier <= 1.1);
  }
  assert.equal(letterAdjustment(0, 0).multiplier, 0.9);
  assert.equal(letterAdjustment(1, 1).multiplier, 1.1);
  assert.ok(letterAdjustment(0, 0.7).multiplier > letterAdjustment(0, 0.1).multiplier);
  assert.ok(letterAdjustment(1, 0.4).multiplier - letterAdjustment(0, 0.4).multiplier <= 0.141);
});

test('lexical artifact pins unchanged profile/bag/vocabulary and rejects broken or incompatible data', () => {
  const profileBytes = readFileSync(new URL('../data/letter-analysis/profile-v1.json', import.meta.url));
  const profile = JSON.parse(profileBytes);
  assert.equal(createHash('sha256').update(profileBytes).digest('hex'), TARGET_LEXICON.profileSha256);
  assert.equal(profile.methodVersion, TARGET_LEXICON.referenceMethod);
  assert.equal(profile.baseline.capacities[7].flexibility.overall.mean, TARGET_LEXICON.baselineMean);
  assertTargetLexicon(TARGET_LEXICON);
  for (const patch of [{ methodVersion: 'future' }, { referenceMethod: 'wrong' }, { profileSha256: 'wrong' },
    { bagSignature: 'wrong' }, { baselineMean: 0 }, { weights: [] }, { identity: {} }]) {
    assert.equal(estimateAutomaticTarget({}, { model: { ...TARGET_LEXICON, ...patch } }).reason, 'INCOMPATIBLE_ANALYSIS');
  }
  assert.equal(fitLexicon(), readFileSync(new URL('../src/analysis/target-lexicon-v1.js', import.meta.url), 'utf8'));
});

test('separate processes reproduce the entire target report byte for byte', () => {
  const script = new URL('../scripts/analyze-targets.js', import.meta.url);
  const args = [script.pathname.replace(/^\/(\w:)/, '$1'), '--rows', '8', '--columns', '12', '--seed', '42', '--numeric', '--json'];
  const first = execFileSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(execFileSync(process.execPath, args, { encoding: 'utf8' }), first);
  assert.equal(first, stableJson(estimateAutomaticTarget({ rows: 8, columns: 12, seed: 42 })));
});

test('target CLI rejects invalid, duplicate, missing and inapplicable options', () => {
  for (const args of [['--unknown'], ['--seed'], ['--count', '1'], ['batch', '--seed', 'x'], ['--rows', '31'],
    ['--density', 'NaN'], ['--numeric'], ['batch', '--count', '0'], ['lexical', '--letter-count', '2'],
    ['--rows', '7', '--rows', '8'], ['--weights', 'crop:1'], ['batch', '--start', '9007199254740991']]) {
    assert.throws(() => parseArguments(args), Error, args.join(' '));
  }
});

test('held-out real bags keep lexical and target errors within the documented provisional tolerance', () => {
  const report = evaluateLexicon({ count: 256 });
  assert.equal(report.metrics.overall.count, 2560);
  assert.ok(report.metrics.overall.meanAbsoluteError < 0.075);
  assert.ok(report.multiplier.meanAbsoluteError < 0.015);
  assert.ok(report.defaultBoardTargetComparison.maximumTargetDifference <= 1);
  assert.ok(report.edgeCases.twoBlanks.count > 0);
  assert.ok(report.edgeCases.zeroWords.count > 0);
});

test('complete browser import graph excludes Node, baseline sampling, trie construction and development reports', () => {
  const visited = new Set();
  function visit(url) {
    if (visited.has(url.href)) return;
    visited.add(url.href);
    assert.doesNotMatch(url.pathname, /scripts\/|analysis\/(?:rack|seeds|board-opportunities|board-seeds)\.js|profile-v1\.json/);
    const source = readFileSync(url, 'utf8');
    assert.doesNotMatch(source, /from ['"]node:|prepareRackVocabulary\(/);
    for (const match of source.matchAll(/(?:import|export)\s[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) visit(new URL(match[1], url));
  }
  visit(new URL('../src/main.js', import.meta.url));
  assert.ok([...visited].some((url) => url.endsWith('/target-lexicon-v1.js')));
});
