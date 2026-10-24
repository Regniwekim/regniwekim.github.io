import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { estimateAutomaticTarget } from '../src/analysis/automatic-target.js';
import { stableJson } from '../src/analysis/statistics.js';
import { evaluateTargetMatrix, evaluateLexicon, investigateInputs } from './target-calibration.js';

const HELP = `Usage: node scripts/analyze-targets.js [target|batch|lexical|investigate] [options]
Experimental analytical targets, not a solver or measured human difficulty.
  target: --rows <1-30> --columns <1-30> --seed <text> --farm-seed <text>
          --numeric (both supplied seeds are numbers) --density <0-1>
          --weights crop:4,livestock:2,building:2,fertile:3
  batch: full 6-size × 3-density × independent farm/letter seed matrix
         --count <positive integer, default 32> --letter-count <positive, default 16>
         --prefix <text, default wordstead-3c3-calibration-v1> --start <integer, default 0>
  lexical: held-out reference comparison, --count (default 2000), --prefix, --start
  investigate: unrestricted vs bounded and 128/1024 pools, --count (default 16), --prefix, --start
  --json       Stable versioned JSON; no timestamps, timing or memory observations
  --output <file>  Write report (keep large reports in ignored .analysis-output/)
  --timing     Write elapsed time/process memory to stderr, separately from deterministic JSON
  --help`;
const flags = new Set(['numeric', 'json', 'timing', 'help']);
const values = new Set(['rows', 'columns', 'seed', 'farm-seed', 'density', 'weights', 'count', 'letter-count', 'prefix', 'start', 'output']);

export function parseArguments(args) {
  const options = {}, positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) { positional.push(args[i]); continue; }
    const key = args[i].slice(2);
    if ((!flags.has(key) && !values.has(key)) || Object.hasOwn(options, key)) throw new Error(`Unknown or duplicate option: --${key}`);
    if (flags.has(key)) options[key] = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: --${key}`);
      options[key] = value;
    }
  }
  if (options.help) return { help: true };
  const command = positional[0] ?? 'target';
  if (positional.length > 1 || !['target', 'batch', 'lexical', 'investigate'].includes(command)) throw new Error('Choose target, batch, lexical or investigate.');
  const applicable = command === 'target' ? ['rows', 'columns', 'seed', 'farm-seed', 'density', 'weights', 'numeric']
    : ['count', 'prefix', 'start', ...(command === 'batch' ? ['letter-count'] : [])];
  for (const key of Object.keys(options)) if (!['json', 'output', 'timing'].includes(key) && !applicable.includes(key)) throw new Error(`--${key} is not supported for ${command}.`);
  for (const key of ['rows', 'columns', 'count', 'letter-count', 'start']) if (options[key] !== undefined) {
    if (!/^-?\d+$/.test(options[key]) || !Number.isSafeInteger(Number(options[key]))) throw new Error(`Invalid integer: --${key}`);
    options[key] = Number(options[key]);
    if (key !== 'start' && options[key] < 1) throw new Error(`--${key} must be positive.`);
    if (['rows', 'columns'].includes(key) && options[key] > 30) throw new Error('Board dimensions must be 1–30.');
  }
  if (options.density !== undefined) {
    options.density = Number(options.density);
    if (!Number.isFinite(options.density) || options.density < 0 || options.density > 1) throw new Error('Density must be 0–1.');
  }
  if (options.numeric) {
    if (options.seed === undefined && options['farm-seed'] === undefined) throw new Error('--numeric requires an explicit seed.');
    for (const key of ['seed', 'farm-seed']) if (options[key] !== undefined) {
      if (!options[key].trim() || !Number.isFinite(Number(options[key]))) throw new Error('Numeric seeds must be finite.');
      options[key] = Number(options[key]);
    }
  }
  if (options.weights !== undefined) {
    const weights = {};
    for (const entry of options.weights.split(',')) {
      const [type, value, extra] = entry.split(':');
      if (!['crop', 'livestock', 'building', 'fertile'].includes(type) || Object.hasOwn(weights, type)
        || extra !== undefined || !value?.trim() || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('Invalid feature weights.');
      weights[type] = Number(value);
    }
    if (Object.keys(weights).length !== 4 || !(Object.values(weights).reduce((a, b) => a + b, 0) > 0)) throw new Error('Supply all four weights and a positive total.');
    options.weights = weights;
  }
  if (options.prefix !== undefined && !options.prefix.trim()) throw new Error('Prefix must be nonempty.');
  const count = options.count ?? (command === 'lexical' ? 2000 : command === 'investigate' ? 16 : 32);
  if (!Number.isSafeInteger((options.start ?? 0) + count) || !Number.isSafeInteger((options.start ?? 0) + (options['letter-count'] ?? 16))) throw new Error('Seed range exceeds safe integers.');
  return { command, options };
}

export function main(args) {
  const parsed = parseArguments(args);
  if (parsed.help) { console.log(HELP); return; }
  const { command, options: o } = parsed, started = performance.now();
  const common = Object.fromEntries(['count', 'prefix', 'start'].filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
  const report = command === 'target' ? estimateAutomaticTarget({
    ...Object.fromEntries(['rows', 'columns', 'seed'].filter((k) => o[k] !== undefined).map((k) => [k, o[k]])),
    ...(o['farm-seed'] !== undefined ? { farmSeed: o['farm-seed'] } : {}),
    ...(o.density !== undefined ? { farmDensity: o.density } : {}), ...(o.weights ? { farmWeights: o.weights } : {}) })
    : { schemaVersion: 1, methodVersion: 'auto-target-v1', command,
      ...(command === 'batch' ? evaluateTargetMatrix({ ...common, ...(o['letter-count'] ? { letterCount: o['letter-count'] } : {}) })
        : command === 'lexical' ? evaluateLexicon(common) : investigateInputs(common)) };
  const rendered = o.json ? stableJson(report) : command === 'target'
    ? `${report.methodVersion}: ${report.available ? `${report.target} farm points (experimental)\nBoard opportunity ${report.board.opportunity.toFixed(3)}, bound ${report.board.theoreticalUpperBound}; letter multiplier ${report.letters.multiplier.toFixed(4)}\n${report.inputs.boardMethod} / ${report.inputs.letterMethod} / ${report.inputs.vocabularyId}` : report.message}\n`
    : command === 'batch' ? `${report.methodVersion}: ${report.count} estimates; ${report.unavailablePercent.toFixed(2)}% unavailable\n`
      + report.byConfiguration.map((r) => `${r.rows}×${r.columns} density ${r.density}: mean ${r.targets.mean?.toFixed(3)}, p05 ${r.targets.quantiles.p05}, p95 ${r.targets.quantiles.p95}, range ${r.targets.quantiles.p0}–${r.targets.quantiles.p100}`).join('\n') + '\n'
      : command === 'lexical' ? `Held-out ${report.sampling.count} seeds; overall MAE ${report.metrics.overall.meanAbsoluteError.toFixed(5)}; multiplier MAE ${report.multiplier.meanAbsoluteError.toFixed(5)}\nDefault-board target changes ${report.defaultBoardTargetComparison.changedTargets}/${report.defaultBoardTargetComparison.count}, maximum difference ${report.defaultBoardTargetComparison.maximumTargetDifference}\n`
        : report.observations.map((r) => `${r.rows}×${r.columns} density ${r.density}: unrestricted ${r.metrics.unrestrictedBest.mean.toFixed(2)}, cap28 ${r.metrics.best28.mean.toFixed(2)}, compact opportunity ${r.metrics.opportunity.mean.toFixed(2)}, pool delta ${r.metrics.portfolioDifference.mean.toFixed(2)}`).join('\n') + '\n';
  if (o.output) { const path = resolve(o.output); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, rendered); }
  else process.stdout.write(rendered);
  if (o.timing) console.error(`Elapsed ${(performance.now() - started).toFixed(2)} ms; RSS ${(process.memoryUsage().rss / 1048576).toFixed(2)} MiB; peak ${(process.resourceUsage().maxRSS / 1024).toFixed(2)} MiB.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
