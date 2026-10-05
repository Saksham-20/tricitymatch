import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  // `sub_admin` reaches the panel; which PAGES it may open is decided per
  // request by the server (requireAdminScope), and the sidebar hides the rest.
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  // Signed in without panel access: back to their own home, not the login page.
  if (!['sub_admin', 'admin', 'super_admin'].includes(user?.role)) {
    return <Navigate to={['marketing', 'marketing_manager'].includes(user?.role) ? '/marketing/dashboard' : '/dashboard'} replace />;
  }

  return children;
}
