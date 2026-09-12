import Section from '../components/Section';
import { MARKETING_ICONS } from '../icons';
import { FEATURES } from '../content';

/*
 * A 2×2 field of panels divided by shared hairlines — one instrument face
 * split into quadrants rather than four floating cards.
 */
export default function FeaturesSection() {
  return (
    <Section
      id="features"
      tone="sunken"
      label={FEATURES.label}
      heading={FEATURES.heading}
      lede={FEATURES.lede}
    >
      <div className="grid border-t border-l border-mkt-line sm:grid-cols-2">
        {FEATURES.items.map((item) => {
          const Icon = MARKETING_ICONS[item.icon];
          return (
            <article
              key={item.id}
              className="mkt-reveal group relative border-r border-b border-mkt-line p-7 transition-colors hover:bg-mkt-raised lg:p-9"
            >
              <div className="flex items-center justify-between gap-4">
                <Icon
                  className="size-5 text-mkt-signal transition-transform duration-300 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
                <span className="mkt-mono text-[12px] tracking-[0.14em] text-mkt-dim">
                  {item.index}
                </span>
              </div>
              <h3 className="mt-7 text-2xl leading-snug text-balance text-mkt-ink">
                {item.title}
              </h3>
              <p className="mt-3.5 leading-relaxed text-pretty text-mkt-dim">{item.body}</p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
