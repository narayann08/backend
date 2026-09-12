import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import AuthPage from './features/auth/AuthPage';
import PlantsPage from './features/plants/PlantsPage';
import NotFoundPage from './routes/NotFoundPage';
import { Skeleton } from './components/States';

/*
 * Leaflet and Recharts together are most of the bundle, and neither is needed
 * to reach the role picker or the plant list. Splitting them here keeps the
 * initial download small; each chunk loads when its route is first opened.
 */
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const HistoryPage = lazy(() => import('./features/history/HistoryPage'));
const DecisionsPage = lazy(() => import('./features/decisions/DecisionsPage'));

/** Placeholder shown while a route chunk downloads. */
function RouteFallback() {
  return (
    <div className="space-y-4 p-4 sm:p-6" role="status" aria-label="Loading page">
      <Skeleton className="h-7 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * Route table (plan §2.4).
 *
 * `/plants` is the landing page after login; the three plant-scoped screens
 * share DashboardLayout, which supplies the sidebar and reads :plantId.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />

      <Route
        path="/plants"
        element={
          <ProtectedRoute>
            <PlantsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/plants/:plantId"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <Suspense fallback={<RouteFallback />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="history"
          element={
            <Suspense fallback={<RouteFallback />}>
              <HistoryPage />
            </Suspense>
          }
        />
        <Route
          path="decisions"
          element={
            <Suspense fallback={<RouteFallback />}>
              <DecisionsPage />
            </Suspense>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/plants" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
