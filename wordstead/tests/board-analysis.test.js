import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../src/core/board.js';
import { createLetterCell, isLetterCell } from '../src/core/letters.js';
import { createFeatureCell, placeFeature, summarizeFeatures } from '../src/core/features.js';
import { analyzeEnclosure } from '../src/core/enclosure.js';
import { createTerritory } from '../src/core/territory.js';
import { getStartingSquare } from '../src/core/placement.js';
import { createFarmSession } from '../src/core/farm-fixture.js';
import { createEnclosureSession, ENCLOSURE_MOVES } from '../src/core/session-fixture.js';
import { commitSessionWord } from '../src/core/session.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { analyzeBoardComposition, isCollectible } from '../src/analysis/board-composition.js';
import { analyzeRectangle, enumerateRectangleCandidates, rectanglePerimeter, compareCoordinates } from '../src/analysis/board-rectangles.js';
import { compatibleRectangles, rectangleInteriorOverlap, selectGeometricPortfolio } from '../src/analysis/board-portfolio.js';
import { analyzeBoardOpportunities, BOARD_METHOD_VERSION } from '../src/analysis/board-opportunities.js';
import { summarize, stableJson } from '../src/analysis/statistics.js';

const centerRectangle = { top: 3, left: 3, bottom: 5, right: 5 };
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function interiorIndices(board, rectangle) {
  const result = [];
  for (let row = rectangle.top + 1; row < rectangle.bottom; row += 1) {
    for (let column = rectangle.left + 1; column < rectangle.right; column += 1) result.push(row * board.columns + column);
  }
  return result;
}

test('composition measures dense board geometry, protected start, score bound and scale-aware distribution', () => {
  let board = createBoard({ rows: 5, columns: 7 });
  for (const [row, column, type] of [[1, 1, 'crop'], [1, 5, 'fertile'], [3, 1, 'livestock'], [3, 5, 'building'], [0, 0, 'crop']]) board = placeFeature(board, row, column, type);
  const report = analyzeBoardComposition(freeze(board));
  assert.deepEqual([report.totalCells, report.interiorCells, report.perimeterCells, report.emptyCells, report.reservedFeatureCells], [35, 15, 20, 30, 5]);
  assert.deepEqual(report.startingSquare, { row: 2, column: 3 });
  assert.deepEqual(report.featureCounts, { crop: 2, livestock: 1, building: 1, fertile: 1 });
  assert.deepEqual(report.eligibleFeatureCounts, { crop: 1, livestock: 1, building: 1, fertile: 1 });
  assert.deepEqual(report.distribution.quadrantTotals, [2, 1, 1, 1]);
  assert.ok(Math.abs(report.distribution.quadrantConcentration - 0.28) < 1e-12);
  assert.equal(report.distribution.byRow[1].crop, 1);
  assert.equal(report.distribution.byColumn[5].fertile, 1);
  assert.equal(report.theoreticalScoringUpperBound.basePoints, 14);
  assert.equal(report.theoreticalScoringUpperBound.bonusPoints, 4);
  assert.equal(report.theoreticalScoringUpperBound.totalPoints, 18);
  assert.deepEqual(report.utility, { totalLivestock: 1, totalBuildings: 1, potentialRackCapacityRewards: 1,
    potentialAdditionalRackSlots: 1, potentialFreeExchangeCredits: 1 });
});

test('letter occupancy, prior claims, starting feature and unknown reserved metadata follow core contracts', () => {
  const board = createBoard({ rows: 7, columns: 7 });
  board.cells[24] = createFeatureCell('crop'); // Starting square: unavailable even if structurally valid.
  board.cells[8] = createLetterCell('A');
  board.cells[9] = createFeatureCell('fertile');
  board.cells[10] = { terrain: 'future' }; // Passable but reserved against placement.
  board.cells[32] = createFeatureCell('building');
  const territory = createTerritory(board);
  territory.claimed[9] = true;
  territory.claimed[32] = true;
  const report = analyzeBoardComposition(freeze(board), { territory: freeze(territory) });
  assert.equal(report.otherReservedCells, 1);
  assert.equal(report.theoreticalScoringUpperBound.basePoints, 21);
  assert.equal(report.theoreticalScoringUpperBound.bonusPoints, 0);
  assert.equal(report.utility.potentialFreeExchangeCredits, 0);
  const candidate = analyzeRectangle(board, centerRectangle, { territory });
  assert.equal(candidate.potentialPoints, 0);
  assert.equal(candidate.buildings, 0);
  const obstructed = analyzeRectangle(board, { top: 1, left: 1, bottom: 3, right: 4 });
  assert.equal(obstructed.valid, false);
  assert.equal(obstructed.otherObstructions, 1);
});

test('utility counts capture rewards separately from capped actual rack-slot potential', () => {
  const board = createBoard({ rows: 7, columns: 7 });
  for (const index of [8, 9, 10, 11]) board.cells[index] = createFeatureCell('livestock');
  const report = analyzeBoardComposition(board);
  assert.equal(report.utility.potentialRackCapacityRewards, 4);
  assert.equal(report.utility.potentialAdditionalRackSlots, 2);
  assert.equal(report.theoreticalScoringUpperBound.bonusPoints, 0);
  const territory = createTerritory(board);
  territory.claimed[8] = true;
  assert.equal(analyzeBoardComposition(board, { territory }).utility.potentialAdditionalRackSlots, 1);
});

test('exhaustive enumeration, one-cell interiors, unique corners, tall/wide and non-square rectangles', () => {
  for (const [rows, columns] of [[7, 7], [4, 9], [9, 4], [3, 5]]) {
    const board = createBoard({ rows, columns });
    const result = enumerateRectangleCandidates(board, { minPoints: 0 });
    const expectedCount = (rows - 2) * (rows - 1) / 2 * (columns - 2) * (columns - 1) / 2;
    assert.equal(result.candidates.length, expectedCount);
    assert.equal(result.search.consideredRectangles, expectedCount);
    assert.equal(result.search.exhaustiveGeometry, true);
    for (const candidate of result.candidates) {
      const perimeter = rectanglePerimeter(board, candidate);
      assert.equal(perimeter.length, 2 * candidate.width + 2 * candidate.height - 4);
      assert.equal(new Set(perimeter).size, perimeter.length);
      assert.equal(candidate.interiorArea + perimeter.length, candidate.grossGeometricArea);
      for (const index of perimeter) {
        const row = Math.floor(index / columns), column = index % columns;
        assert.ok(row >= candidate.top && row <= candidate.bottom && column >= candidate.left && column <= candidate.right);
        assert.ok(row === candidate.top || row === candidate.bottom || column === candidate.left || column === candidate.right);
      }
    }
  }
  const board = createBoard({ rows: 7, columns: 7 });
  assert.equal(analyzeRectangle(board, centerRectangle).interiorArea, 1);
  for (const rectangle of [{ top: -1, left: 0, bottom: 2, right: 2 }, { top: 0, left: 0, bottom: 7, right: 2 },
    { top: 0, left: 6, bottom: 2, right: 8 }, { top: 0, left: 0, bottom: 1, right: 2 }]) assert.throws(() => analyzeRectangle(board, rectangle), RangeError);
});

test('rectangle prediction matches the authoritative orthogonal flood fill for representative farm boards', () => {
  for (const [rows, columns] of [[7, 7], [4, 8], [8, 4]]) {
    let board = createBoard({ rows, columns });
    board = placeFeature(board, 1, 1, 'crop');
    board = placeFeature(board, rows - 2, columns - 2, 'building');
    for (const candidate of enumerateRectangleCandidates(board, { minPoints: 0 }).candidates) {
      const cells = board.cells.slice();
      for (const index of rectanglePerimeter(board, candidate)) cells[index] = createLetterCell('A');
      const hypothetical = { ...board, cells };
      const actual = analyzeEnclosure(hypothetical);
      assert.deepEqual(actual.enclosed, interiorIndices(board, candidate));
      const collectible = actual.enclosed.filter((index) => isCollectible(board, index));
      assert.equal(candidate.potentialPoints, collectible.length + summarizeFeatures(board, collectible).bonusPoints);
    }
  }
  // Edge land remains exterior; no automatic fence, and corner gaps retain the core topology.
  const board = createBoard({ rows: 5, columns: 5 });
  for (const index of rectanglePerimeter(board, { top: 0, left: 0, bottom: 2, right: 2 })) board.cells[index] = createLetterCell('A');
  board.cells[0] = null;
  assert.ok(analyzeEnclosure(board).enclosed.includes(6));
  assert.ok(analyzeEnclosure(board).exterior.includes(0));
  board.cells[1] = null;
  assert.ok(analyzeEnclosure(board).exterior.includes(6));
});

test('original CAR/CAB/RAT/BAT fixture keeps four gameplay moves and geometric eight-position fence', () => {
  let state = createEnclosureSession();
  const before = analyzeRectangle(state.puzzle.board, centerRectangle);
  assert.equal(before.perimeterCellCount, 8);
  assert.equal(before.potentialPoints, 1);
  assert.equal(before.startingSquare.position, 'fence');
  for (const proposal of ENCLOSURE_MOVES) {
    const result = commitSessionWord(state, proposal, demoDictionary);
    assert.equal(result.accepted, true);
    state = result.state;
  }
  assert.equal(state.puzzle.wordCount, 4);
  assert.equal(state.puzzle.territory.claimed[32], true);
  const historical = analyzeRectangle(state.puzzle.board, centerRectangle, { territory: state.puzzle.territory });
  assert.equal(historical.potentialPoints, 0);
  assert.equal(historical.effort.newLetterPositions, 0);
});

for (const [type, base, bonus, points, livestock, buildings] of [
  ['crop', 1, 3, 4, 0, 0], ['fertile', 1, 1, 2, 0, 0], ['livestock', 1, 0, 1, 1, 0], ['building', 1, 0, 1, 0, 1],
]) test(`${type}: exact candidate value and utility use the existing farm fixture`, () => {
  const state = freeze(createFarmSession(type));
  const candidate = analyzeRectangle(state.puzzle.board, centerRectangle);
  assert.equal(candidate.basePoints, base);
  assert.equal(candidate.bonusPoints, bonus);
  assert.equal(candidate.potentialPoints, points);
  assert.equal(candidate.livestock, livestock);
  assert.equal(candidate.buildings, buildings);
  assert.equal(candidate.opportunityEfficiency, points / 8);
});

test('reserved perimeter features are classified and rejected, including exact corner counts', () => {
  const board = createBoard({ rows: 7, columns: 7 });
  board.cells[24] = createFeatureCell('crop'); // Rectangle corner.
  board.cells[25] = createFeatureCell('building');
  const candidate = analyzeRectangle(board, centerRectangle);
  assert.equal(candidate.valid, false);
  assert.equal(candidate.reservedCellObstructions, 2);
  assert.deepEqual(candidate.obstructionByType, { crop: 1, livestock: 0, building: 1, fertile: 0 });
  const raw = enumerateRectangleCandidates(board, { includeObstructed: true });
  assert.ok(raw.obstructed.some((item) => item.id === candidate.id));
  assert.ok(raw.candidates.every((item) => item.id !== candidate.id));
  const report = analyzeBoardOpportunities(board);
  assert.equal(report.obstructions.rectangleCount, raw.obstructed.length);
  assert.ok(report.obstructions.featureIncidencesByType.crop > 0);
});

test('spans, Manhattan distance and starting-square treatment are descriptive and exact', () => {
  const board = createBoard({ rows: 9, columns: 11 }); // start 4,5
  for (const [rectangle, position, distance] of [
    [{ top: 0, left: 0, bottom: 2, right: 2 }, 'outside', 5],
    [{ top: 2, left: 3, bottom: 6, right: 7 }, 'inside', 2],
    [{ top: 4, left: 3, bottom: 8, right: 7 }, 'fence', 0],
  ]) {
    const candidate = analyzeRectangle(board, rectangle);
    assert.equal(candidate.startingSquare.position, position);
    assert.equal(candidate.startingSquare.distanceToFence, distance);
    const start = getStartingSquare(board);
    const measured = Math.min(...rectanglePerimeter(board, rectangle).map((index) =>
      Math.abs(Math.floor(index / board.columns) - start.row) + Math.abs(index % board.columns - start.column)));
    assert.equal(distance, measured);
  }
  const wide = analyzeRectangle(board, { top: 0, left: 0, bottom: 2, right: 8 });
  assert.deepEqual(wide.effort.horizontalSpans, [9, 9]);
  assert.deepEqual(wide.effort.verticalSpans, [3, 3]);
  assert.equal(wide.effort.estimatedFenceEffort, 20);
  assert.equal(wide.effort.longestSpan, 9);
  const innerStart = analyzeRectangle(board, { top: 2, left: 3, bottom: 6, right: 7 });
  assert.equal(innerStart.basePoints, innerStart.interiorArea - 1);
});

test('tiny boards yield meaningful zeros/nulls and never fabricate score or divide by zero', () => {
  for (const [rows, columns] of [[1, 1], [1, 30], [30, 1], [2, 12], [12, 2], [3, 3]]) {
    const report = analyzeBoardOpportunities(createBoard({ rows, columns }));
    assert.equal(report.bestSinglePotentialPoints, 0);
    assert.equal(report.bestEfficiency, null);
    assert.equal(report.portfolio.combinedPotentialPoints, 0);
    assert.deepEqual(report.rankings.highestPoints, []);
    assert.equal(report.normalized.bestSingleFractionOfUpperBound, null);
    assert.doesNotMatch(stableJson(report), /NaN|Infinity/);
  }
});

test('bounded rankings and Pareto front agree with independent exhaustive sorting and dominance', () => {
  let board = createBoard({ rows: 7, columns: 8 });
  board = placeFeature(board, 1, 2, 'crop');
  board = placeFeature(board, 5, 6, 'fertile');
  board = placeFeature(board, 3, 1, 'livestock');
  board = placeFeature(board, 4, 6, 'building');
  const raw = enumerateRectangleCandidates(board).candidates;
  const report = analyzeBoardOpportunities(freeze(board), { outputLimit: 5, poolLimit: 7, diversitySimilarity: 1 });
  const byPoints = (a, b) => b.potentialPoints - a.potentialPoints || a.perimeterCellCount - b.perimeterCellCount
    || a.startingDistance - b.startingDistance || compareCoordinates(a, b);
  const byEfficiency = (a, b) => b.potentialPoints * a.perimeterCellCount - a.potentialPoints * b.perimeterCellCount || byPoints(a, b);
  assert.deepEqual(report.rankings.highestPoints.map((item) => item.id), raw.slice().sort(byPoints).slice(0, 5).map((item) => item.id));
  assert.deepEqual(report.rankings.highestEfficiency.map((item) => item.id), raw.slice().sort(byEfficiency).slice(0, 5).map((item) => item.id));
  for (const [view, filter, compare] of [
    ['farmBonuses', (a) => a.bonusPoints > 0, (a, b) => b.bonusPoints - a.bonusPoints || byEfficiency(a, b)],
    ['lowEffort', () => true, (a, b) => a.perimeterCellCount - b.perimeterCellCount || byPoints(a, b)],
    ['livestock', (a) => a.livestock > 0, (a, b) => b.livestock - a.livestock || byEfficiency(a, b)],
    ['buildings', (a) => a.buildings > 0, (a, b) => b.buildings - a.buildings || byEfficiency(a, b)],
  ]) assert.deepEqual(report.rankings[view].map((item) => item.id), raw.filter(filter).sort(compare).slice(0, 5).map((item) => item.id));
  assert.equal(report.rankingCoverage.highestPoints.truncated, true);
  const nondominated = raw.filter((b) => !raw.some((a) => a.potentialPoints >= b.potentialPoints
    && a.perimeterCellCount <= b.perimeterCellCount && (a.potentialPoints > b.potentialPoints || a.perimeterCellCount < b.perimeterCellCount)));
  assert.equal(report.pareto.candidateCount, nondominated.length);
  assert.ok(report.pareto.candidates.every((item) => nondominated.some((other) => item.id === other.id)));
  assert.equal(report.distributions.potentialPoints.count, raw.length + 1); // Empty starting-cell rectangle is valid geometry.
  assert.equal(Object.values(report.countsByPerimeterDemand).reduce((a, b) => a + b, 0), report.search.validCandidates);
  assert.equal(Object.values(report.countsByInteriorArea).reduce((a, b) => a + b, 0), report.search.validCandidates);
  const all = enumerateRectangleCandidates(board, { minPoints: 0 }).candidates;
  assert.ok(Math.abs(report.distributions.potentialPoints.mean - summarize(all.map((item) => item.potentialPoints)).mean) < 1e-11);
  assert.equal(report.methodVersion, BOARD_METHOD_VERSION);
  assert.equal(stableJson(report), stableJson(analyzeBoardOpportunities(board, { outputLimit: 5, poolLimit: 7, diversitySimilarity: 1 })));
});

test('search limits, ranking filters, diversity and explicit raw diagnostics disclose their scope', () => {
  const board = createBoard({ rows: 8, columns: 10 });
  const report = analyzeBoardOpportunities(board, { maxWidth: 4, maxHeight: 5, maxPerimeter: 12,
    minPoints: 2, outputLimit: 3, poolLimit: 8, portfolioSize: 2, includeCandidates: true });
  assert.equal(report.search.exhaustiveGeometry, false);
  assert.ok(report.search.skippedBySearchLimits > 0);
  assert.ok(report.candidates.every((item) => item.width <= 4 && item.height <= 5 && item.perimeterCellCount <= 12 && item.potentialPoints >= 2));
  assert.ok(report.search.filteredByMinPoints > 0);
  assert.ok(report.portfolio.selected.length <= 2);
  assert.ok(Object.values(report.rankings).every((items) => items.length <= 3));
  const noDisplay = analyzeBoardOpportunities(board, { outputLimit: 0, portfolioSize: 0 });
  assert.deepEqual(noDisplay.rankings.highestPoints, []);
  assert.deepEqual(noDisplay.portfolio.selected, []);
  const none = analyzeBoardOpportunities(board, { maxWidth: 2 });
  assert.equal(none.search.consideredRectangles, 0);
  assert.equal(none.obstructions.fractionOfConsidered, null);
  const zero = analyzeBoardOpportunities(createBoard({ rows: 3, columns: 3 }), { minPoints: 0, includeCandidates: true });
  assert.equal(zero.candidates.length, 1);
  assert.equal(zero.search.rankedCandidates, 0);
});

test('exact distinct feature coverage is independent of bounded ranking pools', () => {
  let board = createBoard({ rows: 9, columns: 9 });
  for (const [row, column, type] of [[1, 1, 'crop'], [1, 7, 'livestock'], [7, 1, 'building'], [7, 7, 'fertile']]) board = placeFeature(board, row, column, type);
  const report = analyzeBoardOpportunities(board, { poolLimit: 1, outputLimit: 1 });
  const raw = enumerateRectangleCandidates(board).candidates;
  for (const type of ['crop', 'livestock', 'building', 'fertile']) {
    const covered = new Set();
    for (const candidate of raw) for (const index of interiorIndices(board, candidate)) if (board.cells[index]?.type === type) covered.add(index);
    assert.equal(report.featureOpportunities.distinctCapturableFeatures[type], covered.size);
    assert.equal(report.featureOpportunities.captureFractions[type], 1);
  }
  let blocked = createBoard({ rows: 7, columns: 7 });
  blocked = placeFeature(blocked, 1, 1, 'crop');
  blocked = placeFeature(blocked, 1, 2, 'livestock');
  const limited = analyzeBoardOpportunities(blocked, { maxPerimeter: 8 });
  assert.equal(limited.featureOpportunities.distinctCapturableFeatures.crop, 0);
  assert.equal(limited.featureOpportunities.captureFractions.crop, 0);
  assert.equal(limited.normalized.capturableBonusFraction, 0);
});

test('portfolio counts disjoint captures, repeated features and shared fence positions exactly once', () => {
  let board = createBoard({ rows: 7, columns: 9 });
  board = placeFeature(board, 1, 1, 'crop');
  board = placeFeature(board, 1, 3, 'fertile');
  const a = analyzeRectangle(board, { top: 0, left: 0, bottom: 2, right: 2 });
  const b = analyzeRectangle(board, { top: 0, left: 2, bottom: 2, right: 4 });
  const enclosingBoth = analyzeRectangle(board, { top: 0, left: 0, bottom: 2, right: 4 });
  const result = selectGeometricPortfolio(board, [b, a, a], { maxSelected: 3 });
  assert.equal(result.selected.length, 2);
  assert.equal(result.combinedPotentialPoints, 6);
  assert.equal(result.distinctCoveredCells, 2);
  assert.equal(result.rawSummedPerimeterDemand, 16);
  assert.equal(result.distinctFenceDemand, 13);
  assert.equal(result.sharedFencePositionsSaved, 3);
  assert.equal(result.selected.reduce((sum, item) => sum + item.marginalPotentialPoints, 0), 6);
  assert.deepEqual(result.featureCoverage, { crop: 1, fertile: 1, livestock: 0, building: 0 });
  assert.deepEqual(result, selectGeometricPortfolio(board, [a, b], { maxSelected: 3 }));
  const overlapping = selectGeometricPortfolio(board, [a, enclosingBoth], { maxSelected: 3 });
  assert.equal(overlapping.selected.length, 1);
  assert.ok(overlapping.combinedPotentialPoints <= enclosingBoth.potentialPoints);
});

test('portfolio rejects interior overlap, nested fences and crossing boundaries; empty/zero cases', () => {
  const a = { top: 0, left: 0, bottom: 4, right: 4 };
  const crossing = { top: 2, left: 3, bottom: 6, right: 7 };
  assert.equal(rectangleInteriorOverlap(a, crossing), 0);
  assert.equal(compatibleRectangles(a, crossing), false);
  assert.equal(compatibleRectangles(a, { top: 1, left: 1, bottom: 3, right: 3 }), false);
  assert.equal(compatibleRectangles(a, { top: 3, left: 3, bottom: 6, right: 6 }), false);
  assert.equal(compatibleRectangles(a, { top: 4, left: 0, bottom: 6, right: 4 }), true);
  const board = createBoard({ rows: 7, columns: 8 });
  const pool = [a, crossing].map((rectangle) => analyzeRectangle(board, rectangle));
  assert.equal(selectGeometricPortfolio(board, pool).selected.length, 1);
  assert.deepEqual(selectGeometricPortfolio(board, []).selected, []);
  assert.equal(selectGeometricPortfolio(board, pool, { maxSelected: 0 }).combinedPotentialPoints, 0);
  assert.throws(() => selectGeometricPortfolio(board, pool, { maxSelected: -1 }), RangeError);
});

test('all returned portfolios satisfy geometry, union-score and upper-bound invariants', () => {
  let board = createBoard({ rows: 9, columns: 12 });
  for (const [row, column, type] of [[2, 2, 'crop'], [2, 8, 'livestock'], [6, 8, 'building'], [6, 2, 'fertile']]) board = placeFeature(board, row, column, type);
  const territory = createTerritory(board);
  territory.claimed[26] = true;
  board.cells[27] = createLetterCell('A');
  const before = structuredClone({ board, territory });
  const report = analyzeBoardOpportunities(freeze(board), { territory: freeze(territory), portfolioSize: 5 });
  const { selected } = report.portfolio;
  for (const a of selected) for (const b of selected) if (a !== b) assert.ok(compatibleRectangles(a, b));
  const cells = [...new Set(selected.flatMap((rectangle) => interiorIndices(board, rectangle)))].filter((index) => isCollectible(board, index, territory));
  assert.equal(report.portfolio.combinedPotentialPoints, cells.length + summarizeFeatures(board, cells).bonusPoints);
  const fences = new Set(selected.flatMap((rectangle) => rectanglePerimeter(board, rectangle)));
  assert.equal(report.portfolio.distinctFenceDemand, fences.size);
  assert.equal(report.portfolio.distinctNewLetterPositions, [...fences].filter((index) => !isLetterCell(board.cells[index])).length);
  const hypothetical = { ...board, cells: board.cells.map((cell, index) => fences.has(index) ? createLetterCell('A') : cell) };
  const enclosed = new Set(analyzeEnclosure(hypothetical).enclosed);
  assert.ok(cells.every((index) => enclosed.has(index)));
  assert.ok(report.normalized.portfolioFractionOfUpperBound <= 1);
  assert.deepEqual({ board, territory }, before);
});

test('malformed boards, claim masks and analysis limits fail explicitly', () => {
  const board = createBoard({ rows: 5, columns: 5 });
  for (const bad of [null, { ...board, rows: 0 }, { ...board, cells: Array(25) }, { ...board, cells: [null] }]) assert.throws(() => analyzeBoardComposition(bad), TypeError);
  for (const territory of [null, { rows: 4, columns: 5, claimed: Array(20).fill(false) }, { rows: 5, columns: 5, claimed: Array(25) }]) assert.throws(() => analyzeBoardOpportunities(board, { territory }), TypeError);
  for (const options of [{ poolLimit: 0 }, { outputLimit: -1 }, { portfolioSize: -1 }, { diversitySimilarity: 2 },
    { maxWidth: 0 }, { maxHeight: 1.1 }, { maxPerimeter: NaN }, { minPoints: -1 }, { outputLimit: 5, poolLimit: 2 }]) assert.throws(() => analyzeBoardOpportunities(board, options), RangeError);
});
