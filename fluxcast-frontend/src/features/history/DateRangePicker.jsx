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
    <div className="fc-ticks relative flex flex-wrap items-end gap-4 rounded-[3px] border border-line bg-surface-raised p-3">
      <div role="group" aria-label="Quick date ranges" className="flex flex-wrap gap-1">
        {RANGE_PRESETS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onPresetChange(option)}
            aria-pressed={preset === option.key}
            className={`fc-label rounded-[2px] px-3 py-2 transition-colors ${
              preset === option.key
                ? 'bg-ink text-white'
                : 'text-ink-muted hover:bg-surface hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="fc-label flex flex-col gap-1.5 text-ink-muted">
          From
          <input
            type="datetime-local"
            value={toInputValue(range.from)}
            max={toInputValue(range.to)}
            onChange={(e) => handleCustom('from', e.target.value)}
            className="rounded-[2px] border border-line bg-surface px-2.5 py-1.5 font-mono text-xs tracking-normal text-ink normal-case"
          />
        </label>
        <label className="fc-label flex flex-col gap-1.5 text-ink-muted">
          To
          <input
            type="datetime-local"
            value={toInputValue(range.to)}
            min={toInputValue(range.from)}
            onChange={(e) => handleCustom('to', e.target.value)}
            className="rounded-[2px] border border-line bg-surface px-2.5 py-1.5 font-mono text-xs tracking-normal text-ink normal-case"
          />
        </label>
      </div>
    </div>
  );
}
