import { validateDailyDate } from './date.js';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
function parts(month) {
  validateDailyDate(`${month}-01`);
  return month.split('-').map(Number);
}

export function shiftHistoryMonth(month, offset) {
  const [year, number] = parts(month);
  if (!Number.isSafeInteger(offset)) throw new TypeError('Month offset must be an integer.');
  const index = (year - 1) * 12 + number - 1 + offset;
  if (!Number.isSafeInteger(index) || index < 0 || index >= 9999 * 12) return null;
  return `${String(Math.floor(index / 12) + 1).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`;
}

export const historyDateRecords = (records, date) => {
  validateDailyDate(date);
  return records.filter((record) => record.date === date);
};

/** Sunday-first Gregorian month. No local timezone or challenge/session factory. */
export function createHistoryMonth(month, records = []) {
  const [year, number] = parts(month);
  const instant = new Date(0);
  instant.setUTCFullYear(year, number - 1, 1);
  instant.setUTCHours(0, 0, 0, 0);
  const leading = instant.getUTCDay();
  instant.setUTCMonth(number, 0);
  const days = instant.getUTCDate();
  const cells = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= days; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const results = historyDateRecords(records, date);
    cells.push({ date, day, state: results.some((r) => r.status === 'won') ? 'completed'
      : results.length ? 'unfinished' : 'empty' });
  }
  while (cells.length % 7) cells.push(null);
  return { label: `${months[number - 1]} ${String(year).padStart(4, '0')}`, cells };
}
