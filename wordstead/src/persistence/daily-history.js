import { getSessionResults } from '../core/results.js';
import { getStrokes } from '../core/session.js';
import { DAILY_FORMAT, DAILY_RULES } from '../daily/challenge.js';
import { validateDailyDate } from '../daily/date.js';

export const HISTORY_SCHEMA = 1;
// About eleven years, including distinct format identities. Never prune old results.
export const HISTORY_LIMITS = Object.freeze({ records: 4096, characters: 2097152 });
const fields = ['schemaVersion', 'date', 'formatVersion', 'rulesVersion', 'status', 'totalPoints',
  'target', 'basePoints', 'cropPoints', 'fertilityPoints', 'wordCount', 'exchangeCount',
  'freeExchangesUsed', 'chargedExchanges', 'strokes', 'captured'];
const captures = ['crops', 'fertile', 'livestock', 'buildings'];
const shape = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const check = (condition, message) => { if (!condition) throw new Error(message); };
const count = (n, maximum) => Number.isSafeInteger(n) && n >= 0 && n <= maximum;
export const historyIdentity = (record) => `${record.date}/${record.formatVersion}`;
const order = (a, b) => historyIdentity(a) < historyIdentity(b) ? -1 : historyIdentity(a) > historyIdentity(b) ? 1 : 0;
export const createDailyHistory = () => ({ schemaVersion: HISTORY_SCHEMA, records: [] });

/** Bounded summary validation, not proof of an attempt or a replayable game. */
export function validateHistoryRecord(record) {
  check(shape(record, fields), 'Malformed Daily result.');
  check(record.schemaVersion === HISTORY_SCHEMA, 'Unsupported result schema version.');
  validateDailyDate(record.date);
  check(typeof record.formatVersion === 'string' && /^wordstead-daily-v[1-9]\d{0,3}$/.test(record.formatVersion),
    'Invalid Daily format version.');
  check(record.rulesVersion === DAILY_RULES.gameplay, 'Incompatible history scoring rules.');
  check(['won', 'ended', 'exhausted'].includes(record.status), 'Invalid terminal result status.');
  check(['totalPoints', 'target', 'basePoints', 'cropPoints', 'fertilityPoints'].every((key) => count(record[key], 4500))
    && record.target > 0, 'Invalid farm points or target.');
  check(count(record.wordCount, 100) && count(record.exchangeCount, 1000000)
    && count(record.freeExchangesUsed, 900) && count(record.chargedExchanges, 1000000)
    && count(record.strokes, 1000100), 'Invalid word, exchange or stroke count.');
  check(shape(record.captured, captures) && captures.every((key) => count(record.captured[key], 900)),
    'Invalid captured farm features.');
  check(record.basePoints <= 900 && Object.values(record.captured).reduce((a, b) => a + b, 0) <= record.basePoints
    && record.cropPoints === record.captured.crops * 3 && record.fertilityPoints === record.captured.fertile
    && record.totalPoints === record.basePoints + record.cropPoints + record.fertilityPoints,
  'Inconsistent farm points or captures.');
  check(record.freeExchangesUsed <= record.exchangeCount && record.freeExchangesUsed <= record.captured.buildings
    && record.chargedExchanges === record.exchangeCount - record.freeExchangesUsed
    && record.strokes === record.wordCount + record.chargedExchanges, 'Inconsistent exchange or stroke accounting.');
  check((record.status === 'won') === (record.totalPoints >= record.target), 'Result status disagrees with target.');
  check(record.wordCount > 0 || (record.totalPoints === 0 && record.status !== 'exhausted'),
    'Points and exhaustion require accepted words.');
  return record;
}

/** Called only for an authoritative production Daily session, after an accepted action. */
export function createHistoryRecord(session) {
  if (!session?.daily || session.source !== 'seeded') return null;
  const results = getSessionResults(session);
  if (!results) return null;
  check(session.daily.formatVersion === DAILY_FORMAT && session.daily.rules?.gameplay === DAILY_RULES.gameplay,
    'Unsupported production Daily identity.');
  const record = { schemaVersion: HISTORY_SCHEMA, date: results.daily.date,
    formatVersion: results.daily.formatVersion, rulesVersion: session.daily.rules.gameplay,
    status: results.status, totalPoints: results.totalPoints, target: results.target,
    basePoints: results.basePoints, cropPoints: results.cropPoints, fertilityPoints: results.fertilityPoints,
    wordCount: results.wordCount, exchangeCount: results.exchangeCount, freeExchangesUsed: results.freeExchangesUsed,
    chargedExchanges: results.chargedExchanges, strokes: getStrokes(session), captured: { ...results.captured } };
  return validateHistoryRecord(record);
}

export function validateDailyHistory(archive) {
  check(shape(archive, ['schemaVersion', 'records']), 'Malformed Daily history archive.');
  check(archive.schemaVersion === HISTORY_SCHEMA, 'Unsupported history schema version.');
  check(Array.isArray(archive.records) && archive.records.length <= HISTORY_LIMITS.records, 'Daily history record limit reached.');
  const seen = new Set();
  for (const record of archive.records) {
    validateHistoryRecord(record);
    const id = historyIdentity(record);
    check(!seen.has(id), 'Duplicate Daily challenge identity.');
    seen.add(id);
  }
  return archive;
}

/** One primary result per date/format. Preserve the original recorded completion. */
export function recordDailyResult(archive, record) {
  validateDailyHistory(archive);
  validateHistoryRecord(record);
  const previous = archive.records.find((item) => historyIdentity(item) === historyIdentity(record));
  if (previous?.status === 'won') return archive;
  const records = archive.records.filter((item) => historyIdentity(item) !== historyIdentity(record));
  records.push({ ...record, captured: { ...record.captured } });
  return validateDailyHistory({ schemaVersion: HISTORY_SCHEMA, records: records.sort(order) });
}

export function serializeDailyHistory(archive) {
  validateDailyHistory(archive);
  const raw = JSON.stringify({ schemaVersion: HISTORY_SCHEMA, records: [...archive.records].sort(order) });
  check(raw.length <= HISTORY_LIMITS.characters, 'Daily history payload limit reached. Existing history is kept.');
  return raw;
}

export function parseDailyHistory(raw) {
  check(typeof raw === 'string' && raw.length <= HISTORY_LIMITS.characters, 'Daily history payload is too large.');
  let archive;
  try { archive = JSON.parse(raw); } catch { throw new Error('Daily history is not valid JSON.'); }
  validateDailyHistory(archive);
  return { schemaVersion: HISTORY_SCHEMA, records: [...archive.records].sort(order) };
}

/** Totals are always derived from records; a missing day supplies no denominator. */
export function getHistoryStatistics(archive) {
  validateDailyHistory(archive);
  const completed = archive.records.filter((record) => record.status === 'won');
  const sum = (metric) => completed.reduce((total, record) => total + metric(record), 0);
  const words = sum((r) => r.wordCount), strokes = sum((r) => r.strokes);
  return { completed: completed.length, unfinished: archive.records.length - completed.length,
    words, averageWords: completed.length ? words / completed.length : null,
    strokes, averageStrokes: completed.length ? strokes / completed.length : null,
    points: sum((r) => r.totalPoints), features: sum((r) => Object.values(r.captured).reduce((a, b) => a + b, 0)) };
}
