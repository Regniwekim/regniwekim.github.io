import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDictionary } from '../src/core/dictionary.js';
import { parseVocabulary } from '../src/vocabulary/format.js';
import { VOCABULARY } from '../src/vocabulary/manifest.js';
import { createTargetSession, restartTargetSession } from '../src/analysis/target-session.js';
import { createDailySession, restartDailySession } from '../src/daily/challenge.js';
import { commitSessionWord, evaluateSessionPlacement, exchangeTiles, endSession, getStrokes, getRackCapacity } from '../src/core/session.js';
import { createDraft, placeDraftTile, returnDraftTile, undoDraft, assignDraftBlank, evaluateDraft } from '../src/core/draft.js';
import { getSessionResults, formatResultsShare } from '../src/core/results.js';
import { getPuzzleScore } from '../src/core/features.js';
import { createEnclosureSession } from '../src/core/session-fixture.js';
import { createSave, appendAction, withDraft, wordAction, parseSave, serializeSave, restoreDraft, SAVE_LIMITS, hasProgress } from '../src/persistence/history.js';
import { createSaveSlot, STORAGE_KEYS } from '../src/persistence/storage.js';

const dictionary = createDictionary(parseVocabulary(readFileSync(new URL(`../vocabulary/${VOCABULARY.file}`, import.meta.url), 'utf8'), VOCABULARY));
const manual = (settings = {}) => createTargetSession({ targetMode: 'manual', target: 999, seed: 'save-test', ...settings }).session;
const move = (word, row, column, orientation = 'horizontal') => ({ word, row, column, orientation });
const roundtrip = (save) => {
  const result = parseSave(serializeSave(save), save.mode, dictionary);
  assert.equal(result.ok, true, result.message);
  return result;
};
function conserve(state) {
  const ids = [...state.rack, ...state.bag].map((tile) => tile.id)
    .concat(state.puzzle.board.cells.filter((cell) => cell?.kind === 'letter').map((cell) => cell.tileId));
  assert.equal(ids.length, 100);
  assert.equal(new Set(ids).size, 100);
}
function recorder(initial, mode = 'free') {
  let state = initial, save = createSave(mode, initial);
  function exchange(ids = state.rack.map((tile) => tile.id)) {
    const result = exchangeTiles(state, ids);
    assert.equal(result.accepted, true);
    state = result.state;
    save = appendAction(save, { type: 'exchange', tileIds: [...ids] });
    return result;
  }
  return {
    get state() { return state; }, get save() { return save; }, exchange,
    word(proposal) {
      // Fixed known-word observations, using normal exchanges to acquire resources; no scripted bag.
      let evaluation;
      for (let attempt = 0; attempt < 150; attempt++) {
        evaluation = evaluateSessionPlacement(state, proposal, dictionary);
        if (evaluation.legal) break;
        assert.equal(evaluation.reason.code, 'MISSING_RACK_LETTERS', evaluation.reason.message);
        const allocated = new Set(evaluation.rack.allocations.map(({ tile }) => tile.id));
        exchange(state.rack.filter((tile) => !allocated.has(tile.id)).map((tile) => tile.id));
      }
      const result = commitSessionWord(state, proposal, dictionary);
      assert.equal(result.accepted, true, result.evaluation.reason?.message);
      state = result.state; save = appendAction(save, wordAction(result)); conserve(state);
      return result;
    },
    end() { state = endSession(state).state; save = appendAction(save, { type: 'end' }); },
    check() {
      const restored = roundtrip(save);
      assert.deepEqual(restored.state, state);
      assert.equal(getStrokes(restored.state), getStrokes(state));
      assert.deepEqual(getSessionResults(restored.state), getSessionResults(state));
      conserve(restored.state);
    },
  };
}

test('fresh Daily, automatic Free Play and exact manual configurations roundtrip without derived snapshots', () => {
  for (const [mode, state] of [['daily', createDailySession('2026-10-23').session],
    ['free', createTargetSession({ farmSeed: 'automatic-save', seed: 42 }).session],
    ['free', manual({ rows: 7, columns: 9, seed: 1.25, farmSeed: 'custom', farmDensity: .2,
      farmWeights: { crop: 0, livestock: 1, building: 2, fertile: 0 }, target: 37 })]]) {
    const save = createSave(mode, state);
    assert.deepEqual(roundtrip(save).state, state);
    assert.doesNotMatch(serializeSave(save), /"cells"|"claimed"|"rngState"|"rack"|"bag":\[/);
  }
  const save = createSave('free', createTargetSession().session);
  // Already-resolved automatic target remains fixed: Free Play never re-estimates it on resume.
  save.configuration.target = 321; save.configuration.targetSelection.resolvedTarget = 321;
  assert.equal(roundtrip(save).state.target, 321);
  assert.throws(() => createSave('free', createEnclosureSession()), /seeded/);
});

test('Daily partial play, physical allocation, exchange RNG and manual ending reproduce exactly', () => {
  const run = recorder(createDailySession('2026-10-23').session, 'daily');
  run.word(move('PHI', 7, 7)); run.check();
  run.exchange([run.state.rack[0].id, run.state.rack[2].id]); run.check();
  run.end(); run.check();
  assert.equal(roundtrip(run.save).state.status, 'ended');
  assert.deepEqual(restartDailySession(run.state), createDailySession('2026-10-23').session);
  assert.equal(createSave('daily', restartDailySession(run.state)).actions.length, 0);
});

test('repeated physical letters, explicit blanks, committed reuse and multi-word turns survive replay', () => {
  const blank = manual({ rows: 7, columns: 7, seed: 'blank-qa-636' });
  const ids = (glyph) => blank.rack.filter((tile) => tile.letter === glyph).map((tile) => tile.id);
  const proposal = move('CAT', 3, 2);
  const assignments = [
    { tileId: ids('C')[0], letter: 'C', assignedLetter: null, row: 3, column: 2 },
    { tileId: ids(null)[0], letter: 'A', assignedLetter: 'A', row: 3, column: 3 },
    { tileId: ids('T')[0], letter: 'T', assignedLetter: null, row: 3, column: 4 },
  ];
  const result = commitSessionWord(blank, proposal, dictionary, assignments);
  assert.equal(result.accepted, true);
  const saved = appendAction(createSave('free', blank), wordAction(result));
  assert.deepEqual(roundtrip(saved).state, result.state);
  assert.ok(result.state.rack.some((tile) => tile.id === ids('A')[0]));
  assert.equal(result.state.puzzle.board.cells[24].blank, true);
  const run = recorder(manual({ rows: 7, columns: 7 }));
  run.word(move('EEL', 3, 3)); run.check();
  assert.notEqual(run.state.puzzle.board.cells[24].tileId, run.state.puzzle.board.cells[25].tileId);
  const cross = recorder(manual({ rows: 7, columns: 7 }));
  cross.word(move('CAT', 3, 3)); cross.word(move('AT', 3, 4, 'vertical'));
  assert.equal(cross.word(move('TO', 4, 4)).evaluation.words.length, 2);
  cross.check();
});

for (const type of ['crop', 'fertile', 'livestock', 'building']) {
  test(`${type} capture, territory, utilities and subsequent exchanges reproduce from generated farms`, () => {
    // This fixed farm seed places exactly one feature inside the existing CAR/CAB/RAT/BAT observation.
    const run = recorder(manual({ rows: 7, columns: 7, farmSeed: 'save-farm:16', farmDensity: .05,
      farmWeights: Object.fromEntries(['crop', 'fertile', 'livestock', 'building'].map((key) => [key, Number(key === type)])) }));
    for (const p of [move('CAR', 3, 3), move('CAB', 3, 3, 'vertical'), move('RAT', 3, 5, 'vertical'), move('BAT', 5, 3)]) run.word(p);
    assert.equal(run.state.puzzle.territory.claimed[32], true);
    assert.equal(getPuzzleScore(run.state.puzzle).totalPoints, type === 'crop' ? 4 : type === 'fertile' ? 2 : 1);
    if (type === 'livestock') assert.equal(getRackCapacity(run.state), 8);
    const result = run.exchange([run.state.rack[0].id]);
    assert.equal(result.freeExchange, type === 'building');
    run.exchange([run.state.rack[1].id]); run.check();
  });
}

test('completed Free Play and Daily histories stay terminal and produce identical results/share text', () => {
  const run = recorder(createTargetSession({ rows: 3, columns: 4, farmDensity: 0, seed: 'wordstead-3c3-play:4222' }).session);
  for (const p of [move('RAT', 0, 2, 'vertical'), move('CAR', 0, 0), move('CAB', 0, 0, 'vertical'), move('BAT', 2, 0)]) run.word(p);
  assert.equal(run.state.status, 'won'); run.check();
  assert.equal(formatResultsShare(getSessionResults(roundtrip(run.save).state)), formatResultsShare(getSessionResults(run.state)));
  const restarted = restartTargetSession(run.state);
  assert.deepEqual(roundtrip(createSave('free', restarted)).state, restarted);
  assert.equal(hasProgress(restarted, createDraft()), false);
  // A fixed five-by-six fence on this released daily encloses at least its target 12.
  const daily = recorder(createDailySession('2026-10-23').session, 'daily');
  for (const p of [move('TIGER', 7, 5), move('HEIGHT', 2, 5, 'vertical'), move('HORSE', 2, 5), move('EITHER', 2, 9, 'vertical')]) daily.word(p);
  assert.equal(daily.state.status, 'won'); daily.check();
});

test('exhausted history consumes the full physical bag and cannot resume as playable', () => {
  // As in existing exhaustion tests, use the same controlled dictionary for play and replay.
  const anyWord = { has: () => true };
  let state = manual({ rows: 30, columns: 30 }), save = createSave('free', state), row = 15;
  while (state.status === 'playing') {
    const result = commitSessionWord(state, move(state.rack.map((tile) => tile.letter ?? 'A').join(''), row--, 15), anyWord);
    assert.equal(result.accepted, true);
    state = result.state; save = appendAction(save, wordAction(result)); conserve(state);
  }
  assert.equal(state.status, 'exhausted');
  const result = parseSave(serializeSave(save), 'free', anyWord);
  assert.equal(result.ok, true, result.message); assert.deepEqual(result.state, state);
  assert.equal(result.state.rack.length + result.state.bag.length, 0);
});

test('draft placement/movement, return/undo order, blank reassignment and incomplete gaps are preserved', () => {
  const state = manual({ rows: 7, columns: 7, seed: 'blank-qa-636' });
  let draft = createDraft();
  const blank = state.rack.find((tile) => tile.letter === null);
  const chosen = [state.rack[0], blank, state.rack[2]];
  const verify = () => assert.deepEqual(roundtrip(withDraft(createSave('free', state), draft)).draft, draft);
  verify();
  for (const [index, tile] of chosen.entries()) {
    const result = placeDraftTile(state, draft, { tileId: tile.id, row: 3, column: 2 + index, assignedLetter: 'O' });
    assert.equal(result.accepted, true); draft = result.draft; verify();
  }
  draft = assignDraftBlank(state, draft, blank.id, 'A').draft; verify();
  const moved = placeDraftTile(state, draft, { tileId: chosen[0].id, row: 3, column: 5 }).draft;
  assert.equal(moved.tiles.at(-1).tileId, chosen[0].id);
  assert.deepEqual(undoDraft(roundtrip(withDraft(createSave('free', state), moved)).draft), undoDraft(moved));
  draft = returnDraftTile(draft, blank.id); verify();
  assert.equal(evaluateDraft(state, draft, dictionary).reason.code, 'DRAFT_GAP');
  draft = undoDraft(draft); verify();
  draft = placeDraftTile(state, draft, { tileId: chosen[0].id, row: 2, column: 2 }).draft; verify();
  assert.equal(draft.tiles.at(-1).tileId, chosen[0].id);
});

test('malformed drafts reject foreign/duplicate tiles, collisions, reserved features and invalid blank assignments', () => {
  const state = manual({ rows: 7, columns: 7, seed: 'blank-qa-636', farmSeed: 'save-farm:16', farmDensity: .05 });
  const tile = { tileId: state.rack[0].id, letter: state.rack[0].letter, assignedLetter: null, row: 3, column: 3 };
  for (const tiles of [[{ ...tile, tileId: 999 }], [tile, { ...tile, column: 4 }],
    [tile, { ...tile, tileId: state.rack[1].id }], [{ ...tile, row: 4, column: 4 }],
    [{ ...tile, row: -1 }], [{ ...tile, assignedLetter: 'X' }], [{ ...tile, tileId: 98, assignedLetter: null }]]) {
    assert.throws(() => restoreDraft(state, { tiles }));
  }
  const run = recorder(state); run.word(move('CAT', 3, 3));
  const rackTile = run.state.rack[0];
  assert.throws(() => restoreDraft(run.state, { tiles: [{ ...tile, tileId: rackTile.id, letter: rackTile.letter }] }));
});

test('corrupt schemas, identities, settings, actions and terminal ordering reject the whole recovery', () => {
  const run = recorder(manual({ rows: 7, columns: 7 })); run.word(move('EEL', 3, 3)); run.end();
  const mutations = [
    (s) => { s.schemaVersion = 2; }, (s) => { s.mode = 'daily'; },
    (s) => { s.identity.vocabulary = 'other'; }, (s) => { s.identity.gameplay = 'other'; },
    (s) => { s.configuration.target = 0; }, (s) => { s.configuration.target = 1.2; },
    (s) => { s.configuration.rows = 1000000; }, (s) => { s.configuration.seed = ''; },
    (s) => { s.configuration.farmDensity = -1; }, (s) => { s.configuration.farmWeights.crop = -1; },
    (s) => { s.actions[0] = { type: 'exchange', tileIds: [999] }; },
    (s) => { const word = s.actions.find((a) => a.type === 'word'); word.assignments[1].tileId = word.assignments[0].tileId; },
    (s) => { s.actions.find((a) => a.type === 'word').proposal.word = 'ZZZZZZZ'; },
    (s) => { s.actions.push({ type: 'end' }); }, (s) => { s.actions.reverse(); },
  ];
  for (const mutate of mutations) {
    const save = structuredClone(run.save); mutate(save);
    const result = parseSave(JSON.stringify(save), 'free', dictionary);
    assert.equal(result.ok, false); assert.equal(result.state, undefined);
  }
  const daily = createSave('daily', createDailySession('2026-10-23').session);
  for (const mutate of [(s) => { s.daily.formatVersion = 'v0'; }, (s) => { s.daily.date = '2026-02-30'; },
    (s) => { s.configuration.target++; s.configuration.targetSelection.resolvedTarget++; }]) {
    const save = structuredClone(daily); mutate(save); assert.equal(parseSave(JSON.stringify(save), 'daily', dictionary).ok, false);
  }
  for (const raw of ['{', 'null', '[]', 'x'.repeat(SAVE_LIMITS.characters + 1)]) assert.equal(parseSave(raw, 'free', dictionary).ok, false);
  assert.equal(parseSave(JSON.stringify({ ...run.save, actions: Array(1001).fill({ type: 'end' }) }), 'free', dictionary).ok, false);
});

function storageHarness() {
  const values = new Map(); let writes = 0;
  const storage = { getItem: (key) => values.get(key) ?? null, setItem(key, raw) { values.set(key, raw); writes++; }, removeItem: (key) => values.delete(key) };
  const slot = (mode, writer = 'one') => createSaveSlot({ mode, dictionary, getStorage: () => storage, token: () => `${writer}:${++writes}` });
  return { values, storage, slot };
}

test('two isolated slots preserve restart/replacement and keep corrupted data until explicit discard', () => {
  const h = storageHarness(), daily = h.slot('daily'), free = h.slot('free');
  assert.equal(daily.load(), null); assert.equal(free.load(), null);
  const d = createSave('daily', createDailySession('2026-10-23').session);
  const f = createSave('free', manual({ target: 37 }));
  assert.ok(daily.write(d)); assert.ok(free.write(f));
  const dailyRaw = h.values.get(STORAGE_KEYS.daily);
  assert.ok(free.write(createSave('free', manual({ target: 87, seed: 'new' }))));
  assert.equal(h.values.get(STORAGE_KEYS.daily), dailyRaw);
  assert.equal(free.load().state.target, 87);
  h.values.set(STORAGE_KEYS.free, '{corrupt');
  assert.equal(free.load(), null); assert.equal(free.info.kind, 'invalid');
  assert.equal(free.write(f), false); assert.equal(h.values.get(STORAGE_KEYS.free), '{corrupt');
  assert.equal(daily.load().state.daily.date, '2026-10-23');
  h.values.set('unrelated', 'keep');
  assert.ok(free.discard(free.replacementToken())); assert.ok(free.write(f));
  assert.equal(h.values.get('unrelated'), 'keep'); assert.equal(h.values.get(STORAGE_KEYS.daily), dailyRaw);
});

test('storage exceptions, quota and serialization failures report unavailable without throwing or claiming success', () => {
  const h = storageHarness(), save = createSave('free', manual());
  for (const getStorage of [() => { throw new Error('SecurityError'); }, () => ({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } })]) {
    const slot = createSaveSlot({ mode: 'free', dictionary, getStorage, token: () => 'test' });
    slot.load(); assert.equal(slot.write(save), false); assert.equal(slot.info.kind, 'unavailable');
  }
  const slot = h.slot('free'); slot.load();
  const cyclic = { ...save }; cyclic.draft = cyclic;
  assert.equal(slot.write(cyclic), false); assert.equal(slot.info.kind, 'unavailable');
  assert.equal(slot.write({ ...save, configuration: { ...save.configuration, seed: 'a'.repeat(257) } }), false);
  assert.equal(h.values.size, 0);
  assert.ok(slot.write(save));
});

test('multi-tab changes, missed events, deletion and changes during confirmation cannot silently overwrite', () => {
  const h = storageHarness(), a = h.slot('free', 'a'), b = h.slot('free', 'b');
  a.load(); b.load();
  const first = createSave('free', manual({ target: 17 }));
  assert.ok(a.write(first)); assert.equal(b.write(first), false); assert.equal(b.info.kind, 'conflict');
  assert.equal(b.load().state.target, 17);
  a.changed(); assert.equal(a.info.kind, 'saved'); // Delayed event for already-observed bytes is harmless.
  assert.ok(b.write(createSave('free', manual({ target: 19 }))));
  a.changed(); assert.equal(a.info.kind, 'conflict');
  const approval = a.replacementToken();
  assert.ok(b.write(first)); assert.equal(a.replace(first, approval), false);
  assert.ok(a.replace(first, a.replacementToken()));
  h.storage.removeItem(STORAGE_KEYS.free); a.changed(); assert.equal(a.info.kind, 'conflict');
  assert.equal(a.write(first), false); assert.equal(h.storage.getItem(STORAGE_KEYS.free), null);
});
