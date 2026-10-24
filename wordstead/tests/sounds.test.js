import test from 'node:test';
import assert from 'node:assert/strict';
import { createSounds, SOUND_KEY } from '../src/audio/sounds.js';

function harness({ preference = null, suspended = false, resumeFails = false } = {}) {
  const data = new Map(preference ? [[SOUND_KEY, preference]] : []);
  data.set('wordstead.save.daily.v1', 'unchanged-gameplay');
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const voices = [], gains = [];
  const parameter = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const context = { currentTime: 1, state: suspended ? 'suspended' : 'running', resumes: 0,
    resume() { this.resumes += 1; return resumeFails ? Promise.reject(new Error('denied')) : Promise.resolve(); },
    createGain() { const gain = { gain: parameter(), connect() {}, disconnect() {} }; gains.push(gain); return gain; },
    createOscillator() {
      const voice = { frequency: parameter(), connect() {}, disconnected: false, disconnect() { this.disconnected = true; }, start() {},
        stopped: false, stop() { this.stopped = true; }, onended: null };
      voices.push(voice); return voice;
    } };
  let created = 0, hidden = false;
  const sounds = createSounds({ getStorage: () => storage, createContext: () => { created += 1; return context; }, isHidden: () => hidden });
  return { sounds, voices, gains, context, data, storage, get created() { return created; }, hide() { hidden = true; sounds.stop(); } };
}
const activated = { isTrusted: true };

test('sound defaults off, is lazy, and only trusted activation can start enabled audio', () => {
  const h = harness();
  assert.equal(h.sounds.enabled, false);
  h.sounds.activate(activated); h.sounds.play([{ type: 'word-accepted' }]);
  assert.equal(h.created, 0);
  h.sounds.setEnabled(true);
  h.sounds.activate({ isTrusted: false }); h.sounds.play([{ type: 'word-accepted' }]);
  assert.equal(h.created, 0);
  h.sounds.activate(activated); h.sounds.play([{ type: 'word-accepted' }]);
  assert.equal(h.created, 1); assert.equal(h.voices.length, 2);
  assert.equal(h.data.get('wordstead.save.daily.v1'), 'unchanged-gameplay');
  assert.deepEqual(JSON.parse(h.data.get(SOUND_KEY)), { version: 1, enabled: true });
});

test('restored preference never autoplays, malformed/unknown preferences stay off', () => {
  const h = harness({ preference: '{"version":1,"enabled":true}' });
  assert.equal(h.sounds.enabled, true); h.sounds.play([{ type: 'run-completed' }]); assert.equal(h.created, 0);
  for (const preference of ['broken', '{"version":2,"enabled":true}', '{"version":1,"enabled":"true"}']) {
    assert.equal(harness({ preference }).sounds.enabled, false);
  }
});

test('combined harvest/victory selects one cohesive cue; rapid repeated effects keep at most four live voices', () => {
  const h = harness(); h.sounds.setEnabled(true); h.sounds.activate(activated);
  h.sounds.play(['word-accepted', 'territory-captured', 'feature-captured', 'feature-captured', 'run-completed'].map((type) => ({ type })));
  assert.equal(h.voices.length, 4);
  assert.equal(h.gains[0].gain.value, 0.12);
  const previous = h.voices.slice();
  for (let i = 0; i < 50; i += 1) {
    h.sounds.play([{ type: 'run-completed' }]);
    assert.ok(h.voices.filter((voice) => !voice.disconnected).length <= 4);
  }
  assert.ok(previous.every((voice) => voice.disconnected));
  h.sounds.setEnabled(false);
  assert.equal(h.voices.filter((voice) => !voice.disconnected).length, 0);
  const count = h.voices.length; h.sounds.play([{ type: 'run-completed' }]);
  assert.equal(h.voices.length, count);
});

test('muting and hiding promptly stop/disconnect all scheduled voices; no delayed playback', () => {
  const h = harness(); h.sounds.setEnabled(true); h.sounds.activate(activated);
  let stops = 0;
  const original = h.context.createOscillator;
  h.context.createOscillator = () => { const voice = original(); voice.disconnect = () => { stops += 1; }; return voice; };
  h.sounds.play([{ type: 'run-completed' }]); h.sounds.setEnabled(false);
  assert.equal(stops, 4);
  h.sounds.setEnabled(true); h.sounds.play([{ type: 'word-accepted' }]); h.hide();
  assert.equal(stops, 6);
  h.sounds.play([{ type: 'word-accepted' }]); assert.equal(h.voices.length, 6);
});

test('suspended contexts are resumed only by input and never queue an old cue; rejection is handled', async () => {
  for (const resumeFails of [false, true]) {
    const h = harness({ suspended: true, resumeFails });
    h.sounds.setEnabled(true); h.sounds.activate(activated);
    h.sounds.play([{ type: 'word-accepted' }]);
    assert.equal(h.context.resumes, 1); assert.equal(h.voices.length, 0);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.voices.length, 0);
    h.context.state = 'running'; h.sounds.play([{ type: 'tile-placed' }]); assert.equal(h.voices.length, 1);
    h.sounds.play([{ type: 'tile-placed' }]); assert.equal(h.voices.length, 1);
  }
});

test('unsupported/throwing audio and unavailable preference storage never interrupt gameplay', () => {
  for (const createContext of [() => null, () => { throw new Error('unavailable'); },
    () => ({ createGain() { throw new Error('audio failure'); } })]) {
    const sounds = createSounds({ getStorage() { throw new Error('denied'); }, createContext });
    assert.equal(sounds.enabled, false);
    assert.doesNotThrow(() => { sounds.setEnabled(true); sounds.activate(activated); sounds.play([{ type: 'word-accepted' }]); sounds.stop(); });
  }
});
