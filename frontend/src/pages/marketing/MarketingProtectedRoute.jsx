import { Navigate } from 'react-router-dom';

export default function MarketingProtectedRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const allowedRoles = ['marketing', 'marketing_manager', 'admin', 'super_admin'];

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
