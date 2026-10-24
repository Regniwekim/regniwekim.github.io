import { utcDailyDate } from '../daily/date.js';
import { createDailySession } from '../daily/challenge.js';

/** Clock boundary. Checking availability cannot replace a run; only startToday can. */
export function createDailyMode({ now = () => Date.now(), create = createDailySession } = {}) {
  let current = null;
  return {
    get current() { return current; },
    today: () => utcDailyDate(now()),
    startToday() {
      const date = utcDailyDate(now());
      if (current?.definition.date === date) return current;
      const result = create(date);
      if (result.available) current = result;
      return result;
    },
  };
}
