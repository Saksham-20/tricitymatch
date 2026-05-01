import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function MarketingProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();
  const allowedRoles = ['marketing', 'marketing_manager', 'admin', 'super_admin'];

  if (loading) return null;
  if (!isAuthenticated || !allowedRoles.includes(user?.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
