import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Enable credentials for httpOnly cookie support
  withCredentials: true,
});

// Track if we're currently refreshing the token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - no need to add token manually, cookies handle it
api.interceptors.request.use(
  (config) => {
    // Cookies are sent automatically with withCredentials: true
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthCheck = originalRequest.url?.includes('/auth/me');
    const isRefresh = originalRequest.url?.includes('/auth/refresh');

    // 401 on auth check (e.g. not logged in): reject so AuthContext can set unauthenticated.
    // Do NOT refresh or redirect — that would cause an infinite loop on /login.
    if (error.response?.status === 401 && isAuthCheck) {
      return Promise.reject(error);
    }

    // If 401 and not already retrying, try refresh (except for refresh endpoint itself)
    if (error.response?.status === 401 && !originalRequest._retry && !isRefresh) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest)).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Refresh endpoint returned 401 — redirect to login
    if (error.response?.status === 401 && isRefresh) {
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
