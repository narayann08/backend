import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  Radio,
  Building2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

import ContourField from '../marketing/graphics/ContourField';
import { fetchRoles, loginAs } from '../../api/auth';
import { queryKeys } from '../../hooks/queryKeys';
import { useAuthStore } from '../../store/authStore';
import { Skeleton } from '../../components/States';

/*
 * Seat plan, keyed by the backend's role slug. Copy and accent live here so the
 * card below is pure layout, and an unrecognised slug still renders.
 *
 * Each role gets its own accent so the three seats are told apart at a glance
 * before any of them is read: rust for the one that can delete things, signal
 * blue for the everyday console, deep blue for the portfolio desk.
 */
const ROLE_PRESENTATION = {
  'system-admin': {
    icon: ShieldCheck,
    seat: 'Seat 01',
    clearance: 'Full access',
    blurb: 'Full platform access across every plant, including configuration and plant removal.',
    scope: ['Every plant in the fleet', 'Plant configuration', 'Add and remove sites'],
    accentText: 'text-mkt-solar',
    accentTint: 'bg-mkt-solar/10',
    accentRule: 'bg-mkt-solar',
    accentBorder: 'hover:border-mkt-solar/60',
  },
  'lead-grid-operator': {
    icon: Radio,
    seat: 'Seat 02',
    clearance: 'Operations',
    blurb: 'Day-to-day monitoring: live generation, forecasts, risk alerts and grid actions.',
    scope: ['Live generation vs forecast', 'Risk alerts, 24–72h', 'Grid actions and decisions'],
    accentText: 'text-mkt-signal',
    accentTint: 'bg-mkt-signal/10',
    accentRule: 'bg-mkt-signal',
    accentBorder: 'hover:border-mkt-signal/60',
  },
  'utility-admin': {
    icon: Building2,
    seat: 'Seat 03',
    clearance: 'Portfolio',
    blurb: 'Portfolio view for utility planning, supply commitments and curtailment decisions.',
    scope: ['Fleet-wide portfolio view', 'Supply commitments', 'Curtailment planning'],
    accentText: 'text-mkt-brand-deep',
    accentTint: 'bg-mkt-brand-deep/10',
    accentRule: 'bg-mkt-brand-deep',
    accentBorder: 'hover:border-mkt-brand-deep/60',
  },
};

const FALLBACK_PRESENTATION = {
  icon: ShieldCheck,
  seat: 'Seat',
  clearance: 'Access',
  blurb: 'Opens the FluxCast console with this role’s permissions.',
  scope: [],
  accentText: 'text-mkt-brand-deep',
  accentTint: 'bg-mkt-brand/10',
  accentRule: 'bg-mkt-brand',
  accentBorder: 'hover:border-mkt-brand/60',
};

/** Square-cornered alert in the instrument vocabulary — the console's rounded ErrorState would read as a different product here. */
function AuthAlert({ title, error, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 border border-mkt-flare/35 bg-mkt-flare/5 p-4"
    >
      <p className="mkt-mono flex items-center gap-2 text-[12px] tracking-[0.12em] text-mkt-flare uppercase">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        {title}
      </p>
      <p className="text-sm text-mkt-ink">{error?.message || 'Unexpected error.'}</p>
      {error?.detail && <p className="text-sm text-mkt-dim">{error.detail}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mkt-mono mt-1 inline-flex items-center gap-2 border border-mkt-flare/40 px-3 py-2 text-[12px] tracking-[0.1em] text-mkt-flare uppercase transition-colors hover:bg-mkt-flare/10"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

/** One seat: an instrument panel that happens to be a button. */
function RoleCard({ role, index, isPending, isDisabled, onSelect }) {
  const p = ROLE_PRESENTATION[role.key] || FALLBACK_PRESENTATION;
  const Icon = p.icon;

  return (
    <li className="mkt-rise" style={{ animationDelay: `${180 + index * 90}ms` }}>
      <button
        type="button"
        onClick={() => onSelect(role.key)}
        disabled={isDisabled}
        aria-busy={isPending}
        aria-label={`Sign in as ${role.label}`}
        className={`group relative flex h-full w-full flex-col overflow-hidden rounded-[3px] border bg-mkt-raised text-left shadow-[0_24px_60px_-34px_rgb(15_23_42/0.45)] transition duration-200 disabled:cursor-not-allowed ${
          isPending ? 'border-mkt-brand' : 'border-mkt-line'
        } ${isDisabled ? '' : `${p.accentBorder} hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-30px_rgb(15_23_42/0.5)]`} ${
          isDisabled && !isPending ? 'opacity-45' : ''
        }`}
      >
        {/* Registration marks, same as the mockups on the public page. */}
        <span className="pointer-events-none absolute -top-px -left-px size-2.5 border-t border-l border-mkt-brand" />
        <span className="pointer-events-none absolute -top-px -right-px size-2.5 border-t border-r border-mkt-brand" />
        <span className="pointer-events-none absolute -bottom-px -left-px size-2.5 border-b border-l border-mkt-brand" />
        <span className="pointer-events-none absolute -right-px -bottom-px size-2.5 border-r border-b border-mkt-brand" />

        <span className="flex items-center justify-between gap-3 border-b border-mkt-line px-5 py-2.5">
          <span className="mkt-mono text-[12px] tracking-[0.12em] text-mkt-dim uppercase">
            {p.seat}
          </span>
          <span className={`mkt-mono text-[12px] tracking-[0.08em] ${p.accentText}`}>
            {p.clearance}
          </span>
        </span>

        <span className="flex flex-1 flex-col p-5">
          <span
            className={`inline-flex size-11 items-center justify-center rounded-[3px] ${p.accentTint}`}
          >
            <Icon className={`size-5 ${p.accentText}`} aria-hidden="true" />
          </span>

          <span className="mkt-display mt-5 block text-2xl leading-tight text-mkt-ink">
            {role.label}
          </span>
          <span className="mt-2.5 block text-sm leading-relaxed text-pretty text-mkt-dim">
            {p.blurb}
          </span>

          {p.scope.length > 0 && (
            <span className="mt-5 flex flex-col gap-2 border-t border-mkt-line pt-4">
              {p.scope.map((item) => (
                <span
                  key={item}
                  className="mkt-mono flex items-center gap-2.5 text-[12px] text-mkt-ink-soft"
                >
                  <span className={`h-px w-3 shrink-0 ${p.accentRule}`} aria-hidden="true" />
                  {item}
                </span>
              ))}
            </span>
          )}

          <span className="mkt-mono mt-auto flex items-center gap-2 pt-6 text-[12px] tracking-[0.1em] text-mkt-brand-deep uppercase">
            {isPending ? (
              <>
                <span className="mkt-blip size-1.5 rounded-full bg-mkt-signal" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                Enter console
                <ArrowRight
                  className="size-3.5 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * Startup role-selection screen (plan §2.1) — the seam between the public page
 * and the console, so it wears the marketing instrument theme rather than the
 * console's own chrome.
 *
 * Login is one click and takes no credentials: choosing a role fetches the
 * matching predefined user from the backend. Roles come from `GET /auth/roles`
 * rather than being hardcoded, so the screen stays correct if the backend's
 * role set changes.
 */
export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setSession } = useAuthStore();
  const [pendingRole, setPendingRole] = useState(null);
  const [loginError, setLoginError] = useState(null);

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles,
    queryFn: fetchRoles,
  });

  // Already signed in — skip the picker.
  if (user) return <Navigate to={location.state?.from || '/plants'} replace />;

  async function handleSelectRole(roleKey) {
    setPendingRole(roleKey);
    setLoginError(null);
    try {
      const loggedInUser = await loginAs(roleKey);
      setSession(loggedInUser, roleKey);
      navigate(location.state?.from || '/plants', { replace: true });
    } catch (error) {
      setLoginError(error);
      setPendingRole(null);
    }
  }

  return (
    <main className="mkt-root relative isolate flex min-h-full flex-col overflow-hidden bg-mkt-surface">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="mkt-bloom-solar absolute inset-0" />
        <div className="mkt-bloom-signal absolute inset-0" />
        <div className="mkt-grid absolute inset-0 opacity-70" />
        <ContourField className="absolute inset-x-0 bottom-0 h-[55%] w-full text-mkt-brand opacity-25" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-5 sm:px-8">
        <Link to="/" className="mkt-display text-3xl leading-none text-mkt-ink">
          Flux<span className="text-mkt-solar italic">Cast</span>
        </Link>
        <Link
          to="/"
          className="mkt-mono inline-flex items-center gap-2 text-[12px] tracking-[0.12em] text-mkt-dim uppercase transition-colors hover:text-mkt-brand-deep"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to site
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-8 pb-16 sm:px-8">
        <header className="max-w-2xl">
          <p
            className="mkt-rise mkt-mono flex items-center gap-3 text-[13px] tracking-[0.16em] text-mkt-brand-deep uppercase"
            style={{ animationDelay: '0ms' }}
          >
            <span className="h-px w-8 bg-mkt-brand" aria-hidden="true" />
            Live demo · Role selection
          </p>

          <h1
            className="mkt-rise mt-6 text-[2.25rem] leading-[1.05] tracking-[-0.02em] sm:text-5xl"
            style={{ animationDelay: '80ms' }}
          >
            Pick your seat
            <span className="mt-1 block text-mkt-solar italic">at the console.</span>
          </h1>

          <p
            className="mkt-rise mt-6 text-lg leading-relaxed text-pretty text-mkt-dim"
            style={{ animationDelay: '140ms' }}
          >
            No password, no signup. Every seat opens the same live fleet — what changes is the
            permissions, and what the console lets you do with them.
          </p>
        </header>

        <div className="mt-12">
          {rolesQuery.isLoading && (
            <ul
              className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
              role="status"
              aria-label="Loading roles"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <li
                  key={i}
                  className="rounded-[3px] border border-mkt-line bg-mkt-raised p-5 shadow-[0_24px_60px_-34px_rgb(15_23_42/0.45)]"
                >
                  <Skeleton className="size-11 rounded-[3px]" />
                  <Skeleton className="mt-5 h-5 w-2/3" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-4/5" />
                  <Skeleton className="mt-6 h-3 w-1/2" />
                </li>
              ))}
            </ul>
          )}

          {rolesQuery.isError && (
            <div className="max-w-xl">
              <AuthAlert
                title="Could not load roles"
                error={rolesQuery.error}
                onRetry={rolesQuery.refetch}
              />
            </div>
          )}

          {rolesQuery.isSuccess && (
            <>
              <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {rolesQuery.data.map((role, index) => (
                  <RoleCard
                    key={role.key}
                    role={role}
                    index={index}
                    isPending={pendingRole === role.key}
                    isDisabled={Boolean(pendingRole)}
                    onSelect={handleSelectRole}
                  />
                ))}
              </ul>

              {loginError && (
                <div className="mt-6 max-w-xl">
                  <AuthAlert title="Sign-in failed" error={loginError} />
                </div>
              )}

              <p
                className="mkt-rise mkt-mono mt-10 border-t border-mkt-line pt-5 text-[12px] tracking-[0.08em] text-mkt-dim"
                style={{ animationDelay: '450ms' }}
              >
                Demo environment · 8-plant Indian renewable fleet · Switch seats any time by signing
                out of the console.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
