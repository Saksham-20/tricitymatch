import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function MarketingProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const allowedRoles = ['marketing', 'marketing_manager', 'admin', 'super_admin'];

  if (loading) return null;
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  // Signed in, wrong portal: send them to their own home, not to a login page
  // they are already past.
  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to={user?.role === 'sub_admin' ? '/admin' : '/dashboard'} replace />;
  }

  return children;
}
