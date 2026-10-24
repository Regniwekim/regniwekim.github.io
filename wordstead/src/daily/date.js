/** Gregorian calendar validation, without parsing a date string or using local time. */
export function validateDailyDate(date) {
  if (typeof date !== 'string' || date.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('Daily dates must use YYYY-MM-DD.');
  }
  const [year, month, day] = date.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
    throw new RangeError('Choose a valid Gregorian calendar date (0001–9999).');
  }
  return date;
}

/** Explicit epoch milliseconds; the browser clock is supplied only at the UI boundary. */
export function utcDailyDate(timestamp) {
  if (!Number.isFinite(timestamp)) throw new TypeError('Supply finite epoch milliseconds.');
  const instant = new Date(timestamp);
  if (!Number.isFinite(instant.getTime())) throw new RangeError('Timestamp is outside the supported calendar.');
  const date = [String(instant.getUTCFullYear()).padStart(4, '0'),
    String(instant.getUTCMonth() + 1).padStart(2, '0'), String(instant.getUTCDate()).padStart(2, '0')].join('-');
  return validateDailyDate(date);
}
