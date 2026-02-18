import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

// Environment check for logging
const isDev = import.meta.env.DEV;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
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
      toast.success('Welcome back!');
      return { success: true };
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
    toast.success('Logged out successfully');
  };

  const logoutAll = async () => {
    try {
      await api.post('/auth/logout-all');
      setUser(null);
      setIsAuthenticated(false);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
