import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeVocabulary } from '../src/analysis/vocabulary.js';
import { analyzeBag } from '../src/analysis/bag.js';
import { analyzeRack, parseRack } from '../src/analysis/rack.js';
import { analyzeSeed, analyzeBatch, sampleBaseline, DEFAULT_SAMPLE_COUNT, DEFAULT_BASELINE_SEED,
  DEFAULT_WINDOW_COUNT } from '../src/analysis/seeds.js';
import { SCHEMA_VERSION, METHOD_VERSION, measureFlexibility, compareWithBaseline, stableJson } from '../src/analysis/statistics.js';
import { loadAnalysisSource, buildAnalysisArtifact, loadBaseline, PROFILE_URL, NOTICE_URL } from './letter-analysis-source.js';

const HELP = `Usage: node scripts/analyze-letters.js <command> [value] [options]
  vocabulary                  Full-vocabulary and bag statistics
  rack AEIRSTN                 Physical rack (A–Z, ? for blanks)
  seed letter-seed             Opening rack and hypothetical remaining-bag windows
  batch                       Aggregate generated seeds, default count ${DEFAULT_SAMPLE_COUNT}
  baseline                    Sample independent 7/8/9-tile racks
  generate                    Write the versioned profile and derived-data notice

Options:
  --json                      Machine-readable deterministic JSON
  --output <file>             Write the report (e.g. .analysis-output/report.json)
  --samples <count>           Override baseline racks, default ${DEFAULT_SAMPLE_COUNT}
  --baseline-seed <text>      Default ${DEFAULT_BASELINE_SEED}
  --windows <count>           Evenly spaced remaining-bag windows, default ${DEFAULT_WINDOW_COUNT}
  --positions <7,50,93>       Explicit zero-based starts instead of --windows
  --count <count>             Batch seeds, default ${DEFAULT_SAMPLE_COUNT}
  --prefix <text>             Batch seeds <prefix>:<index>, default wordstead-3c1-batch
  --start <integer>           Batch sequence start, default 0
  --numeric                   Numeric seed / batch sequence; string seeds otherwise
  --allow-short               Rack diagnostics of zero to six tiles
  --check                     generate: compare bytes without writing
  --help                      Show this help
No timestamps, word dumps, gameplay changes or external services.`;

const flags = new Set(['json', 'allow-short', 'numeric', 'check', 'help']);
const values = new Set(['output', 'samples', 'baseline-seed', 'windows', 'positions', 'count', 'prefix', 'start']);
const allowedByCommand = {
  vocabulary: [], rack: ['allow-short', 'samples', 'baseline-seed'],
  seed: ['numeric', 'samples', 'baseline-seed', 'windows', 'positions'],
  batch: ['numeric', 'samples', 'baseline-seed', 'windows', 'positions', 'count', 'prefix', 'start'],
  baseline: ['samples', 'baseline-seed'], generate: ['samples', 'baseline-seed', 'check'],
};

export function parseArguments(args) {
  const options = {};
  const positional = [];
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
  const [command, input] = positional;
  if (!Object.hasOwn(allowedByCommand, command)) throw new Error('Choose vocabulary, rack, seed, batch, baseline or generate. Use --help.');
  const expected = command === 'rack' || command === 'seed' ? 2 : 1;
  if (positional.length !== expected) throw new Error(`Wrong number of inputs for ${command}. Use --help.`);
  const allowed = new Set([...allowedByCommand[command], 'json', ...(command === 'generate' ? [] : ['output'])]);
  for (const key of Object.keys(options)) if (!allowed.has(key)) throw new Error(`--${key} is not supported for ${command}.`);
  if (options.windows !== undefined && options.positions !== undefined) throw new Error('Choose --windows or --positions.');
  if (options.numeric && options.prefix !== undefined) throw new Error('Choose --numeric or --prefix.');
  for (const key of ['samples', 'windows', 'count', 'start']) {
    if (options[key] === undefined) continue;
    if (!/^-?\d+$/.test(options[key]) || !Number.isSafeInteger(Number(options[key]))
      || (key !== 'start' && Number(options[key]) < 0)) throw new Error(`Invalid integer: --${key}`);
    options[key] = Number(options[key]);
  }
  if (options.positions !== undefined) {
    if (!/^\d+(,\d+)*$/.test(options.positions)) throw new Error('Positions must be comma-separated integer starts.');
    options.positions = options.positions.split(',').map(Number);
  }
  let seed = input;
  if (command === 'seed' && options.numeric) {
    if (!input.trim() || !Number.isFinite(Number(input))) throw new Error('Numeric seed must be finite.');
    seed = Number(input);
  }
  return { command, input, seed, options };
}

const decimal = (value) => value === null || value === undefined ? 'unavailable' : value.toFixed(4);
function metricsText(metrics) {
  return metrics === null ? 'unavailable (no compatible sampled baseline for this rack size)'
    : Object.entries(metrics).map(([key, value]) => `${key}=${decimal(value)}`).join(' ');
}
function rackText(rack, metrics) {
  return `${rack.letters || '(empty)'}: ${rack.wordCount} distinct words; blanks=${rack.blankCount}; longest=${rack.longestWord ?? 'none'}\n`
    + `  By length: ${Object.entries(rack.byLength).map(([length, count]) => `${length}:${count}`).join(' ')}\n`
    + `  Initial/final letters: ${rack.distinctInitialLetters}/${rack.distinctFinalLetters}; lengths=${rack.coveredLengths.join(',') || 'none'}; `
    + `ordered pairs/triples=${rack.combinations.distinctPairs}/${rack.combinations.distinctTriples}\n  ${metricsText(metrics)}`;
}
function summaryText(label, summary) {
  const words = summary.wordCount;
  const overall = summary.flexibility.overall;
  return `${label} (${summary.sampleCount} samples): words mean=${decimal(words.mean)} median=${decimal(words.quantiles.p50)}; `
    + `overall mean=${decimal(overall.mean)} SD=${decimal(overall.standardDeviation)}\n`
    + `  Overall quantiles: ${Object.entries(overall.quantiles).map(([key, value]) => `${key}=${decimal(value)}`).join(' ')}\n`
    + `  Words by length (mean/median): ${Object.entries(summary.byLength).map(([length, value]) =>
      `${length}:${decimal(value.mean)}/${decimal(value.quantiles.p50)}`).join(' ')}`;
}

export function formatReport(command, report) {
  if (command === 'rack') return rackText(report.rack, report.flexibility);
  if (command === 'seed') return [`Seed: ${JSON.stringify(report.seed)}`, rackText(report.opening.rack, report.opening.flexibility),
    `Opening baseline comparison: ${JSON.stringify(report.opening.baselineComparison)}`,
    report.potentialDraws.interpretation, ...report.potentialDraws.samples.map((sample) =>
      `  ${sample.phase} [${sample.start},${sample.endExclusive}): ${sample.rack.letters} words=${sample.rack.wordCount} overall=${decimal(sample.flexibility?.overall)}`),
    ...Object.entries(report.potentialDraws.phases).map(([phase, summary]) => summaryText(phase, summary))].join('\n');
  if (command === 'batch') return [summaryText('Openings', report.opening), summaryText('Potential draws (pooled)', report.potentialDraws.pooled),
    ...Object.entries(report.potentialDraws.phases).map(([phase, summary]) => summaryText(phase, summary)),
    `Opening outliers: ${JSON.stringify(report.openingOutliers)}`,
    `Potential-draw outliers: ${JSON.stringify(report.potentialDraws.outliers)}`].join('\n');
  if (command === 'baseline') return Object.entries(report.capacities).map(([capacity, summary]) => summaryText(`Capacity ${capacity}`, summary)).join('\n');
  if (command === 'generate') return `Verified/generated schema ${report.schemaVersion}, ${report.source.id}; ${report.vocabulary.totalWords} words.`;
  const { vocabulary, bag } = report;
  return [`Vocabulary ${report.source.id}: ${vocabulary.totalWords} entries (dictionary counts, not corpus usage).`,
    'Length: count / percent / cumulative', ...vocabulary.byLength.map((profile) =>
      `${profile.length}: ${profile.wordCount} / ${profile.percentage.toFixed(4)}% / ${profile.cumulativeCount}`),
    `Length ranges: ${JSON.stringify(vocabulary.lengthRanges)}`,
    `Bag: ${bag.totalTiles} physical tiles, ${bag.blankCount} blanks (${bag.blankFraction * 100}%)`,
    'Letter: occurrences / containing words / repeated-letter words / dictionary share / physical count / normalized availability',
    ...bag.letters.map((entry, index) => `${entry.letter}: ${vocabulary.groups.all.occurrences[index] ?? '-'} / `
      + `${vocabulary.groups.all.wordPresence[index] ?? '-'} / ${vocabulary.groups.all.repeatedLetterWords[index] ?? '-'} / `
      + `${decimal(entry.dictionaryShare)} / ${entry.count} / ${decimal(entry.availabilityRatio)}`),
    `Top ordered pairs: ${vocabulary.combinations.pairs.map(({ text, count }) => `${text}:${count}`).join(' ')}`,
    `Top ordered triples: ${vocabulary.combinations.triples.map(({ text, count }) => `${text}:${count}`).join(' ')}`,
    `First letters (A–Z): ${vocabulary.groups.all.firstLetters.join(',')}`,
    `Final letters (A–Z): ${vocabulary.groups.all.finalLetters.join(',')}`,
    `Words with repeated letters: ${vocabulary.groups.all.wordsWithRepeatedLetters}; adjacent repeats: ${vocabulary.groups.all.wordsWithAdjacentRepeat}`,
    'Vowel count histograms by word length (index = AEIOU occurrences, Y excluded):',
    ...vocabulary.byLength.filter((profile) => profile.wordCount).map((profile) => `${profile.length}: ${profile.vowelCounts.join(',')}`)].join('\n');
}

export function main(args = process.argv.slice(2)) {
  const parsed = parseArguments(args);
  if (parsed.help) { process.stdout.write(`${HELP}\n`); return; }
  const { command, input, seed, options } = parsed;
  // Reject malformed racks before reading/preparing the real vocabulary.
  const tiles = command === 'rack' ? parseRack(input, { allowShort: options['allow-short'] }) : null;
  const source = loadAnalysisSource();
  const baselineOptions = { sampleCount: options.samples ?? DEFAULT_SAMPLE_COUNT,
    seed: options['baseline-seed'] ?? DEFAULT_BASELINE_SEED };
  let report;
  if (command === 'generate') {
    const { profile, notice } = buildAnalysisArtifact(source, baselineOptions);
    for (const [url, contents] of [[PROFILE_URL, stableJson(profile)], [NOTICE_URL, notice]]) {
      if (options.check) {
        if (readFileSync(url, 'utf8') !== contents) throw new Error(`Generated analysis differs: ${fileURLToPath(url)}`);
      } else {
        mkdirSync(dirname(fileURLToPath(url)), { recursive: true });
        writeFileSync(url, contents);
      }
    }
    report = profile;
  } else if (command === 'vocabulary') {
    const vocabulary = analyzeVocabulary(source.words);
    report = { schemaVersion: SCHEMA_VERSION, methodVersion: METHOD_VERSION,
      source: { id: source.prepared.identity.vocabularyId, sha256: source.prepared.identity.vocabularySha256 },
      vocabulary, bag: analyzeBag(vocabulary) };
  } else {
    const baseline = command === 'baseline' || options.samples !== undefined || options['baseline-seed'] !== undefined
      ? sampleBaseline(source.prepared, baselineOptions) : loadBaseline(source.prepared);
    const windowOptions = { sampleCount: options.windows ?? DEFAULT_WINDOW_COUNT, positions: options.positions };
    if (command === 'baseline') report = baseline;
    if (command === 'rack') {
      const rack = analyzeRack(tiles, source.prepared, { allowShort: options['allow-short'] });
      const flexibility = measureFlexibility(rack, baseline);
      report = { schemaVersion: SCHEMA_VERSION, methodVersion: METHOD_VERSION, rack, flexibility,
        baselineComparison: compareWithBaseline(flexibility, baseline, rack.rackSize) };
    }
    if (command === 'seed') report = analyzeSeed(seed, source.prepared, baseline, windowOptions);
    if (command === 'batch') report = analyzeBatch(source.prepared, baseline, { ...windowOptions,
      count: options.count ?? DEFAULT_SAMPLE_COUNT, prefix: options.prefix, start: options.start, numeric: options.numeric });
  }
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
