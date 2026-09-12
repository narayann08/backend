import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Radio, Building2, Zap, ArrowRight } from 'lucide-react';

import { fetchRoles, loginAs } from '../../api/auth';
import { queryKeys } from '../../hooks/queryKeys';
import { useAuthStore } from '../../store/authStore';
import { ErrorState, Skeleton } from '../../components/States';

/** Icon + blurb per role, keyed by the backend's role slug. */
const ROLE_PRESENTATION = {
  'system-admin': {
    icon: ShieldCheck,
    blurb: 'Full platform access across every plant, including configuration and plant removal.',
    accent: 'text-severity-high',
  },
  'lead-grid-operator': {
    icon: Radio,
    blurb: 'Day-to-day monitoring: live generation, forecasts, risk alerts and grid actions.',
    accent: 'text-brand',
  },
  'utility-admin': {
    icon: Building2,
    blurb: 'Portfolio view for utility planning, supply commitments and curtailment decisions.',
    accent: 'text-status-higher',
  },
};

/**
 * Startup role-selection screen (plan §2.1).
 *
 * Login is one click and takes no credentials: choosing a role fetches the
 * matching predefined user from the backend. Roles come from
 * `GET /auth/roles` rather than being hardcoded, so the screen stays correct
 * if the backend's role set changes.
 */
export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setSession } = useAuthStore();
  const [pendingRole, setPendingRole] = useState(null);
  const [loginError, setLoginError] = useState(null);

  const rolesQuery = useQuery({ queryKey: queryKeys.roles, queryFn: fetchRoles });

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
    <main className="flex min-h-full items-center justify-center bg-gradient-to-br from-surface via-surface to-severity-low-soft px-4 py-10">
      <div className="w-full max-w-4xl">
        <header className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised px-3 py-1 text-xs font-medium text-ink-muted">
            <Zap className="size-3.5 text-brand" aria-hidden="true" />
            Renewable generation forecasting &amp; grid decisions
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">FluxCast</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Choose a role to continue. No password needed — each role opens the workspace for a
            predefined operator account.
          </p>
        </header>

        {rolesQuery.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-line bg-surface-raised p-5">
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        )}

        {rolesQuery.isError && (
          <ErrorState
            error={rolesQuery.error}
            onRetry={rolesQuery.refetch}
            title="Could not load roles"
          />
        )}

        {rolesQuery.isSuccess && (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rolesQuery.data.map((role) => {
                const presentation = ROLE_PRESENTATION[role.key] || {};
                const Icon = presentation.icon || ShieldCheck;
                const isPending = pendingRole === role.key;
                const isDisabled = Boolean(pendingRole);

                return (
                  <li key={role.key}>
                    <button
                      type="button"
                      onClick={() => handleSelectRole(role.key)}
                      disabled={isDisabled}
                      aria-busy={isPending}
                      className="group flex h-full w-full flex-col items-start gap-3 rounded-xl border border-line bg-surface-raised p-5 text-left shadow-sm transition hover:border-brand hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="rounded-lg bg-surface p-2">
                        <Icon
                          className={`size-5 ${presentation.accent || 'text-brand'}`}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="text-base font-semibold text-ink">{role.label}</span>
                      <span className="flex-1 text-sm text-ink-muted">{presentation.blurb}</span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand">
                        {isPending ? 'Signing in…' : 'Continue'}
                        {!isPending && (
                          <ArrowRight
                            className="size-4 transition group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {loginError && (
              <div className="mt-5">
                <ErrorState error={loginError} title="Sign-in failed" compact />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
