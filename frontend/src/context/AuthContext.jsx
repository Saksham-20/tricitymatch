import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setIsAuthenticated(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      const userData = response.data.user || response.data;
      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
        // Update localStorage with fresh user data
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        throw new Error('No user data received');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      if (!token || !user) {
        throw new Error('Invalid response from server');
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Fetch full user data including profile
      try {
        const meResponse = await api.get('/auth/me');
        const fullUserData = meResponse.data.user || meResponse.data;
        if (fullUserData) {
          setUser(fullUserData);
          localStorage.setItem('user', JSON.stringify(fullUserData));
        } else {
          setUser(user);
        }
      } catch (err) {
        // If /auth/me fails, use the basic user data from login
        console.warn('Failed to fetch full user data, using basic data:', err);
        setUser(user);
      }
      
      setIsAuthenticated(true);
      
      toast.success('Welcome back!');
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      const message = error.response?.data?.message || error.message || 'Login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await api.post('/auth/signup', userData);
      const { token, user } = response.data;
      
      if (!token || !user) {
        throw new Error('Invalid response from server');
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Fetch full user data including profile
      try {
        const meResponse = await api.get('/auth/me');
        const fullUserData = meResponse.data.user || meResponse.data;
        if (fullUserData) {
          setUser(fullUserData);
          localStorage.setItem('user', JSON.stringify(fullUserData));
        } else {
          setUser(user);
        }
      } catch (err) {
        // If /auth/me fails, use the basic user data from signup
        console.warn('Failed to fetch full user data, using basic data:', err);
        setUser(user);
      }
      
      setIsAuthenticated(true);
      
      toast.success('Account created successfully!');
      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      let message = error.response?.data?.message || error.message || 'Signup failed';
      
      // Handle validation errors
      if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors.map(e => e.msg || e.message).join(', ');
        message = validationErrors;
      }
      
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    toast.success('Logged out successfully');
  };

  const updateUser = (userData) => {
    setUser({ ...user, ...userData });
    localStorage.setItem('user', JSON.stringify({ ...user, ...userData }));
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
        updateUser,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

