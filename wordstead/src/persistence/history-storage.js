import { createDailyHistory, parseDailyHistory, serializeDailyHistory, recordDailyResult } from './daily-history.js';

export const HISTORY_KEY = 'wordstead.history.daily.v1';

/** Independent, injected storage. Compare exact bytes before writes/deletion; never merge. */
export function createHistoryStorage({ getStorage, keyPrefix = '' }) {
  const key = keyPrefix + HISTORY_KEY;
  let expected;
  let archive = createDailyHistory();
  let info = { kind: 'empty', message: 'No Daily results recorded yet.' };
  const conflict = () => { info = { kind: 'conflict', message: 'Another tab changed Daily history. Reload stored history before saving another result. Active saves are unaffected.' }; };
  const unavailable = () => { info = { kind: 'unavailable', message: 'Daily history storage is unavailable or full. Existing history is kept. You can keep playing; reload history and retry saving the terminal result.' }; };
  const read = () => getStorage().getItem(key);
  function load() {
    let raw;
    try { raw = read(); } catch { unavailable(); return false; }
    expected = raw;
    try {
      archive = raw === null ? createDailyHistory() : parseDailyHistory(raw);
      info = { kind: raw === null ? 'empty' : 'loaded', message: raw === null ? 'No Daily results recorded yet.' : 'Daily history loaded from this browser.' };
      return true;
    } catch (error) {
      // Keep original bytes; do not publish a partial/empty replacement on failure.
      info = { kind: 'invalid', message: `Daily history could not be loaded: ${error.message} Stored history is kept until you explicitly clear it. Active saves are unaffected.` };
      return false;
    }
  }
  function changed() {
    try { if (read() !== expected) conflict(); } catch { unavailable(); }
  }
  function write(record) {
    if (['invalid', 'conflict'].includes(info.kind) || expected === undefined) return false;
    try {
      if (read() !== expected) { conflict(); return false; }
      const next = recordDailyResult(archive, record);
      const raw = serializeDailyHistory(next);
      // Idempotent retries make no storage call, including preserved completions.
      if (raw !== expected) getStorage().setItem(key, raw);
      archive = next;
      expected = raw;
      info = { kind: 'saved', message: 'Daily result saved locally. An existing completion keeps its original statistics.' };
      return true;
    } catch (error) {
      if (/limit/.test(error.message)) info = { kind: 'full', message: `${error.message} No old results were removed. Additional results could not be saved.` };
      else unavailable();
      return false;
    }
  }
  function deletionToken() {
    try { return { raw: read() }; } catch { unavailable(); return null; }
  }
  function clear(approval) {
    if (!approval) return false;
    try {
      if (read() !== approval.raw) { conflict(); return false; }
      getStorage().removeItem(key);
      expected = null;
      archive = createDailyHistory();
      info = { kind: 'empty', message: 'Daily history cleared. Active saves and the current board are kept. A terminal run can be added again using Save to Daily History.' };
      return true;
    } catch { unavailable(); return false; }
  }
  return { key, load, write, changed, deletionToken, clear,
    get archive() { return archive; }, get info() { return info; } };
}
