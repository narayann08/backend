import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

/** Parse anything the API hands us into a Date, or null if unusable. */
export function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(String(value));
  return isValid(date) ? date : null;
}

/** e.g. "14:00" */
export function formatTime(value) {
  const date = toDate(value);
  return date ? format(date, 'HH:mm') : '—';
}

/** e.g. "12 Sep 14:00" */
export function formatDateTime(value) {
  const date = toDate(value);
  return date ? format(date, 'd MMM HH:mm') : '—';
}

/** e.g. "12 Sep" */
export function formatDay(value) {
  const date = toDate(value);
  return date ? format(date, 'd MMM') : '—';
}

/** e.g. "3 minutes ago" */
export function formatRelative(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${formatDistanceToNowStrict(date)} ago`;
}

/**
 * Format a megawatt value. Returns an em dash for null/undefined so the UI
 * never prints "null MW" — a real possibility given nullable API fields.
 */
export function formatMW(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(digits)} MW`;
}

/** Percentage with an explicit sign, e.g. "+45.8%" — used for deltas. */
export function formatSignedPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(digits)}%`;
}

/** Plain percentage, e.g. "72.9%". */
export function formatPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

/** Turn a snake_case code into readable text, e.g. "sensor_fault" -> "Sensor fault". */
export function humanise(code) {
  if (!code) return '';
  const spaced = String(code).replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
