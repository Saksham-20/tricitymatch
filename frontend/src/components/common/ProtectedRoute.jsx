import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const BASICS_EXEMPT = ['/welcome', '/settings', '/profile/edit'];

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-neutral-50 dark:bg-surface-dark-1">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" aria-hidden="true"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated, preserving the attempted URL as
  // ?returnTo= so Login sends the user back there after sign-in (same mechanism
  // the axios 401 handler uses for expired sessions).
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  // Redirect non-admin users trying to access admin routes
  if (adminOnly && !['admin', 'super_admin'].includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // A member without name, gender and date of birth (a new Google sign-up, or
  // an account that never finished) gives those first: the server will not
  // show them to anyone, or let them act on anyone, until it has them. Settings
  // stays open so they can always sign out or delete the account.
  if (
    user?.role === 'user'
    && user.onboardingComplete === false
    && !BASICS_EXEMPT.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))
  ) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/welcome?returnTo=${returnTo}`} replace />;
  }

  return children;
};

export default ProtectedRoute;
