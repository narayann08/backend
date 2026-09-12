import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Gate for everything behind the role picker.
 *
 * There is no token to validate — a session is simply "a role was selected and
 * persisted" — so this checks the store and nothing else. The attempted path is
 * stashed in location state so login can send the operator back to it.
 */
export default function ProtectedRoute({ children }) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}
