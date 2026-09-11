/**
 * Small date helpers with the clamping behaviour the campaign flow relies on.
 *
 * Only what the tests need — the campaign screens deal in "tomorrow", "a month
 * out" and "three weekly cycles", which is not worth a date library.
 */

/** Today at midnight, so date arithmetic never straddles a day boundary mid-test. */
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/**
 * Adds calendar months, clamping the day to the target month's length so
 * 31 January + 1 month is 28/29 February rather than rolling into March.
 */
export function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfTarget));
  return d;
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Month index (0-based) for a month name as the date picker header spells it. */
export function monthIndex(name: string): number {
  const index = MONTH_NAMES.findIndex(
    (m) => m.toLowerCase() === name.trim().toLowerCase(),
  );
  if (index < 0) {
    throw new Error(`Unrecognised month name "${name}" in date picker header`);
  }
  return index;
}
