import { ArrowRight } from 'lucide-react';

import CtaButton from '../components/CtaButton';
import ContourField from '../graphics/ContourField';
import { FINAL_CTA } from '../content';

/*
 * Bookends the hero: the same contour field and bloom, inverted in direction,
 * so the page closes where it opened.
 */
export default function FinalCtaSection() {
  return (
    <section
      id="get-started"
      className="relative isolate overflow-hidden border-t border-mkt-line bg-mkt-surface px-5 py-28 sm:px-8 lg:py-36"
    >
      <div className="absolute inset-0 -z-10">
        <div className="mkt-bloom-signal absolute inset-0" />
        <div className="mkt-grid absolute inset-0 opacity-50" />
        <ContourField className="absolute inset-x-0 top-0 h-full w-full text-mkt-brand opacity-25" />
      </div>

      <div className="mkt-reveal mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <h2 className="text-4xl leading-[1.08] text-balance sm:text-5xl lg:text-6xl">
          {FINAL_CTA.heading}
          <span className="mt-1.5 block text-mkt-solar italic">{FINAL_CTA.headingAccent}</span>
        </h2>
        <p className="mt-7 max-w-xl text-lg text-pretty text-mkt-dim">{FINAL_CTA.subheading}</p>
        <div className="mt-10">
          <CtaButton to="/auth" variant="solar" icon={ArrowRight}>
            {FINAL_CTA.cta}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
