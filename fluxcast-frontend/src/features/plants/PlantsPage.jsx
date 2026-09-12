import { useNavigate } from 'react-router-dom';
import { Sun, Wind, MapPin, Gauge, Sprout, LogOut, Zap, Factory } from 'lucide-react';

import { usePlants } from '../../hooks/usePlants';
import { useAuthStore } from '../../store/authStore';
import { usePlantStore } from '../../store/plantStore';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { formatDay } from '../../utils/format';

/**
 * Plant picker (plan §3).
 *
 * Every predefined role is organisation-wide, so this lists the whole fleet —
 * see ASSUMPTIONS.md. Selecting a plant caches it and routes to its dashboard.
 */
export default function PlantsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const setSelectedPlant = usePlantStore((state) => state.setSelectedPlant);
  const { data, isLoading, isError, error, refetch } = usePlants();

  function handleSelect(plant) {
    setSelectedPlant(plant);
    navigate(`/plants/${plant.id}/dashboard`);
  }

  function handleLogout() {
    logout();
    navigate('/auth', { replace: true });
  }

  const plants = data?.plants ?? [];

  return (
    <main className="mx-auto min-h-full w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 text-xs font-medium text-ink-muted">
            <Zap className="size-3.5 text-brand" aria-hidden="true" />
            FluxCast
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Select a plant</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Signed in as <span className="font-medium text-ink">{user?.name}</span>
            {data?.total !== undefined && ` · ${data.total} plant${data.total === 1 ? '' : 's'} available`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm font-medium text-ink-muted transition hover:text-severity-high"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </header>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-line bg-surface-raised p-5">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <ErrorState error={error} onRetry={refetch} title="Could not load plants" />
      )}

      {!isLoading && !isError && plants.length === 0 && (
        <div className="rounded-xl border border-line bg-surface-raised">
          <EmptyState
            icon={Factory}
            title="No plants assigned"
            description="This account has no renewable plants to monitor yet. Seed the backend database or register a plant to get started."
          />
        </div>
      )}

      {plants.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plants.map((plant) => {
            const Icon = plant.type === 'wind' ? Wind : Sun;
            return (
              <li key={plant.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(plant)}
                  className="flex h-full w-full flex-col items-start gap-3 rounded-xl border border-line bg-surface-raised p-5 text-left shadow-sm transition hover:border-brand hover:shadow-md"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="rounded-lg bg-surface p-2">
                      <Icon
                        className={`size-5 ${plant.type === 'wind' ? 'text-brand' : 'text-severity-medium'}`}
                        aria-hidden="true"
                      />
                    </span>
                    {plant.hasLimitedHistory && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-status-higher/30 bg-status-higher-soft px-2 py-0.5 text-xs font-medium text-status-higher">
                        <Sprout className="size-3" aria-hidden="true" />
                        New site
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-semibold text-ink">{plant.name}</h2>

                  <dl className="w-full space-y-1.5 text-xs text-ink-muted">
                    <div className="flex items-center gap-1.5">
                      <Gauge className="size-3.5 shrink-0" aria-hidden="true" />
                      <dt className="sr-only">Capacity</dt>
                      <dd>{plant.capacityMW} MW installed capacity</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      <dt className="sr-only">Location</dt>
                      <dd>
                        {plant.latitude?.toFixed(2)}°, {plant.longitude?.toFixed(2)}°
                      </dd>
                    </div>
                    {plant.commissionedDate && (
                      <div className="flex items-center gap-1.5">
                        <Sprout className="size-3.5 shrink-0" aria-hidden="true" />
                        <dt className="sr-only">Commissioned</dt>
                        <dd>Commissioned {formatDay(plant.commissionedDate)}</dd>
                      </div>
                    )}
                  </dl>

                  <span className="mt-auto pt-2 text-sm font-medium text-brand">
                    Open dashboard →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
