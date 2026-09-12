import Section from '../components/Section';
import { PAIN_POINTS } from '../content';

/*
 * A ledger of failures rather than a row of cards: index, name, consequence.
 * Hairlines instead of card chrome keep the weight on the type.
 */
export default function PainPointsSection() {
  return (
    <Section
      id="problem"
      tone="surface"
      label={PAIN_POINTS.label}
      heading={PAIN_POINTS.heading}
      lede={PAIN_POINTS.lede}
    >
      <ol className="border-t border-mkt-line">
        {PAIN_POINTS.items.map((item, index) => (
          <li
            key={item.id}
            className="mkt-reveal group grid gap-x-8 gap-y-3 border-b border-mkt-line py-8 md:grid-cols-[4rem_minmax(0,18rem)_1fr] md:items-baseline md:py-10"
          >
            <span className="mkt-mono text-sm text-mkt-flare transition-colors group-hover:text-mkt-ink">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="text-2xl leading-snug text-balance text-mkt-ink">{item.title}</h3>
            <p className="max-w-xl leading-relaxed text-pretty text-mkt-dim">{item.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
