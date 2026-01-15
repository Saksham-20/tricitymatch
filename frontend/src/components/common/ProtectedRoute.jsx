import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Give a moment for auth state to update after login/signup
    if (!loading) {
      const timer = setTimeout(() => {
        setIsChecking(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, isAuthenticated]);

  if (loading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;

