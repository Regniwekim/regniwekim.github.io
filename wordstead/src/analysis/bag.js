import { LETTER_DISTRIBUTION, RACK_CAPACITY, MAX_RACK_CAPACITY } from '../core/bag.js';
import { ALPHABET } from './vocabulary.js';

export const BAG_ID = 'wordstead-standard-100-v1';
export const BAG_SIGNATURE = Object.entries(LETTER_DISTRIBUTION).map(([letter, count]) => `${letter}:${count}`).join(',');
export const CAPACITIES = Object.freeze(Array.from({ length: MAX_RACK_CAPACITY - RACK_CAPACITY + 1 }, (_, i) => RACK_CAPACITY + i));

export function analyzeBag(vocabularyProfile) {
  const totalTiles = Object.values(LETTER_DISTRIBUTION).reduce((sum, count) => sum + count, 0);
  const blanks = LETTER_DISTRIBUTION['?'];
  const profile = vocabularyProfile.groups.all;
  return { id: BAG_ID, signature: BAG_SIGNATURE, totalTiles, blankCount: blanks, blankFraction: blanks / totalTiles,
    letters: Object.entries(LETTER_DISTRIBUTION).map(([letter, count]) => {
      const index = ALPHABET.indexOf(letter);
      const dictionaryShare = index < 0 ? null : profile.relativeFrequency[index];
      const fraction = count / totalTiles;
      return { letter, count, fraction,
        expectedInRack: Object.fromEntries(CAPACITIES.map((capacity) => [capacity, capacity * fraction])),
        dictionaryShare, physicalAvailabilityRatio: dictionaryShare ? fraction / dictionaryShare : null,
        availabilityRatio: dictionaryShare ? (count / (totalTiles - blanks)) / dictionaryShare : null };
    }) };
}
