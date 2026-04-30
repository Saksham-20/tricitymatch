import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();
const AUTH_HINT_KEY = 'tricitymatch-auth-hint';

const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/profile',
  '/search',
  '/chat',
  '/subscription',
  '/payment',
  '/settings',
  '/notifications',
  '/admin',
];

const hasStoredAuthHint = () => {
  try {
    return window.localStorage.getItem(AUTH_HINT_KEY) === '1';
  } catch {
    return false;
  }
};

const setStoredAuthHint = (value) => {
  try {
    if (value) {
      window.localStorage.setItem(AUTH_HINT_KEY, '1');
    } else {
      window.localStorage.removeItem(AUTH_HINT_KEY);
    }
  } catch {
    // Ignore storage issues; this is only a non-sensitive UX hint.
  }
};

const routeNeedsAuthCheck = (pathname = '/') =>
  PROTECTED_ROUTE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));

// Environment check for logging
const isDev = import.meta.env.DEV;

const authFallback = {
  user: null,
  loading: false,
  isAuthenticated: false,
  login: async () => ({ success: false, error: 'Auth context unavailable. Please refresh.' }),
  signup: async () => ({ success: false, error: 'Auth context unavailable. Please refresh.' }),
  logout: async () => {},
  logoutAll: async () => {},
  updateUser: () => {},
  checkAuth: async () => {},
  refreshUser: async () => {},
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    if (isDev) {
      console.error('useAuth called outside AuthProvider. Falling back to safe unauthenticated state.');
    }
    return authFallback;
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth status on mount - tokens are in httpOnly cookies
  const checkAuth = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      const userData = response.data.user || response.data;
      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
        setStoredAuthHint(true);
      } else {
        throw new Error('No user data received');
      }
    } catch (error) {
      // 401 is expected when not logged in - not an error
      if (error.response?.status !== 401) {
        if (isDev) {
          console.error('Auth check failed:', error.message);
        }
      }
      setUser(null);
      setIsAuthenticated(false);
      if (error.response?.status === 401) {
        setStoredAuthHint(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const pathname = window.location.pathname;
    const shouldCheckAuth = hasStoredAuthHint() || routeNeedsAuthCheck(pathname);

    if (shouldCheckAuth) {
      checkAuth();
      return;
    }

    setLoading(false);
    setUser(null);
    setIsAuthenticated(false);
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user: userData } = response.data;
      
      if (!userData) {
        throw new Error('Invalid response from server');
      }
      
      // Fetch full user data including profile
      try {
        const meResponse = await api.get('/auth/me');
        const fullUserData = meResponse.data.user || meResponse.data;
        if (fullUserData) {
          setUser(fullUserData);
        } else {
          setUser(userData);
        }
      } catch {
        // If /auth/me fails, use the basic user data from login
        setUser(userData);
      }
      
      setIsAuthenticated(true);
      setStoredAuthHint(true);
      toast.success('Welcome back!');
      return { success: true, role: userData?.role };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await api.post('/auth/signup', userData);
      const { user: newUser } = response.data;
      
      if (!newUser) {
        throw new Error('Invalid response from server');
      }
      
      // Fetch full user data including profile
      try {
        const meResponse = await api.get('/auth/me');
        const fullUserData = meResponse.data.user || meResponse.data;
        if (fullUserData) {
          setUser(fullUserData);
        } else {
          setUser(newUser);
        }
      } catch {
        // If /auth/me fails, use the basic user data from signup
        setUser(newUser);
      }
      
      setIsAuthenticated(true);
      setStoredAuthHint(true);
      toast.success('Account created successfully!');
      return { success: true };
    } catch (error) {
      let message = error.response?.data?.error?.message || error.message || 'Signup failed';
      const details = error.response?.data?.error?.details;

      // Show field-level validation messages (e.g. "Last name is required")
      if (Array.isArray(details) && details.length > 0) {
        message = details.map(d => d.message).join(', ');
      }

      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to clear httpOnly cookies
      await api.post('/auth/logout');
    } catch {
      // Logout locally even if server call fails
    }
    setUser(null);
    setIsAuthenticated(false);
    setStoredAuthHint(false);
    toast.success('Logged out successfully');
  };

  const logoutAll = async () => {
    try {
      await api.post('/auth/logout-all');
      setUser(null);
      setIsAuthenticated(false);
      setStoredAuthHint(false);
      toast.success('Logged out from all devices');
    } catch (error) {
      toast.error('Failed to logout from all devices');
    }
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      const userData = response.data.user || response.data;
      if (userData) {
        setUser(userData);
      }
    } catch {
      // Silently fail - user will be redirected if session expired
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        signup,
        logout,
        logoutAll,
        updateUser,
        checkAuth,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
