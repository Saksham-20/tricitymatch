import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

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
    // FormData must use multipart boundary; do not send application/json or body is consumed and multer gets nothing
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
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
    const isRefresh = originalRequest.url?.includes('/auth/refresh');

    // Unauthenticated auth entrypoints: a 401/4xx here is a DOMAIN response
    // (wrong password, taken email, bad OTP), not an expired session. Never
    // trigger refresh+redirect for them — that hard-reloads the page and wipes
    // the form + inline error, so the user sees their failed submit do nothing.
    const noRefreshPaths = [
      '/auth/me', '/auth/login', '/auth/signup', '/auth/refresh',
      '/auth/forgot-password', '/auth/reset-password', '/auth/google',
      '/auth/send-otp', '/auth/verify-otp',
    ];
    const skipRefresh = noRefreshPaths.some((p) => originalRequest.url?.includes(p));

    // Reject straight through so the calling component can render the error.
    if (error.response?.status === 401 && skipRefresh) {
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
