import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { CONFIG } from '../constants/config';
import { secureStorage } from '../utils/secureStorage';

const BASE_URL = CONFIG.API_URL;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token on every request
apiClient.interceptors.request.use(
  (config) => {
    // Import store state lazily to avoid circular dependency at module init
    const { useAuthStore } = require('../stores/authStore');
    const token: string | null = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Track whether we're currently refreshing to avoid loops
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

// 401 → silent refresh → retry, with exponential backoff on network errors
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 429 — attach retry-after for UI
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const enriched = new Error('Too many requests') as Error & { retryAfter?: number };
      enriched.retryAfter = retryAfter ? parseInt(retryAfter, 10) : 60;
      return Promise.reject(enriched);
    }

    // Handle 401 — try to refresh once
    if (error.response?.status === 401 && original && !original._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await secureStorage.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post<{ accessToken: string }>(
          `${BASE_URL}/auth/refresh-token`,
          { refreshToken },
          { timeout: 10000 }
        );
        const newToken = response.data.accessToken;
        const { useAuthStore } = require('../stores/authStore');
        useAuthStore.getState().setAccessToken(newToken);
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch (refreshError) {
        processQueue(refreshError);
        const { useAuthStore } = require('../stores/authStore');
        await useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Exponential backoff retry for network errors (not 4xx/5xx)
export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    const axiosError = error as AxiosError;
    const isNetworkError = !axiosError.response;
    if (isNetworkError && retries > 0) {
      await new Promise((r) => setTimeout(r, baseDelay));
      return withRetry(fn, retries - 1, baseDelay * 2);
    }
    throw error;
  }
};
