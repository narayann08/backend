import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard, LineChart, Lightbulb, ChevronLeft, LogOut, Menu, X, Sun, Wind,
} from 'lucide-react';

import { usePlant } from '../hooks/usePlants';
import { useAlertSocket } from '../hooks/useAlerts';
import { useAuthStore } from '../store/authStore';
import { usePlantStore } from '../store/plantStore';
import { humanise } from '../utils/format';

const NAV_ITEMS = [
  { to: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: 'history', label: 'History', icon: LineChart },
  { to: 'decisions', label: 'Decisions', icon: Lightbulb },
];

/**
 * Shell for every plant-scoped screen: persistent sidebar plus an outlet.
 *
 * Also the single place the alert socket is opened, so one connection serves
 * the whole session rather than one per panel.
 */
export default function DashboardLayout() {
  const { plantId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { selectedPlant, setSelectedPlant } = usePlantStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useAlertSocket();

  const plantQuery = usePlant(plantId);

  // Keep the cached plant in step with the URL — covers deep links and hard
  // refreshes, where the store may hold a different plant or nothing at all.
  useEffect(() => {
    if (plantQuery.data && plantQuery.data.id !== selectedPlant?.id) {
      setSelectedPlant(plantQuery.data);
    }
  }, [plantQuery.data, selectedPlant?.id, setSelectedPlant]);

  // Show the cached name instantly on refresh, then the fetched one.
  const plant = plantQuery.data || (selectedPlant?.id === plantId ? selectedPlant : null);
  const PlantIcon = plant?.type === 'wind' ? Wind : Sun;

  function handleLogout() {
    logout();
    navigate('/auth', { replace: true });
  }

  const navLinkClass = ({ isActive }) =>
    `fc-label flex items-center gap-3 rounded-[2px] px-3 py-2.5 transition-colors ${
      isActive ? 'bg-ink text-white' : 'text-ink-muted hover:bg-surface hover:text-ink'
    }`;

  const sidebar = (
    <div className="flex h-full flex-col gap-7 p-5">
      <div>
        <button
          type="button"
          onClick={() => navigate('/plants')}
          className="fc-label inline-flex items-center gap-1.5 text-ink-muted transition-colors hover:text-brand-dark"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          All plants
        </button>

        <div className="mt-5 flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-brand/10">
            <PlantIcon className="size-4 text-brand" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="fc-title truncate text-xl text-ink" title={plant?.name}>
              {plant?.name || 'Loading plant…'}
            </h1>
            {plant && (
              <p className="truncate font-mono text-[12px] text-ink-muted">
                {plant.type === 'wind' ? 'Wind farm' : 'Solar park'}
                {plant.capacityMW ? ` · ${plant.capacityMW} MW` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      <nav aria-label="Plant sections" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={navLinkClass} onClick={() => setMobileNavOpen(false)}>
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-line pt-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-[3px] bg-solar/10 font-mono text-[12px] text-solar">
            {user?.name?.slice(0, 1) || '?'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{user?.name}</p>
            <p className="fc-label truncate text-ink-muted">
              {user?.role ? humanise(user.role) : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="fc-label flex w-full items-center gap-2 rounded-[2px] px-3 py-2.5 text-ink-muted transition-colors hover:bg-severity-high-soft hover:text-severity-high"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-screen flex-col bg-surface lg:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="fc-title shrink-0 text-xl text-ink">
            Flux<span className="text-solar italic">Cast</span>
          </span>
          <span className="truncate font-mono text-[12px] text-ink-muted">{plant?.name}</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen((open) => !open)}
          aria-expanded={mobileNavOpen}
          aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          className="rounded-[2px] border border-line p-1.5 text-ink-muted"
        >
          {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {mobileNavOpen && (
        <div className="border-b border-line bg-surface-raised lg:hidden">{sidebar}</div>
      )}

      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface-raised lg:block">
        {sidebar}
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <Outlet context={{ plant }} />
      </main>
    </div>
  );
}
