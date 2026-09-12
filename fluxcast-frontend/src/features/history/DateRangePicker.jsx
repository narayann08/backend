import { format } from 'date-fns';

import { RANGE_PRESETS } from './ranges';

/** `datetime-local` needs a local-time string with no timezone suffix. */
function toInputValue(date) {
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : '';
}

/**
 * Drives every query on the history page (plan §5.1). Preset buttons for the
 * common windows, plus explicit from/to inputs for a custom range.
 */
export default function DateRangePicker({ preset, range, onPresetChange, onCustomChange }) {
  function handleCustom(field, value) {
    if (!value) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return;
    onCustomChange({ ...range, [field]: parsed });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface-raised p-3">
      <div
        role="group"
        aria-label="Quick date ranges"
        className="flex flex-wrap gap-1"
      >
        {RANGE_PRESETS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onPresetChange(option)}
            aria-pressed={preset === option.key}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              preset === option.key
                ? 'bg-brand text-white'
                : 'text-ink-muted hover:bg-surface hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          From
          <input
            type="datetime-local"
            value={toInputValue(range.from)}
            max={toInputValue(range.to)}
            onChange={(e) => handleCustom('from', e.target.value)}
            className="rounded-md border border-line bg-surface-raised px-2 py-1 text-xs text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          To
          <input
            type="datetime-local"
            value={toInputValue(range.to)}
            min={toInputValue(range.from)}
            onChange={(e) => handleCustom('to', e.target.value)}
            className="rounded-md border border-line bg-surface-raised px-2 py-1 text-xs text-ink"
          />
        </label>
      </div>
    </div>
  );
}
