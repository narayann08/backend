import Section from '../components/Section';
import { IMPACT } from '../content';

/*
 * A field of panels, same pattern as FeaturesSection, so the numbers read as
 * part of the one light instrument face rather than a dropped-in dark block.
 *
 * Each stat is a reversed column: the label is the term so it leads in the
 * DOM, but the value is what should read first on the page.
 */
export default function ImpactSection() {
  return (
    <Section id="impact" tone="sunken" label={IMPACT.label} heading={IMPACT.heading}>
      <dl className="grid gap-px overflow-hidden border border-mkt-line bg-mkt-line sm:grid-cols-2 lg:grid-cols-4">
        {IMPACT.stats.map((stat) => (
          <div
            key={stat.id}
            className="mkt-reveal flex flex-col-reverse gap-3 bg-mkt-raised p-7 lg:p-8"
          >
            <dt className="text-sm leading-relaxed text-pretty text-mkt-dim">{stat.label}</dt>
            <dd className="flex items-baseline gap-2">
              <span className="mkt-display text-5xl leading-none tracking-tight text-mkt-ink lg:text-6xl">
                {stat.value}
              </span>
              {stat.unit && (
                <span className="mkt-mono text-[13px] tracking-[0.1em] text-mkt-brand-deep uppercase">
                  {stat.unit}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mkt-mono mt-8 text-[12px] leading-relaxed tracking-wide text-mkt-dim">
        {IMPACT.disclaimer}
      </p>
    </Section>
  );
}
