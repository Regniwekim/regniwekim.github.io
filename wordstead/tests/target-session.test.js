import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, commitSessionWord, evaluateSessionPlacement, exchangeTiles, endSession } from '../src/core/session.js';
import { createTargetSession, restartTargetSession } from '../src/analysis/target-session.js';
import { getSessionResults, formatResultsShare } from '../src/core/results.js';
import { getPuzzleScore } from '../src/core/features.js';
import { createEnclosureSession, ENCLOSURE_MOVES } from '../src/core/session-fixture.js';
import { createFarmSession } from '../src/core/farm-fixture.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { initializeResults } from '../src/ui/results.js';
import { initializeTargetSetup } from '../src/ui/target-setup.js';

test('integer callers and manual mode keep exact behavior and bypass incompatible analysis', () => {
  const original = createSession({ target: 913 });
  const manual = createTargetSession({ targetMode: 'manual', target: 913 }, { model: null });
  assert.equal(manual.available, true);
  assert.equal(manual.estimate, null);
  const { targetSelection, ...session } = manual.session;
  assert.deepEqual(session, original);
  assert.deepEqual(targetSelection, { mode: 'manual', resolvedTarget: 913, methodVersion: null });
  assert.equal(createSession().target, 1);
  assert.throws(() => createTargetSession({ targetMode: 'manual', target: 0 }), RangeError);
  assert.throws(() => createTargetSession({ targetMode: 'invalid' }), TypeError);
});

test('automatic creation stores compact metadata, and restart recreates original resources and target', () => {
  const created = createTargetSession({ seed: 42, farmSeed: 'test-farm', farmDensity: 0.2 });
  assert.equal(created.session.target, created.estimate.target);
  assert.equal(created.session.targetSelection.mode, 'automatic');
  assert.equal(created.session.targetSelection.methodVersion, 'auto-target-v1');
  assert.ok(JSON.stringify(created.session.targetSelection).length < 400);
  const initial = structuredClone(created.session);
  const exchanged = exchangeTiles(created.session, [created.session.rack[0].id]).state;
  assert.equal(exchanged.target, initial.target);
  assert.equal(exchanged.targetSelection, created.session.targetSelection);
  assert.deepEqual(restartTargetSession(exchanged), initial);
  assert.equal(createTargetSession({ rows: 1, columns: 1 }).session, null);
});

test('auto target victory uses committed score; preview/rejection/exchange preserve target and results share', async () => {
  // Real seeded bag, also completed in the browser; selected for this fixed four-word observation.
  const initial = createTargetSession({ rows: 3, columns: 4, farmDensity: 0, seed: 'wordstead-3c3-play:4222' }).session;
  assert.equal(initial.target, 1);
  let state = initial;
  for (const proposal of [{ word: 'RAT', row: 0, column: 2, orientation: 'vertical' },
    { word: 'CAR', row: 0, column: 0, orientation: 'horizontal' },
    { word: 'CAB', row: 0, column: 0, orientation: 'vertical' }]) {
    const result = commitSessionWord(state, proposal, demoDictionary);
    assert.equal(result.accepted, true);
    state = result.state;
  }
  const proposal = { word: 'BAT', row: 2, column: 0, orientation: 'horizontal' };
  const dictionary = demoDictionary;
  const before = structuredClone(state);
  assert.equal(evaluateSessionPlacement(state, proposal, dictionary).legal, true);
  assert.deepEqual(state, before);
  assert.equal(state.status, 'playing');
  const failed = commitSessionWord(state, { ...proposal, row: -1 }, dictionary);
  assert.equal(failed.state, state);
  const result = commitSessionWord(state, proposal, dictionary);
  assert.equal(result.accepted, true);
  assert.equal(result.state.status, 'won');
  assert.equal(result.state.target, initial.target);
  const summary = getSessionResults(result.state);
  assert.equal(summary.target, 1);
  assert.equal(summary.totalPoints, 1);
  assert.equal(summary.wordCount, 4);
  assert.equal(result.state.puzzle.board.cells[10].blank, true);
  let copied;
  const { find } = setupSurface();
  const view = initializeResults({ find, writeClipboard: async (text) => { copied = text; } });
  view.render(result.state);
  await find('copy-results').listeners.click();
  assert.equal(copied, formatResultsShare(summary));
  assert.match(copied, /1\/1 farm points/);
  assert.doesNotMatch(copied, /seed|heuristic|rack|grade|par|positions/i);
});

test('farm captures, utility capacity and credits never re-estimate the resolved target', () => {
  for (const type of ['crop', 'fertile', 'livestock', 'building']) {
    const selection = createTargetSession().session.targetSelection;
    let state = createFarmSession(type);
    // A diagnostic fixture with automatic selection metadata tests the unchanged atomic transition.
    state = { ...state, target: selection.resolvedTarget, targetSelection: selection };
    const originalTarget = state.target;
    for (const move of ENCLOSURE_MOVES) {
      const preview = evaluateSessionPlacement(state, move, demoDictionary);
      assert.ok(preview.legal);
      const result = commitSessionWord(state, move, demoDictionary);
      assert.ok(result.accepted);
      state = result.state;
      assert.equal(state.target, originalTarget);
      assert.equal(state.targetSelection, selection);
    }
    assert.ok(getPuzzleScore(state.puzzle).totalPoints > 0);
    if (state.status === 'playing') {
      const afterExchange = exchangeTiles(state, [state.rack[0].id]).state;
      assert.equal(afterExchange.target, originalTarget);
      assert.equal(getSessionResults(endSession(afterExchange).state).target, originalTarget);
    }
  }
  assert.equal(createEnclosureSession().target, 1);
  assert.equal(createFarmSession('crop').target, 4);
  assert.equal(createFarmSession('fertile').target, 2);
  assert.equal(createFarmSession('building').target, 20);
});

function setupSurface() {
  const nodes = new Map();
  const find = (id) => {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', hidden: false, disabled: false, listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; }, reportValidity() { return true; } });
    return nodes.get(id);
  };
  return { find };
}
function targetSurface(estimate) {
  const { find } = setupSurface();
  const values = { 'target-mode': 'automatic', target: '3', rows: '15', columns: '15', seed: 'wordstead-2c',
    'farm-seed': 'wordstead-farm-2d', 'farm-density': '0.08' };
  for (const [key, value] of Object.entries(values)) find(key).value = value;
  return { find, view: initializeTargetSetup({ find, isRackMode: () => true, estimate }) };
}

test('setup previews current settings before starting, invalidates edits and never changes the active run', () => {
  const active = createTargetSession().session, before = structuredClone(active);
  const { find, view } = targetSurface();
  assert.equal(view.resolve(), null); // First submit calculates/exposes, but does not start a run.
  assert.match(find('target-preview').textContent, /Estimated target: 12/);
  assert.equal(view.resolve().targetMode, 'automatic');
  find('rows').value = '7';
  find('dimensions').listeners.input();
  assert.doesNotMatch(find('target-preview').textContent, /12 farm points/);
  assert.equal(view.resolve(), null);
  const next = createTargetSession(view.resolve());
  assert.equal(next.session.puzzle.board.rows, 7);
  assert.notEqual(next.session.target, active.target);
  assert.deepEqual(active, before);
  assert.deepEqual(restartTargetSession(active), before);
  // Programmatic value edits without an input event are also caught by the setup key.
  find('columns').value = '10';
  assert.equal(view.resolve(), null);
});

test('manual setup exposes numeric input, bypasses estimator and handles automatic unavailability', () => {
  let calls = 0;
  const { find, view } = targetSurface(() => { calls += 1; return { available: false, message: 'No opportunity.' }; });
  find('target-mode').value = 'manual'; find('target-mode').listeners.change();
  assert.equal(find('manual-target').hidden, false);
  assert.equal(find('target').disabled, false);
  assert.equal(view.resolve().target, 3);
  assert.equal(calls, 0);
  find('target-mode').value = 'automatic'; find('target-mode').listeners.change();
  assert.equal(find('target').disabled, true);
  assert.equal(view.resolve(), null);
  assert.match(find('target-preview').textContent, /unavailable.*No opportunity/);
  assert.equal(view.resolve(), null);
  find('dimensions').reportValidity = () => false;
  view.invalidate();
  assert.equal(view.resolve(), null);
  assert.equal(calls, 1);
});
