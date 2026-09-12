import { useNavigate } from 'react-router-dom';
import { Sun, Wind, MapPin, Gauge, Sprout, LogOut, ArrowRight, Factory } from 'lucide-react';

import { usePlants } from '../../hooks/usePlants';
import { useAuthStore } from '../../store/authStore';
import { usePlantStore } from '../../store/plantStore';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { formatDay, humanise } from '../../utils/format';

/**
 * Plant picker (plan §3).
 *
 * Every predefined role is organisation-wide, so this lists the whole fleet —
 * see ASSUMPTIONS.md. Selecting a plant caches it and routes to its dashboard.
 * The seat the operator picked at sign-in stays on screen here, because this
 * is the last point before the console where switching it is one click away.
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
    <main className="fc-grid min-h-full bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <span className="fc-title mb-9 block text-3xl leading-none text-ink">
          Flux<span className="text-solar italic">Cast</span>
        </span>

        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-line pb-7">
          <div>
            <p className="fc-label flex items-center gap-3 text-brand-dark">
              <span className="h-px w-8 bg-brand" aria-hidden="true" />
              Fleet · {data?.total ?? plants.length} sites
            </p>
            <h1 className="fc-title mt-4 text-4xl text-ink">Select a plant</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Signed in as <span className="text-ink">{user?.name}</span>
              {user?.role ? ` · ${humanise(user.role)}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="fc-label inline-flex items-center gap-2 rounded-[2px] border border-line bg-surface-raised px-3 py-2 text-ink-muted transition-colors hover:border-severity-high/40 hover:text-severity-high"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Sign out
          </button>
        </header>

        <div className="mt-8">
          {isLoading && (
            <ul
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              role="status"
              aria-label="Loading plants"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="rounded-[3px] border border-line bg-surface-raised p-5">
                  <Skeleton className="size-10 rounded-[3px]" />
                  <Skeleton className="mt-5 h-5 w-3/4" />
                  <Skeleton className="mt-4 h-3 w-1/2" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                  <Skeleton className="mt-6 h-3 w-2/5" />
                </li>
              ))}
            </ul>
          )}

          {isError && (
            <div className="max-w-xl">
              <ErrorState error={error} onRetry={refetch} title="Could not load plants" />
            </div>
          )}

          {!isLoading && !isError && plants.length === 0 && (
            <div className="rounded-[3px] border border-line bg-surface-raised">
              <EmptyState
                icon={Factory}
                title="No plants assigned"
                description="This account has no renewable plants to monitor yet. Seed the backend database or register a plant to get started."
              />
            </div>
          )}

          {plants.length > 0 && (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plants.map((plant, index) => {
                const isWind = plant.type === 'wind';
                const Icon = isWind ? Wind : Sun;

                return (
                  <li key={plant.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(plant)}
                      aria-label={`Open ${plant.name} dashboard`}
                      className={`group fc-ticks relative flex h-full w-full flex-col rounded-[3px] border border-line bg-surface-raised text-left shadow-[0_20px_50px_-34px_rgb(15_23_42/0.5)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-32px_rgb(15_23_42/0.5)] ${
                        isWind ? 'hover:border-signal/60' : 'hover:border-solar/60'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5">
                        <span className="fc-label text-ink-muted">
                          Site {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className={`fc-label ${isWind ? 'text-signal' : 'text-solar'}`}>
                          {isWind ? 'Wind' : 'Solar'}
                        </span>
                      </span>

                      <span className="flex flex-1 flex-col p-5">
                        <span className="flex items-start justify-between gap-3">
                          <span
                            className={`inline-flex size-10 items-center justify-center rounded-[3px] ${
                              isWind ? 'bg-signal/10' : 'bg-solar/10'
                            }`}
                          >
                            <Icon
                              className={`size-5 ${isWind ? 'text-signal' : 'text-solar'}`}
                              aria-hidden="true"
                            />
                          </span>
                          {plant.hasLimitedHistory && (
                            <span className="fc-label inline-flex items-center gap-1.5 rounded-[2px] border border-brand/30 bg-brand/8 px-2 py-1 text-brand-dark">
                              <Sprout className="size-3" aria-hidden="true" />
                              New site
                            </span>
                          )}
                        </span>

                        <span className="fc-title mt-5 block text-2xl leading-tight text-ink">
                          {plant.name}
                        </span>

                        <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 font-mono text-[12px] text-ink-soft">
                          <div className="flex items-center gap-2.5">
                            <Gauge
                              className="size-3.5 shrink-0 text-ink-muted"
                              aria-hidden="true"
                            />
                            <dt className="sr-only">Capacity</dt>
                            <dd>{plant.capacityMW} MW installed</dd>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <MapPin
                              className="size-3.5 shrink-0 text-ink-muted"
                              aria-hidden="true"
                            />
                            <dt className="sr-only">Location</dt>
                            <dd>
                              {plant.latitude?.toFixed(2)}°, {plant.longitude?.toFixed(2)}°
                            </dd>
                          </div>
                          {plant.commissionedDate && (
                            <div className="flex items-center gap-2.5">
                              <Sprout
                                className="size-3.5 shrink-0 text-ink-muted"
                                aria-hidden="true"
                              />
                              <dt className="sr-only">Commissioned</dt>
                              <dd>Commissioned {formatDay(plant.commissionedDate)}</dd>
                            </div>
                          )}
                        </dl>

                        <span className="fc-label mt-auto flex items-center gap-2 pt-6 text-brand-dark">
                          Open dashboard
                          <ArrowRight
                            className="size-3.5 transition-transform duration-200 group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
