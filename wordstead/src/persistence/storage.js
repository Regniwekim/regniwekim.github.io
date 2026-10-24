import { SAVE_LIMITS, restoreSave, serializeSave } from './history.js';

export const STORAGE_KEYS = Object.freeze({ daily: 'wordstead.save.daily.v1', free: 'wordstead.save.free.v1' });
const warning = 'Saving unavailable. Progress may not be preserved. You can keep playing.';

/** Browser adapter with injected access/token functions. No storage access occurs at import time. */
export function createSaveSlot({ mode, dictionary, getStorage, token, keyPrefix = '' }) {
  if (!STORAGE_KEYS[mode]) throw new TypeError('Unknown Wordstead save slot.');
  const key = keyPrefix + STORAGE_KEYS[mode];
  let expected; // Exact observed bytes, not a claimed timestamp or numeric ordering.
  let info = { kind: 'empty', message: 'Progress stays on this browser and device.' };
  const conflict = () => { info = { kind: 'conflict', message: 'Another tab changed this save. Local autosaving is paused. Reload the saved version or explicitly replace it with this run.' }; };
  const unavailable = () => { info = { kind: 'unavailable', message: warning }; };
  function read() { return getStorage().getItem(key); }
  function load() {
    let raw;
    try { raw = read(); } catch { unavailable(); return null; }
    expected = raw;
    try {
      if (raw === null) { info = { kind: 'empty', message: 'No local progress yet.' }; return null; }
      if (raw.length > SAVE_LIMITS.characters) throw new Error('Saved payload exceeds the local size limit.');
      let envelope;
      try { envelope = JSON.parse(raw); } catch { throw new Error('Saved data is not valid JSON.'); }
      if (!envelope || Object.keys(envelope).length !== 2 || typeof envelope.revision !== 'string'
        || envelope.revision.length < 1 || envelope.revision.length > 100 || !envelope.save) throw new Error('Malformed save envelope.');
      const result = restoreSave(envelope.save, mode, dictionary);
      info = { kind: 'restored', message: 'Restored previous progress. Saved on this browser and device.' };
      return result;
    } catch (error) {
      info = { kind: 'invalid', message: `Save could not be restored: ${error.message} Your stored save is kept until you choose to discard it.` };
      return null;
    }
  }
  function changed() {
    try { if (read() !== expected) conflict(); } catch { unavailable(); }
  }
  function write(save) {
    if (['invalid', 'conflict'].includes(info.kind)) return false;
    try {
      const current = read();
      if (current !== (expected ?? null)) { conflict(); return false; }
      // Serialization and storage exceptions never interrupt a gameplay transition.
      const saved = serializeSave(save);
      const revision = token();
      if (typeof revision !== 'string' || revision.length < 1 || revision.length > 100) throw new Error('Invalid write token');
      const raw = `{"revision":${JSON.stringify(revision)},"save":${saved}}`;
      if (raw.length > SAVE_LIMITS.characters) throw new Error('Save size limit');
      getStorage().setItem(key, raw);
      expected = raw;
      info = { kind: 'saved', message: 'Progress saved locally on this browser and device.' };
      return true;
    } catch { unavailable(); return false; }
  }
  // Confirmation captures the current bytes. Another change while the dialog is open cancels replacement.
  function replacementToken() {
    try { return { raw: read() }; } catch { unavailable(); return null; }
  }
  function replace(save, approval) {
    if (!approval) return false;
    try {
      if (read() !== approval.raw) { conflict(); return false; }
      expected = approval.raw;
      info = { kind: 'empty', message: '' };
      return write(save);
    } catch { unavailable(); return false; }
  }
  function discard(approval) {
    if (!approval) return false;
    try {
      if (read() !== approval.raw) { conflict(); return false; }
      getStorage().removeItem(key);
      expected = null;
      info = { kind: 'empty', message: 'Unusable save discarded. This mode can save again.' };
      return true;
    } catch { unavailable(); return false; }
  }
  return { key, load, write, changed, replacementToken, replace, discard, get info() { return info; } };
}
