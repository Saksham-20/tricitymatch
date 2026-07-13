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

// The API nests profile fields under `Profile`; most of the UI reads
// `user.firstName`/`user.lastName`/`user.profilePhoto`. Hoist them so the
// whole app (navbar, dashboard greeting, payment prefill, …) shows the name.
const normalizeUser = (u) => {
  if (!u || typeof u !== 'object') return u;
  const p = u.Profile || u.profile;
  if (!p) return u;
  return {
    ...u,
    firstName: u.firstName ?? p.firstName,
    lastName: u.lastName ?? p.lastName,
    profilePhoto: u.profilePhoto ?? p.profilePhoto,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const setUser = useCallback((u) => {
    setUserState((prev) => normalizeUser(typeof u === 'function' ? u(prev) : u));
  }, []);
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
      // A 401 from /auth/me on boot means the 15-min access token expired, NOT
      // that the session is gone — the 7-day refresh cookie may still be valid.
      // The axios interceptor deliberately skips auto-refresh for /auth/me (so
      // failed logins don't hard-reload), so recover the session explicitly:
      // refresh once, then re-probe /auth/me before concluding logged-out.
      // Without this, every hard reload after 15 min dumps the user to /login.
      if (error.response?.status === 401) {
        try {
          await api.post('/auth/refresh');
          const retry = await api.get('/auth/me');
          const userData = retry.data.user || retry.data;
          if (userData) {
            setUser(userData);
            setIsAuthenticated(true);
            setStoredAuthHint(true);
            return;
          }
        } catch (_) {
          // Refresh failed too → genuinely logged out; fall through.
        }
      }
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

  // `identifier` may be an email or a phone number (flexible auth).
  const login = async (identifier, password) => {
    try {
      const response = await api.post('/auth/login', { identifier, password });
      const { user: userData } = response.data;
      
      if (!userData) {
        throw new Error('Invalid response from server');
      }

      // FE-2: login now returns the full user (with Profile), so use it directly.
      // Only fall back to /auth/me for older responses that lack the profile shape.
      if ('Profile' in userData) {
        setUser(userData);
      } else {
        try {
          const meResponse = await api.get('/auth/me');
          setUser(meResponse.data.user || meResponse.data || userData);
        } catch {
          setUser(userData);
        }
      }

      setIsAuthenticated(true);
      setStoredAuthHint(true);
      toast.success('Welcome back!');
      return { success: true, role: userData?.role };
    } catch (error) {
      // No response = network/timeout. The axios interceptor already shows a
      // global toast for this, so don't double-toast; just give the inline form
      // a friendly message instead of the raw "Network Error" string.
      if (!error.response) {
        const message = "Can't reach the server. Check your connection and try again.";
        return { success: false, error: message, status: 0, locked: false };
      }
      // Backend error shape is { success:false, error:{ code, message } }.
      const message = error.response?.data?.error?.message
        || error.response?.data?.message
        || error.message
        || 'Login failed';
      const status = error.response?.status;
      // 429 = IP rate-limit; 401 with a "locked" message = account lockout.
      // Surface both to the caller so the UI can show a distinct lockout state.
      const locked = status === 429 || /locked|too many/i.test(message);
      toast.error(message);
      return { success: false, error: message, status, locked };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await api.post('/auth/signup', userData);
      const { user: newUser } = response.data;
      
      if (!newUser) {
        throw new Error('Invalid response from server');
      }

      // FE-2: signup now returns the full user (with Profile) — use it directly,
      // falling back to /auth/me only for older responses lacking the profile shape.
      if ('Profile' in newUser) {
        setUser(newUser);
      } else {
        try {
          const meResponse = await api.get('/auth/me');
          setUser(meResponse.data.user || meResponse.data || newUser);
        } catch {
          setUser(newUser);
        }
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
