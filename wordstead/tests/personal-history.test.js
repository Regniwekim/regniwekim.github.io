import test from 'node:test';
import assert from 'node:assert/strict';
import { createDailyHistory, createHistoryRecord, recordDailyResult, getHistoryStatistics,
  validateHistoryRecord, parseDailyHistory, serializeDailyHistory, HISTORY_LIMITS } from '../src/persistence/daily-history.js';
import { createHistoryStorage, HISTORY_KEY } from '../src/persistence/history-storage.js';
import { createHistoryMonth, shiftHistoryMonth, historyDateRecords } from '../src/daily/calendar.js';
import { createDailySession, DAILY_RULES } from '../src/daily/challenge.js';
import { endSession, createSession, commitSessionWord } from '../src/core/session.js';
import { createEnclosureSession } from '../src/core/session-fixture.js';
import { STORAGE_KEYS } from '../src/persistence/storage.js';

const record = (date = '2024-02-29', overrides = {}) => ({ schemaVersion: 1, date,
  formatVersion: 'wordstead-daily-v1', rulesVersion: DAILY_RULES.gameplay, status: 'won',
  totalPoints: 16, target: 12, basePoints: 12, cropPoints: 3, fertilityPoints: 1,
  wordCount: 4, exchangeCount: 3, freeExchangesUsed: 1, chargedExchanges: 2, strokes: 6,
  captured: { crops: 1, fertile: 1, livestock: 2, buildings: 1 }, ...overrides });
const unsuccessful = (date, status = 'ended') => record(date, { status, totalPoints: 0,
  basePoints: 0, cropPoints: 0, fertilityPoints: 0, exchangeCount: 0, freeExchangesUsed: 0,
  chargedExchanges: 0, strokes: 4, captured: { crops: 0, fertile: 0, livestock: 0, buildings: 0 } });
const add = (records) => records.reduce(recordDailyResult, createDailyHistory());
function adapter() {
  const data = new Map(), writes = [];
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => {
    writes.push(key); data.set(key, value);
  }, removeItem: (key) => data.delete(key) };
  const slot = () => createHistoryStorage({ getStorage: () => storage });
  return { data, writes, storage, slot };
}

test('empty archive and completed summary roundtrip; no gameplay payload or lifetime totals', () => {
  const empty = createDailyHistory();
  assert.deepEqual(parseDailyHistory(serializeDailyHistory(empty)), empty);
  const one = add([record()]);
  assert.deepEqual(parseDailyHistory(serializeDailyHistory(one)), one);
  assert.deepEqual(Object.keys(one), ['schemaVersion', 'records']);
  assert.doesNotMatch(serializeDailyHistory(one), /tileId|placements|actions|draft|dictionary|bag|board|seed/);
  const before = JSON.stringify(one);
  Object.freeze(one.records[0].captured); Object.freeze(one.records[0]); Object.freeze(one.records); Object.freeze(one);
  const next = recordDailyResult(one, record('2024-03-01'));
  assert.equal(JSON.stringify(one), before); assert.equal(next.records.length, 2);
});

test('retry retention preserves original recorded completion without claiming first attempt or best score', () => {
  let archive = add([unsuccessful('2024-02-29')]);
  archive = recordDailyResult(archive, unsuccessful('2024-02-29', 'exhausted'));
  assert.equal(archive.records.length, 1); assert.equal(archive.records[0].status, 'exhausted');
  archive = recordDailyResult(archive, record());
  const completed = archive;
  assert.equal(recordDailyResult(archive, record()), completed);
  assert.equal(recordDailyResult(archive, unsuccessful('2024-02-29')), completed);
  assert.equal(recordDailyResult(archive, record('2024-02-29', { wordCount: 3, strokes: 5 })), completed);
  assert.equal(archive.records[0].wordCount, 4);
  assert.equal(getHistoryStatistics(archive).completed, 1);
});

test('canonical ordering and identities cross years, months, leap day and format versions', () => {
  const archive = add(['2024-03-01', '2024-02-29', '2024-01-01', '2023-12-31'].map((date) => record(date))
    .concat(record('2024-02-29', { formatVersion: 'wordstead-daily-v2' })));
  assert.deepEqual(archive.records.map((r) => `${r.date}/${r.formatVersion}`), [
    '2023-12-31/wordstead-daily-v1', '2024-01-01/wordstead-daily-v1',
    '2024-02-29/wordstead-daily-v1', '2024-02-29/wordstead-daily-v2', '2024-03-01/wordstead-daily-v1']);
  assert.equal(historyDateRecords(archive.records, '2024-02-29').length, 2);
  assert.equal(historyDateRecords(archive.records, '2024-02-28').length, 0);
  const reverse = { ...archive, records: [...archive.records].reverse() };
  assert.equal(serializeDailyHistory(reverse), serializeDailyHistory(archive));
});

test('dates, exact shapes, versions, statuses, numeric bounds and accounting reject malformed results', () => {
  for (const date of ['2023-02-29', '1900-02-29', '2024-04-31', '0000-01-01', '2024-2-01', '', null]) {
    assert.throws(() => validateHistoryRecord(record(date)));
  }
  for (const value of [NaN, Infinity, -1, 1.2, Number.MAX_SAFE_INTEGER, '4', null]) {
    for (const key of ['totalPoints', 'target', 'basePoints', 'cropPoints', 'fertilityPoints', 'wordCount',
      'exchangeCount', 'freeExchangesUsed', 'chargedExchanges', 'strokes']) {
      assert.throws(() => validateHistoryRecord(record(undefined, { [key]: value })), `${key}: ${value}`);
    }
  }
  for (const changes of [{ schemaVersion: 2 }, { formatVersion: '<script>' }, { rulesVersion: 'future' },
    { status: 'playing' }, { extra: [] }, { captured: [] }, { captured: { crops: 1 } }, { strokes: 4 },
    { chargedExchanges: 3 }, { freeExchangesUsed: 4 }, { target: 17 }, { cropPoints: 4 },
    { wordCount: 0, strokes: 2 }, { basePoints: 0 }, { captured: { crops: 1, fertile: 1, livestock: -1, buildings: 1 } }]) {
    assert.throws(() => validateHistoryRecord(record(undefined, changes)));
  }
  assert.throws(() => parseDailyHistory('{bad'), /JSON/);
  assert.throws(() => parseDailyHistory(JSON.stringify({ schemaVersion: 2, records: [] })), /schema/);
  assert.throws(() => serializeDailyHistory({ schemaVersion: 1, records: [record(), record()] }), /Duplicate/);
});

test('terminal summaries derive from authoritative results and exclude active, Free Play and diagnostic runs', () => {
  const state = createDailySession('2026-10-23').session;
  assert.equal(createHistoryRecord(state), null);
  assert.equal(createHistoryRecord(endSession(createSession()).state), null);
  assert.equal(createHistoryRecord({ ...endSession(createEnclosureSession()).state, daily: state.daily }), null);
  const result = createHistoryRecord(endSession(state).state);
  assert.equal(result.date, '2026-10-23'); assert.equal(result.status, 'ended');
  assert.equal(result.strokes, 0); assert.equal(result.totalPoints, 0);
  assert.deepEqual(result.captured, { crops: 0, fertile: 0, livestock: 0, buildings: 0 });
});

test('controlled full-bag exhaustion produces the existing exhausted result and stroke accounting', () => {
  // Controlled dictionary/resource fixture, not an ordinary canonical Daily completion.
  const daily = createDailySession('2026-10-23').session.daily;
  let state = { ...createSession({ rows: 30, columns: 30, target: 999 }), daily }, row = 15;
  while (state.status === 'playing') {
    const result = commitSessionWord(state, { word: state.rack.map((tile) => tile.letter ?? 'A').join(''),
      row: row--, column: 15, orientation: 'horizontal' }, { has: () => true });
    assert.equal(result.accepted, true); state = result.state;
  }
  assert.equal(state.status, 'exhausted');
  const summary = createHistoryRecord(state);
  assert.equal(summary.status, 'exhausted'); assert.equal(summary.wordCount, 15);
  assert.equal(summary.strokes, 15); assert.equal(summary.exchangeCount, 0);
  const h = adapter(), slot = h.slot(); slot.load(); assert.equal(slot.write(summary), true);
  assert.equal(JSON.parse(h.storage.getItem(HISTORY_KEY)).records[0].status, 'exhausted');
  assert.equal(getHistoryStatistics(slot.archive).unfinished, 1);
});

test('factual statistics use completed records only, nullable averages and captured feature totals', () => {
  assert.deepEqual(getHistoryStatistics(createDailyHistory()), { completed: 0, unfinished: 0,
    words: 0, averageWords: null, strokes: 0, averageStrokes: null, points: 0, features: 0 });
  assert.deepEqual(getHistoryStatistics(add([record()])), { completed: 1, unfinished: 0,
    words: 4, averageWords: 4, strokes: 6, averageStrokes: 6, points: 16, features: 5 });
  const records = [record(), record('2025-12-31', { wordCount: 7, strokes: 7,
    exchangeCount: 0, freeExchangesUsed: 0, chargedExchanges: 0 }),
  unsuccessful('2024-03-01'), unsuccessful('2024-03-02', 'exhausted')];
  const stats = getHistoryStatistics(add(records));
  assert.deepEqual(stats, { completed: 2, unfinished: 2, words: 11, averageWords: 5.5,
    strokes: 13, averageStrokes: 6.5, points: 32, features: 10 });
  assert.deepEqual(getHistoryStatistics(add([...records, record(), unsuccessful('2024-02-29')])), stats);
  assert.equal(getHistoryStatistics(add([unsuccessful('2024-02-29')])).averageStrokes, null);
});

test('Gregorian calendar has UTC weekday alignment, leap centuries, all month lengths and neutral dates', () => {
  const february = createHistoryMonth('2024-02', [record(), unsuccessful('2024-02-28')]);
  assert.equal(february.label, 'February 2024');
  assert.equal(february.cells.findIndex((day) => day), 4); // Thursday
  assert.equal(february.cells.filter(Boolean).length, 29);
  assert.deepEqual(february.cells.find((day) => day?.day === 29), { date: '2024-02-29', day: 29, state: 'completed' });
  assert.equal(february.cells.find((day) => day?.day === 28).state, 'unfinished');
  assert.equal(february.cells.find((day) => day?.day === 1).state, 'empty');
  for (const [month, length] of [['2023-02', 28], ['1900-02', 28], ['2000-02', 29], ['2024-04', 30], ['2024-12', 31], ['0001-01', 31]]) {
    const model = createHistoryMonth(month);
    assert.equal(model.cells.filter(Boolean).length, length); assert.equal(model.cells.length % 7, 0);
  }
  assert.equal(createHistoryMonth('0001-01').cells.findIndex(Boolean), 1); // Monday, avoids Date.UTC 00–99 quirk
  assert.equal(createHistoryMonth('2023-12').cells.findIndex(Boolean), 5);
  assert.equal(createHistoryMonth('2024-01').cells.findIndex(Boolean), 1);
  assert.equal(shiftHistoryMonth('2023-12', 1), '2024-01');
  assert.equal(shiftHistoryMonth('2024-01', -1), '2023-12');
  assert.equal(shiftHistoryMonth('0001-01', -1), null); assert.equal(shiftHistoryMonth('9999-12', 1), null);
  assert.throws(() => createHistoryMonth('2024-13')); assert.throws(() => shiftHistoryMonth('2024-01', 1.2));
});

test('history storage is independently missing, loaded, idempotent and explicitly deleted', () => {
  const h = adapter(), slot = h.slot();
  h.storage.setItem(STORAGE_KEYS.daily, 'daily-save'); h.storage.setItem(STORAGE_KEYS.free, 'free-save');
  h.storage.setItem('unrelated', 'keep');
  assert.equal(slot.load(), true); assert.equal(slot.info.kind, 'empty');
  assert.equal(slot.write(record()), true); const raw = h.storage.getItem(HISTORY_KEY);
  const writes = h.writes.length;
  assert.equal(slot.write(record()), true); assert.equal(slot.write(unsuccessful('2024-02-29')), true);
  assert.equal(h.writes.length, writes); assert.equal(h.storage.getItem(HISTORY_KEY), raw);
  assert.equal(h.slot().load(), true);
  assert.equal(slot.clear(null), false); assert.equal(slot.clear(slot.deletionToken()), true);
  assert.equal(h.storage.getItem(HISTORY_KEY), null);
  assert.equal(h.storage.getItem(STORAGE_KEYS.daily), 'daily-save'); assert.equal(h.storage.getItem(STORAGE_KEYS.free), 'free-save');
  assert.equal(h.storage.getItem('unrelated'), 'keep'); assert.equal(slot.archive.records.length, 0);
});

test('corrupt, incompatible and oversized history is retained, never overwritten, until explicit clear', () => {
  const invalid = ['{broken', JSON.stringify({ schemaVersion: 2, records: [] }),
    JSON.stringify({ schemaVersion: 1, records: [{ ...record(), strokes: -1 }] }),
    JSON.stringify({ schemaVersion: 1, records: [record(undefined, { rulesVersion: 'future' })] }),
    ' '.repeat(HISTORY_LIMITS.characters + 1)];
  for (const raw of invalid) {
    const h = adapter(); h.storage.setItem(HISTORY_KEY, raw); const slot = h.slot();
    assert.equal(slot.load(), false); assert.equal(slot.info.kind, 'invalid');
    assert.equal(slot.write(record()), false); assert.equal(h.storage.getItem(HISTORY_KEY), raw);
    assert.equal(slot.clear(slot.deletionToken()), true); assert.equal(slot.write(record()), true);
  }
});

test('denied access, quota errors and size limits leave stored history intact and permit recovery', () => {
  const h = adapter(), slot = h.slot(); slot.load(); slot.write(record());
  const original = h.storage.getItem(HISTORY_KEY), read = h.storage.getItem, write = h.storage.setItem;
  h.storage.getItem = () => { throw new Error('denied'); };
  assert.equal(slot.load(), false); assert.equal(slot.info.kind, 'unavailable');
  assert.equal(slot.write(record('2024-03-01')), false); assert.equal(slot.deletionToken(), null);
  h.storage.getItem = read; assert.equal(h.storage.getItem(HISTORY_KEY), original);
  h.storage.setItem = () => { throw new Error('quota'); }; slot.load();
  assert.equal(slot.write(record('2024-03-01')), false); assert.equal(slot.info.kind, 'unavailable');
  assert.equal(h.storage.getItem(HISTORY_KEY), original); assert.equal(slot.archive.records.length, 1);
  h.storage.setItem = write; assert.equal(slot.write(record('2024-03-01')), true);
  const denied = createHistoryStorage({ getStorage() { throw new Error('denied'); } });
  assert.equal(denied.load(), false); assert.equal(denied.write(record()), false);
  // 4,096 distinct days fit the payload bound; a 4,097th never prunes legitimate results.
  const records = Array.from({ length: HISTORY_LIMITS.records }, (_, i) => record(new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10)));
  const full = { schemaVersion: 1, records };
  h.storage.setItem(HISTORY_KEY, serializeDailyHistory(full)); slot.load();
  const fullRaw = h.storage.getItem(HISTORY_KEY);
  assert.equal(slot.write(record('2026-10-23')), false); assert.equal(slot.info.kind, 'full');
  assert.equal(h.storage.getItem(HISTORY_KEY), fullRaw); assert.equal(slot.write(records[0]), true);
});

test('multi-tab events, missed events, removals and confirmation races stop stale history writes', () => {
  const h = adapter(), a = h.slot(), b = h.slot(); a.load(); b.load(); a.write(record());
  assert.equal(b.write(record('2024-03-01')), false); assert.equal(b.info.kind, 'conflict');
  assert.equal(b.load(), true); b.write(record('2024-03-01')); a.changed();
  assert.equal(a.info.kind, 'conflict'); assert.equal(a.write(record('2024-03-02')), false);
  a.load(); a.changed(); assert.notEqual(a.info.kind, 'conflict'); // Delayed event matches observed bytes.
  const approval = a.deletionToken(); b.write(record('2024-03-02'));
  assert.equal(a.clear(approval), false); assert.equal(a.info.kind, 'conflict');
  assert.equal(JSON.parse(h.storage.getItem(HISTORY_KEY)).records.length, 3);
  a.load(); b.load(); b.clear(b.deletionToken()); a.changed();
  assert.equal(a.info.kind, 'conflict'); assert.equal(a.write(record()), false); a.load();
  assert.equal(a.archive.records.length, 0);
});
