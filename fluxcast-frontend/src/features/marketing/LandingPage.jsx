import MarketingNav from './MarketingNav';
import HeroSection from './sections/HeroSection';
import PainPointsSection from './sections/PainPointsSection';
import FeaturesSection from './sections/FeaturesSection';
import HowItWorksSection from './sections/HowItWorksSection';
import UspSection from './sections/UspSection';
import ImpactSection from './sections/ImpactSection';
import DataSourcesSection from './sections/DataSourcesSection';
import FinalCtaSection from './sections/FinalCtaSection';
import FooterSection from './sections/FooterSection';

/**
 * Public landing page at `/`.
 *
 * `.mkt-root` is what opts this subtree into the brand webfonts and the dark
 * ground; the console deliberately keeps the system stack and its own palette.
 */
export default function LandingPage() {
  return (
    <div className="mkt-root">
      <a
        href="#main"
        className="mkt-mono sr-only text-[11px] uppercase focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-100 focus:bg-mkt-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <MarketingNav />
      {/* Skipping lands on the hero, not past it — the h1 and primary CTA are here. */}
      <main id="main" tabIndex={-1}>
        <HeroSection />
        <PainPointsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <UspSection />
        <ImpactSection />
        <DataSourcesSection />
        <FinalCtaSection />
      </main>
      <FooterSection />
    </div>
  );
}
