// Original procedural Wordstead sounds. No samples, music, or gameplay state.
export const SOUND_KEY = 'wordstead.preferences.sound.v1';
const MAX_VOICES = 4;
const CUES = {
  'tile-selected': [[330, 0, 0.055]],
  'tile-placed': [[220, 0, 0.085]],
  'tile-moved': [[247, 0, 0.085]],
  'tile-returned': [[196, 0, 0.09]],
  'word-rejected': [[165, 0, 0.1]],
  'word-accepted': [[262, 0, 0.13], [330, 0.045, 0.13]],
  'territory-captured': [[330, 0, 0.16], [440, 0.07, 0.18]],
  'feature-captured': [[330, 0, 0.15], [440, 0.06, 0.17], [523, 0.12, 0.18]],
  'tiles-exchanged': [[196, 0, 0.06], [247, 0.065, 0.07]],
  'run-completed': [[262, 0, 0.2], [330, 0.08, 0.2], [392, 0.16, 0.22], [523, 0.24, 0.24]],
};
const PRIORITY = ['run-completed', 'feature-captured', 'territory-captured', 'word-accepted',
  'word-rejected', 'tiles-exchanged', 'tile-returned', 'tile-moved', 'tile-placed', 'tile-selected'];

export function createSounds({ getStorage = () => window.localStorage,
  createContext = () => {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return Context ? new Context() : null;
  }, isHidden = () => Boolean(globalThis.document?.hidden) } = {}) {
  let enabled = false;
  try {
    const preference = JSON.parse(getStorage().getItem(SOUND_KEY));
    enabled = preference?.version === 1 && preference.enabled === true;
  } catch { /* Preferences are optional and independent of active saves. */ }
  let context = null, master = null, resuming = false;
  const voices = new Set();
  let lastCueTime = -Infinity;

  function stop() {
    for (const voice of [...voices]) {
      try { voice.oscillator.stop(); } catch { /* Already stopped. */ }
      try { voice.oscillator.disconnect(); voice.envelope.disconnect(); } catch { /* Failed optional audio. */ }
      voices.delete(voice);
    }
  }
  function activate(event) {
    if (!event?.isTrusted || !enabled || isHidden()) return;
    try {
      if (!context) {
        context = createContext();
        if (!context) return;
        master = context.createGain();
        master.gain.value = 0.12;
        master.connect(context.destination);
        context.addEventListener?.('statechange', () => {
          if (context.state !== 'running') stop();
        });
      }
      if (context.state === 'suspended' && !resuming) {
        resuming = true;
        // Never queue a cue behind resume: a stale action must remain silent.
        Promise.resolve(context.resume()).catch(() => {}).finally(() => { resuming = false; });
      }
    } catch { stop(); }
  }
  function setEnabled(value) {
    enabled = value === true;
    if (!enabled) stop();
    try { getStorage().setItem(SOUND_KEY, JSON.stringify({ version: 1, enabled })); } catch { /* Optional. */ }
  }
  function play(events) {
    if (!enabled || isHidden() || context?.state !== 'running' || !master) return;
    const cue = PRIORITY.find((type) => events.some((event) => event.type === type));
    if (!cue) return;
    const now = context.currentTime;
    // Rate-limit handling taps; meaningful harvests may replace an earlier cue.
    if (cue.startsWith('tile-') && now - lastCueTime < 0.045) return;
    lastCueTime = now;
    stop();
    try {
      for (const [frequency, delay, duration] of CUES[cue].slice(0, MAX_VOICES)) {
        const oscillator = context.createOscillator(), envelope = context.createGain();
        const voice = { oscillator, envelope };
        voices.add(voice);
        oscillator.type = cue.startsWith('tile') ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, now + delay);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.92, now + delay + duration);
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.setValueAtTime(0, now + delay);
        envelope.gain.linearRampToValueAtTime(cue === 'tile-selected' ? 0.10 : 0.18, now + delay + 0.008);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.onended = () => {
          oscillator.disconnect(); envelope.disconnect(); voices.delete(voice);
        };
        oscillator.start(now + delay);
        oscillator.stop(now + delay + duration + 0.01);
      }
    } catch { stop(); }
  }
  return { activate, setEnabled, play, stop, get enabled() { return enabled; } };
}
