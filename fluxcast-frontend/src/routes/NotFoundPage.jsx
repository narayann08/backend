import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <main className="fc-grid grid min-h-full place-items-center bg-surface px-5 py-16">
      <div className="text-center">
        <Compass className="mx-auto size-7 text-ink-muted" aria-hidden="true" />
        <p className="fc-label mt-5 text-ink-muted">Error 404</p>
        <h1 className="fc-title mt-2 text-3xl text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-ink-muted">That route does not exist in FluxCast.</p>
        <Link
          to="/plants"
          className="fc-label mt-6 inline-block rounded-[2px] bg-ink px-4 py-3 text-white transition-colors hover:bg-brand-dark"
        >
          Back to plants
        </Link>
      </div>
    </main>
  );
}
