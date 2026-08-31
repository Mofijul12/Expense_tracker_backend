/** The accent ramp the canvas paints bars, swatches and donut arcs with. */
export const RAMP = ['#9184d9', '#796cbf', '#5d5294', '#423a6a', '#9690c9'];

export const rampColor = (i = 0) => RAMP[((i % RAMP.length) + RAMP.length) % RAMP.length];

/** Money, formatted the way the whole app shows it. */
export function formatMoney(value, settings, opts = {}) {
  const symbol = settings?.currencySymbol ?? '৳';
  const n = Number(value) || 0;
  const whole = settings?.rounding === 'whole' || settings?.reminders?.roundInLists;
  const text = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 0,
    maximumFractionDigits: whole ? 0 : 2,
  });
  const sign = n < 0 ? '−' : '';
  return opts.bare ? `${sign}${text}` : `${sign}${symbol}${text}`;
}

/** Compact form for chart axis labels: 48320 -> "48k". */
export function formatCompact(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "27 Aug" — the compact form the tables use. */
export function formatShortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Sat 22 Aug 2026 · 7:14 pm" — the detail screen's header line. */
export function formatLongDate(value) {
  if (!value) return '';
  const d = new Date(value);
  const hours = d.getUTCHours();
  const suffix = hours >= 12 ? 'pm' : 'am';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${h12}:${mins} ${suffix}`;
}

/** "2026-08" -> "August 2026" */
export function formatMonthName(month) {
  if (!month) return '';
  const [y, m] = month.split('-').map(Number);
  const full = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  return `${full[m - 1]} ${y}`;
}

/** "2026-08" -> "Aug" */
export const formatMonthShort = (month) => (month ? MONTHS[Number(month.split('-')[1]) - 1] : '');

/** A Date -> the "YYYY-MM-DD" a date input wants. */
export const toDateInput = (value) => new Date(value || Date.now()).toISOString().slice(0, 10);

/** A Date -> "YYYY-MM". */
export const toMonthKey = (value) => new Date(value || Date.now()).toISOString().slice(0, 7);

export function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** A signed percentage, e.g. "+9.2%" / "−8%". */
export function formatDelta(pct) {
  const n = Number(pct) || 0;
  if (n === 0) return '0%';
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;
}
