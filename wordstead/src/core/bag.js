export const RACK_CAPACITY = 7;
export const MAX_RACK_CAPACITY = 9;
export const LETTER_DISTRIBUTION = Object.freeze({
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9,
  J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6,
  S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, '?': 2,
});

/** Canonical physical IDs 0–99, alphabetically then blanks (letter: null). */
export function createStandardTiles() {
  const tiles = [];
  for (const [letter, count] of Object.entries(LETTER_DISTRIBUTION)) {
    for (let i = 0; i < count; i += 1) {
      tiles.push({ id: tiles.length, letter: letter === '?' ? null : letter });
    }
  }
  return tiles;
}

/** Type-tagged FNV-1a over UTF-16 code units. No environment-specific hashing. */
export function seedToState(seed) {
  if (!(typeof seed === 'string' && seed.trim().length > 0)
    && !(typeof seed === 'number' && Number.isFinite(seed))) {
    throw new TypeError('Seed must be a nonempty string or a finite number.');
  }
  let hash = 2166136261;
  const text = `${typeof seed}:${seed}`;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return hash;
}

/** Mulberry32: explicit unsigned 32-bit state and output. */
export function nextRandom(state) {
  const rngState = (state + 0x6d2b79f5) >>> 0;
  let value = rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { rngState, value: (value ^ (value >>> 14)) >>> 0 };
}

/** Fisher–Yates with rejection sampling, avoiding modulo bias. Copies input. */
export function shuffleTiles(tiles, initialState) {
  const bag = tiles.slice();
  let rngState = initialState;
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const bound = i + 1;
    const limit = Math.floor(0x100000000 / bound) * bound;
    let value;
    do { ({ value, rngState } = nextRandom(rngState)); } while (value >= limit);
    const j = value % bound;
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return { bag, rngState };
}

export function createBag(seed, bagOrder) {
  const tiles = createStandardTiles();
  const rngState = seedToState(seed);
  if (bagOrder === undefined) return shuffleTiles(tiles, rngState);
  if (!Array.isArray(bagOrder) || bagOrder.length !== tiles.length
    || new Set(bagOrder).size !== tiles.length
    || !Array.from(bagOrder).every((id) => Number.isInteger(id) && id >= 0 && id < tiles.length)) {
    throw new TypeError('Scripted bag order must contain every standard tile ID exactly once.');
  }
  return { bag: bagOrder.map((id) => tiles[id]), rngState };
}

/** Draw from the front; draws consume no RNG. Neither input array is changed. */
export function replenishRack(rack, bag, capacity = RACK_CAPACITY) {
  if (!Number.isSafeInteger(capacity) || capacity < RACK_CAPACITY || capacity > MAX_RACK_CAPACITY
    || !Array.isArray(rack) || rack.length > capacity) {
    throw new RangeError('Rack capacity must be seven to nine, without overflow.');
  }
  const count = Math.min(capacity - rack.length, bag.length);
  return { rack: [...rack, ...bag.slice(0, count)], bag: bag.slice(count) };
}
