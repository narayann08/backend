import { ArrowRight } from 'lucide-react';

import CtaButton from './components/CtaButton';
import { selectIsAuthenticated, useAuthStore } from '../../store/authStore';

const LINKS = [
  { label: 'Problem', href: '#problem' },
  { label: 'Product', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Why FluxCast', href: '#why-fluxcast' },
];

/*
 * A signed-in visitor is not redirected away from `/`, so the action adapts
 * instead: it offers the console to someone who already has a session, and the
 * role picker to everyone else.
 */
export default function MarketingNav() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  return (
    <header className="sticky top-0 z-50 border-b border-mkt-line bg-mkt-surface/80 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-3.5 sm:px-8"
      >
        <a href="#top" className="mkt-display text-3xl leading-none text-mkt-ink">
          Flux<span className="text-mkt-solar italic">Cast</span>
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="mkt-mono text-[13px] tracking-[0.1em] text-mkt-dim uppercase transition-colors hover:text-mkt-signal"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <CtaButton
          to={isAuthenticated ? '/plants' : '/auth'}
          variant={isAuthenticated ? 'quiet' : 'solar'}
          size="sm"
          icon={ArrowRight}
        >
          {isAuthenticated ? 'Dashboard' : 'Live demo'}
        </CtaButton>
      </nav>
    </header>
  );
}
