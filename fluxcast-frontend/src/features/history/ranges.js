/**
 * Date-range presets for the history page.
 *
 * Kept out of the component file so the picker exports a component and nothing
 * else — mixing constants in breaks Vite's fast refresh for that module.
 */

export const RANGE_PRESETS = [
  { key: '24h', label: 'Last 24h', hours: 24 },
  { key: '3d', label: 'Last 3 days', hours: 72 },
  { key: '7d', label: 'Last 7 days', hours: 168 },
  { key: '30d', label: 'Last 30 days', hours: 720 },
];

/** Build a {from, to} window of `hours` ending now. */
export function rangeFromPreset(hours) {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return { from, to };
}
