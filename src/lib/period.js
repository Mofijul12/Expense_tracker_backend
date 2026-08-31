// Month arithmetic in UTC so a budget period never drifts with the host timezone.

export const MONTH_RE = /^\d{4}-\d{2}$/;

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function parseMonth(month) {
  if (!month || !MONTH_RE.test(month)) return currentMonth();
  return month;
}

/** Shift a "YYYY-MM" string by n months. */
export function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** The n most recent months ending at `month`, oldest first. */
export function lastMonths(month, n) {
  return Array.from({ length: n }, (_, i) => shiftMonth(month, i - (n - 1)));
}

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + ` ${y}`;
}

export function shortMonthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

/**
 * Half-open [start, end) range for a budget period.
 * With monthStartsOn = 1 this is the calendar month; with 25 the August period
 * runs 25 Aug -> 25 Sep.
 */
export function monthRange(month, monthStartsOn = 1) {
  const [y, m] = month.split('-').map(Number);
  const day = Math.min(Math.max(Number(monthStartsOn) || 1, 1), 28);
  const start = new Date(Date.UTC(y, m - 1, day));
  const end = new Date(Date.UTC(y, m, day));
  return { start, end };
}

/** Days elapsed and remaining in a period, clamped to the period itself. */
export function periodProgress(month, monthStartsOn = 1, now = new Date()) {
  const { start, end } = monthRange(month, monthStartsOn);
  const dayMs = 24 * 60 * 60 * 1000;
  const total = Math.round((end - start) / dayMs);
  const raw = Math.floor((now - start) / dayMs) + 1;
  const elapsed = Math.min(Math.max(raw, 0), total);
  return { totalDays: total, daysElapsed: elapsed, daysLeft: Math.max(total - elapsed, 0), start, end };
}

export function toMonthKey(date) {
  return new Date(date).toISOString().slice(0, 7);
}
