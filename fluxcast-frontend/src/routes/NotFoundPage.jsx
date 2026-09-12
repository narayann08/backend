import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <main className="grid min-h-full place-items-center px-4 py-16">
      <div className="text-center">
        <Compass className="mx-auto size-8 text-ink-muted" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-ink">Page not found</h1>
        <p className="mt-1 text-sm text-ink-muted">
          That route does not exist in FluxCast.
        </p>
        <Link
          to="/plants"
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Back to plants
        </Link>
      </div>
    </main>
  );
}
