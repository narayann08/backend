import { Link } from 'react-router-dom';

import { FOOTER } from '../content';

const LINK_CLASS = 'text-sm text-mkt-dim transition-colors hover:text-mkt-signal';

export default function FooterSection() {
  return (
    <footer className="border-t border-mkt-line bg-mkt-surface px-5 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="mkt-display text-2xl text-mkt-ink">
              Flux<span className="text-mkt-solar italic">Cast</span>
            </p>
            <p className="mt-3 max-w-xs leading-relaxed text-pretty text-mkt-dim">
              {FOOTER.tagline}
            </p>
          </div>

          {FOOTER.columns.map((column) => (
            <nav key={column.id} aria-label={column.title}>
              <h2 className="mkt-mono text-[12px] tracking-[0.14em] text-mkt-dim uppercase">
                {column.title}
              </h2>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className={LINK_CLASS}>
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className={LINK_CLASS}>
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mkt-mono mt-14 flex flex-col gap-2 border-t border-mkt-line pt-7 text-[12px] tracking-wide text-mkt-dim sm:flex-row sm:items-center sm:justify-between">
          <p>{FOOTER.attribution}</p>
          <p>© {new Date().getFullYear()} FluxCast</p>
        </div>
      </div>
    </footer>
  );
}
