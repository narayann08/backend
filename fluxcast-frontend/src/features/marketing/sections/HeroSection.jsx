import { ArrowRight } from 'lucide-react';

import CtaButton from '../components/CtaButton';
import ContourField from '../graphics/ContourField';
import HeroVideoCard from '../graphics/HeroVideoCard';
import { HERO } from '../content';

export default function HeroSection() {
  return (
    <section id="top" className="relative isolate overflow-hidden bg-mkt-surface">
      <div className="absolute inset-0 -z-10">
        <div className="mkt-bloom-solar absolute inset-0" />
        <div className="mkt-grid absolute inset-0 opacity-70" />
        <ContourField className="absolute inset-x-0 bottom-0 h-[65%] w-full text-mkt-brand opacity-30" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pt-10 pb-20 sm:px-8 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-16 lg:pb-28">
        <div>
          <p
            className="mkt-rise mkt-mono flex items-center gap-3 text-[13px] tracking-[0.16em] text-mkt-brand-deep uppercase"
            style={{ animationDelay: '0ms' }}
          >
            <span className="h-px w-8 bg-mkt-brand" aria-hidden="true" />
            {HERO.eyebrow}
          </p>

          <h1
            className="mkt-rise mt-7 text-[2.75rem] leading-[1.02] tracking-[-0.02em] sm:text-6xl lg:text-[4.25rem]"
            style={{ animationDelay: '90ms' }}
          >
            {HERO.title}
            <span className="mt-1.5 block text-mkt-solar italic">{HERO.titleAccent}</span>
          </h1>

          <p
            className="mkt-rise mt-8 max-w-xl text-lg leading-relaxed text-pretty text-mkt-dim"
            style={{ animationDelay: '190ms' }}
          >
            {HERO.subtitle}
          </p>

          <div
            className="mkt-rise mt-10 flex flex-wrap items-center gap-4"
            style={{ animationDelay: '270ms' }}
          >
            <CtaButton to="/auth" variant="solar" icon={ArrowRight}>
              {HERO.primaryCta}
            </CtaButton>
            <CtaButton href="#how-it-works" variant="outline">
              {HERO.secondaryCta}
            </CtaButton>
          </div>

          {/* Operator readout: the page states its own numbers up front. */}
          <dl
            className="mkt-rise mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-mkt-line pt-6"
            style={{ animationDelay: '350ms' }}
          >
            {HERO.readout.map((item) => (
              <div key={item.id}>
                <dt className="mkt-mono text-[12px] tracking-[0.14em] text-mkt-dim uppercase">
                  {item.label}
                </dt>
                <dd className="mkt-mono mt-1.5 text-lg text-mkt-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mkt-rise lg:pl-4" style={{ animationDelay: '200ms' }}>
          <HeroVideoCard />
        </div>
      </div>
    </section>
  );
}
