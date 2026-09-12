import Section from '../components/Section';
import { MARKETING_ICONS } from '../icons';
import { HOW_IT_WORKS } from '../content';

/*
 * A signal path, not a row of badges: one rule runs the width of the band and
 * each step sits on it as a node. The loop closes, so the last node carries a
 * return marker back to the first.
 */
export default function HowItWorksSection() {
  return (
    <Section id="how-it-works" tone="surface" label={HOW_IT_WORKS.label} heading={HOW_IT_WORKS.heading}>
      <ol className="relative grid gap-12 md:grid-cols-4 md:gap-8">
        {/* The rail. Sits behind the nodes and stops short of both ends. */}
        <div
          className="absolute top-[7px] right-[12.5%] left-[12.5%] hidden h-px bg-gradient-to-r from-mkt-line via-mkt-brand/50 to-mkt-line md:block"
          aria-hidden="true"
        />

        {HOW_IT_WORKS.steps.map((step, index) => {
          const Icon = MARKETING_ICONS[step.icon];
          return (
            <li key={step.id} className="mkt-reveal relative md:text-center">
              <span
                className="relative z-10 mb-7 flex size-3.5 items-center justify-center rounded-full border border-mkt-brand bg-mkt-surface md:mx-auto"
                aria-hidden="true"
              >
                <span className="size-1.5 rounded-full bg-mkt-signal" />
              </span>

              <div className="flex items-center gap-2.5 md:justify-center">
                <Icon className="size-4 text-mkt-dim" aria-hidden="true" />
                <span className="mkt-mono text-[12px] tracking-[0.14em] text-mkt-dim uppercase">
                  Step {String(index + 1).padStart(2, '0')}
                </span>
              </div>

              <h3 className="mt-3 text-2xl text-mkt-ink">{step.title}</h3>
              <p className="mt-2.5 leading-relaxed text-pretty text-mkt-dim md:mx-auto md:max-w-[15rem]">
                {step.body}
              </p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
