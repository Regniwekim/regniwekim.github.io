import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeFarmBoard, analyzeBoardBatch } from '../src/analysis/board-seeds.js';
import { stableJson } from '../src/analysis/statistics.js';

const HELP = `Usage: node scripts/analyze-board.js [board|batch] [options]
Default command: board. Development-only geometric opportunities, not playable solutions.

Farm settings (same generator as gameplay):
  --rows <1-30>              Default 15
  --columns <1-30>           Default 15
  --seed <text>              board: default wordstead-farm-2d
  --numeric                  board: interpret seed as finite number; batch: numeric sequence
  --density <0-1>            Default 0.08; zero is valid
  --weights <type:weight,...> Every type required: crop:4,livestock:2,building:2,fertile:3

Batch sequence:
  --count <integer>          Default 1000, zero allowed
  --prefix <text>            Default wordstead-3c2-batch; seeds <prefix>:<start+i>
  --start <integer>          Default 0; --numeric uses numbers <start+i>

Search and output (exhaustive geometry by default):
  --max-width <integer>      Maximum gross rectangle width, default board columns
  --max-height <integer>     Maximum gross rectangle height, default board rows
  --max-perimeter <integer>  Maximum distinct full fence positions
  --min-points <integer>     Ranking filter, default 1; zero-value candidates never ranked
  --pool-limit <integer>     Retain top candidates per view/effort tier, default 128
  --limit <integer>          Diverse results per view, default 5, at most pool-limit
  --diversity <0-1>          Reject interior IoU above this value in displayed views, default 0.8
  --portfolio-size <integer> Maximum selected rectangles, default 3
  --json                     Stable schema 1 / board-rectangles-v1 JSON, no timestamps
  --output <file>            Write report instead of stdout
  --raw                      board only: all valid measured candidates; requires --json
                             and --output within wordstead/.analysis-output/
  --help                     Show help
No targets, letter-bag draws, vocabulary/profile reads, backend or runtime dependencies.
Timings and process memory are intentionally excluded from deterministic JSON.`;

const flags = new Set(['numeric', 'json', 'raw', 'help']);
const values = new Set(['rows', 'columns', 'seed', 'density', 'weights', 'count', 'prefix', 'start',
  'max-width', 'max-height', 'max-perimeter', 'min-points', 'pool-limit', 'limit', 'diversity', 'portfolio-size', 'output']);
const aliases = { 'max-width': 'maxWidth', 'max-height': 'maxHeight', 'max-perimeter': 'maxPerimeter',
  'min-points': 'minPoints', 'pool-limit': 'poolLimit', limit: 'outputLimit', diversity: 'diversitySimilarity', 'portfolio-size': 'portfolioSize' };
const outputRoot = fileURLToPath(new URL('../.analysis-output/', import.meta.url));

export function parseArguments(args) {
  const options = {}, positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith('--')) { positional.push(argument); continue; }
    const key = argument.slice(2);
    if (!flags.has(key) && !values.has(key)) throw new Error(`Unknown option: ${argument}`);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option: ${argument}`);
    if (flags.has(key)) options[key] = true;
    else {
      const value = args[++index];
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value: ${argument}`);
      options[key] = value;
    }
  }
  if (options.help) return { help: true };
  const command = positional[0] ?? 'board';
  if (!['board', 'batch'].includes(command) || positional.length > 1) throw new Error('Choose board or batch. Use --help.');
  const forbidden = command === 'batch' ? ['seed', 'raw'] : ['count', 'prefix', 'start'];
  for (const key of forbidden) if (Object.hasOwn(options, key)) throw new Error(`--${key} is not supported for ${command}.`);
  if (options.numeric && options.prefix !== undefined) throw new Error('Choose --numeric or --prefix.');
  const integers = ['rows', 'columns', 'count', 'start', 'max-width', 'max-height', 'max-perimeter', 'min-points', 'pool-limit', 'limit', 'portfolio-size'];
  for (const key of integers) {
    if (options[key] === undefined) continue;
    if (!/^-?\d+$/.test(options[key]) || !Number.isSafeInteger(Number(options[key]))) throw new Error(`Invalid integer: --${key}`);
    options[key] = Number(options[key]);
    const minimum = ['count', 'min-points', 'limit', 'portfolio-size'].includes(key) ? 0 : 1;
    if (key !== 'start' && options[key] < minimum) throw new Error(`Invalid integer range: --${key}`);
    if (['rows', 'columns'].includes(key) && options[key] > 30) throw new Error('CLI board dimensions must be 1–30.');
  }
  for (const key of ['density', 'diversity']) if (options[key] !== undefined) {
    if (!options[key].trim() || !Number.isFinite(Number(options[key])) || Number(options[key]) < 0 || Number(options[key]) > 1) throw new Error(`--${key} must be 0–1.`);
    options[key] = Number(options[key]);
  }
  const configuration = Object.fromEntries(['rows', 'columns', 'density'].filter((key) => options[key] !== undefined).map((key) => [key, options[key]]));
  if (options.weights !== undefined) {
    const weights = {};
    for (const entry of options.weights.split(',')) {
      const parts = entry.split(':');
      if (parts.length !== 2 || !parts[1].trim() || Object.hasOwn(weights, parts[0])) throw new Error('Invalid or duplicate feature weight.');
      weights[parts[0]] = Number(parts[1]);
    }
    configuration.weights = weights; // The authoritative generator validates keys and values.
  }
  if (command === 'board') {
    if (options.seed !== undefined) configuration.seed = options.seed;
    if (options.numeric) {
      if (options.seed === undefined || !options.seed.trim() || !Number.isFinite(Number(options.seed))) throw new Error('--numeric requires a finite --seed.');
      configuration.seed = Number(options.seed);
    }
  }
  const analysisOptions = Object.fromEntries(Object.entries(aliases).filter(([key]) => options[key] !== undefined).map(([key, name]) => [name, options[key]]));
  if (command === 'batch') for (const key of ['count', 'prefix', 'start', 'numeric']) if (options[key] !== undefined) analysisOptions[key] = options[key];
  if (options.raw) {
    const path = options.output ? relative(outputRoot, resolve(options.output)) : '..';
    if (!options.json || !options.output || !path || path === '..' || path.startsWith('..\\') || path.startsWith('../') || isAbsolute(path)) {
      throw new Error('--raw requires --json and --output inside wordstead/.analysis-output/.');
    }
    analysisOptions.includeCandidates = true;
  }
  return { command, configuration, analysisOptions, options };
}

const decimal = (value) => value === null ? 'unavailable' : Number(value.toFixed(4));
export function formatReport(command, report) {
  if (command === 'batch') return [report.interpretation,
    `Farms: ${report.configuration.rows}x${report.configuration.columns}, density ${report.configuration.density}; ${report.sampling.count} seeds`,
    `Sequence: ${report.sampling.sequence}, start ${report.sampling.start}, prefix ${JSON.stringify(report.sampling.prefix)}`,
    `Search: ${JSON.stringify(report.searchPolicy)}`,
    ...Object.entries(report.distributions).map(([key, summary]) => `${key}: mean=${decimal(summary.mean)} p05=${decimal(summary.quantiles.p05)} median=${decimal(summary.quantiles.p50)} p95=${decimal(summary.quantiles.p95)}`),
    `Zero scoring candidates: ${report.noScoringCandidates}; detailed outliers available in --json.`].join('\n');
  const { composition: c, search, portfolio, normalized } = report;
  return [report.interpretation,
    `Farm ${c.rows}x${c.columns}; seed=${JSON.stringify(report.generation.seed)} density=${report.generation.density}`,
    `Cells: ${c.totalCells}, interior=${c.interiorCells}, perimeter=${c.perimeterCells}, empty=${c.emptyCells}, reserved=${c.reservedCells}; start=(${c.startingSquare.row},${c.startingSquare.column})`,
    `Features: ${JSON.stringify(c.featureCounts)}; quadrants=${c.distribution.quadrantTotals.join('/')} concentration=${decimal(c.distribution.quadrantConcentration)}`,
    `Upper bound (not reachable maximum): ${c.theoreticalScoringUpperBound.totalPoints} points = ${c.theoreticalScoringUpperBound.basePoints} base + ${c.theoreticalScoringUpperBound.bonusPoints} bonus`,
    `Utility: ${JSON.stringify(c.utility)}`,
    `Rectangles: considered=${search.consideredRectangles} valid=${search.validCandidates} scoring=${search.scoringCandidates} obstructed=${search.obstructedCandidates} search-skipped=${search.skippedBySearchLimits}; pool=${search.poolLimit}`,
    ...Object.entries(report.rankings).map(([view, candidates]) => `${view}: ${candidates.map((candidate) => `${candidate.id} points=${candidate.potentialPoints} fence=${candidate.perimeterCellCount} ratio=${decimal(candidate.opportunityEfficiency)}`).join('; ') || 'none'}`),
    `Pareto candidates=${report.pareto.candidateCount}; best efficiency=${decimal(report.bestEfficiency)}`,
    `Greedy geometric portfolio estimate: ${portfolio.selected.length} rectangles; ${portfolio.combinedPotentialPoints} nonduplicated points; ${portfolio.distinctCoveredCells} cells; fence sum/union=${portfolio.rawSummedPerimeterDemand}/${portfolio.distinctFenceDemand}`,
    `Portfolio: ${portfolio.selected.map((item) => `${item.id} marginal=${item.marginalPotentialPoints}`).join('; ') || 'none'}; features=${JSON.stringify(portfolio.featureCoverage)}`,
    `Normalized: ${JSON.stringify(normalized)}`,
    `Point distribution: mean=${decimal(report.distributions.potentialPoints.mean)}, median=${decimal(report.distributions.potentialPoints.quantiles.p50)}; obstruction fraction=${decimal(report.obstructions.fractionOfConsidered)}`,
    'All coordinates are zero-based. Full fences are an approximation; word feasibility is unmeasured.'].join('\n');
}

export function main(args = process.argv.slice(2)) {
  const parsed = parseArguments(args);
  if (parsed.help) { process.stdout.write(`${HELP}\n`); return null; }
  const { command, configuration, analysisOptions, options } = parsed;
  const report = command === 'batch' ? analyzeBoardBatch(configuration, analysisOptions) : analyzeFarmBoard(configuration, analysisOptions);
  const output = options.json ? stableJson(report) : `${formatReport(command, report)}\n`;
  if (options.output) {
    const path = resolve(options.output);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, output);
  } else process.stdout.write(output);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
