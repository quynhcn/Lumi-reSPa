/**
 * Date helpers that work in LOCAL calendar days.
 *
 * Never use `date.toISOString().split('T')[0]` for a local day: in UTC+7 it returns
 * the previous day between 00:00 and 07:00 (and always for dates set to local midnight).
 */

/** 'YYYY-MM-DD' of the given date in the browser's local calendar. */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse 'YYYY-MM-DD' as LOCAL midnight (`new Date('YYYY-MM-DD')` parses as UTC). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Local [start, end) of a day as ISO strings, for timestamptz range queries. */
export function dayRangeISO(key: string): { start: string; end: string } {
  const start = parseDateKey(key);
  return { start: start.toISOString(), end: addDays(start, 1).toISOString() };
}
