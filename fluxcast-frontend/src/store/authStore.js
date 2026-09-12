import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerUserProvider } from '../api/client';

/**
 * Session state.
 *
 * FluxCast has no token: "logged in" means we know which predefined user was
 * selected. Persisting to localStorage is what keeps a refresh from bouncing
 * the operator back to the role picker. Clearing site data logs you out; there
 * is nothing to invalidate server-side (see ASSUMPTIONS.md).
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      /** @type {{id: string, name: string, email: string, role: string}|null} */
      user: null,
      /** The role slug used at login, e.g. 'lead-grid-operator'. */
      roleKey: null,

      setSession: (user, roleKey) => set({ user, roleKey }),
      logout: () => set({ user: null, roleKey: null }),
    }),
    { name: 'fluxcast-auth' },
  ),
);

/** Selector helpers — keep components from re-rendering on unrelated changes. */
export const selectUser = (state) => state.user;
export const selectIsAuthenticated = (state) => Boolean(state.user);

// Let the axios interceptor read the current user without importing this store
// (which would be circular).
registerUserProvider(() => useAuthStore.getState().user);
