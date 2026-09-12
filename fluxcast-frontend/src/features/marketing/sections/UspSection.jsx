import Section from '../components/Section';
import AlertCardGraphic from '../graphics/AlertCardGraphic';
import ForecastCardGraphic from '../graphics/ForecastCardGraphic';
import { MARKETING_ICONS } from '../icons';
import { USP } from '../content';

/*
 * The two mockups are the same components the hero uses, rendered smaller —
 * the reuse is the point, so the site reads as one machine.
 *
 * Keyed off each item's `graphic` field rather than its `id`, so the pairing
 * is stated in content.js instead of resting on an id that looks safe to
 * rename.
 */
const GRAPHICS = {
  forecast: <ForecastCardGraphic size="mini" className="h-full" />,
  alert: <AlertCardGraphic className="h-full" />,
};

export default function UspSection() {
  return (
    <Section id="why-fluxcast" tone="sunken" label={USP.label} heading={USP.heading}>
      <div className="grid gap-14 md:grid-cols-2 md:gap-10">
        {USP.items.map((item, index) => {
          const Icon = MARKETING_ICONS[item.icon];
          return (
            <div key={item.id} className="mkt-reveal flex h-full flex-col">
              <div className="flex items-center gap-4">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] border border-mkt-line bg-mkt-raised text-mkt-brand-deep">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="mkt-mono text-[12px] tracking-[0.14em] text-mkt-dim">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="h-px flex-1 bg-mkt-line" aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-3xl leading-snug text-balance text-mkt-ink">{item.title}</h3>
              <p className="mt-4 max-w-md leading-relaxed text-pretty text-mkt-dim">{item.body}</p>
              <div className="mt-9 flex-1">{GRAPHICS[item.graphic]}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
