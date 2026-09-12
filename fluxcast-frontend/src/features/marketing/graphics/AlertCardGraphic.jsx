import { BatteryCharging, TriangleAlert } from 'lucide-react';

import MockCard from '../components/MockCard';
import { NOW_HOUR } from './forecastSeries';

/**
 * Companion to ForecastCardGraphic — the "and here is what to do about it"
 * half. Shares MockCard's chrome so the two read as one machine.
 *
 * The day strip runs on the same clock as the forecast plot beside it: NOW
 * sits where the plot's marker sits, and the flagged window is downstream of
 * it, because a risk raised at the moment it arrives is not proactive.
 */

const LAST_HOUR = 23;
const RISK_FROM = 15;
const RISK_TO = 18;

const pct = (hour) => `${((hour / LAST_HOUR) * 100).toFixed(2)}%`;

export default function AlertCardGraphic({ className = '' }) {
  return (
    <MockCard
      className={className}
      label="Risk window"
      caption="Watching"
      role="img"
      aria-label="Illustrative FluxCast alert: an over-generation risk window is flagged for 15:00 to 18:00, ahead of the current hour, with a recommended action to charge storage."
    >
      <div className="flex h-full flex-col">
        {/* The day, with the flagged hours picked out of it. */}
        <div>
          <div className="mkt-mono flex items-center justify-between text-[11px] tracking-[0.1em] text-mkt-dim">
            <span>00:00</span>
            <span>12:00</span>
            <span>24:00</span>
          </div>
          <div className="relative mt-2 h-2.5 rounded-[1px] bg-mkt-sunken">
            <span
              className="absolute inset-y-0 rounded-[1px] bg-mkt-flare/70"
              style={{ left: pct(RISK_FROM), width: pct(RISK_TO - RISK_FROM) }}
              aria-hidden="true"
            />
            <span
              className="absolute -top-1 -bottom-1 w-px bg-mkt-solar"
              style={{ left: pct(NOW_HOUR) }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 border-t border-mkt-line pt-4">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[3px] border border-mkt-flare/40 bg-mkt-flare/10 text-mkt-flare">
            <TriangleAlert className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] text-mkt-ink">Over-generation risk</p>
            <p className="mkt-mono mt-1.5 text-[12px] tracking-wide text-mkt-dim">
              15:00–18:00 · CONFIDENCE 0.82
            </p>
          </div>
        </div>

        <div className="mt-auto border-t border-mkt-line pt-4">
          <p className="mkt-mono text-[12px] tracking-[0.12em] text-mkt-dim uppercase">
            Recommended action
          </p>
          <p className="mt-2 flex items-center gap-2 text-[15px] text-mkt-brand-deep">
            <BatteryCharging className="size-4 shrink-0" aria-hidden="true" />
            Charge storage to 90%
          </p>
        </div>
      </div>
    </MockCard>
  );
}
