import { create } from 'zustand';
import type { AuthUser, SubscriptionPlanType } from '../types';
import { cache, CACHE_KEYS } from '../utils/cache';
import { secureStorage } from '../utils/secureStorage';
import { removeFcmToken } from '../api/notifications';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: AuthUser) => void;
  setAccessToken: (token: string) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => {
    cache.setObject(CACHE_KEYS.USER, user);
    set({ user, isAuthenticated: true });
  },

  setAccessToken: (accessToken) => {
    set({ accessToken });
  },

  logout: async () => {
    // Deregister FCM token before clearing auth state (best-effort)
    const fcmToken = cache.getString('fcm_token');
    if (fcmToken) {
      try { await removeFcmToken(fcmToken); } catch { /* ignore */ }
      cache.delete('fcm_token');
    }
    await secureStorage.deleteRefreshToken();
    cache.delete(CACHE_KEYS.USER);
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      // Restore cached user for offline access while refreshing
      const cachedUser = cache.getObject<AuthUser>(CACHE_KEYS.USER);
      if (cachedUser) {
        set({ user: cachedUser });
      }

      const refreshToken = await secureStorage.getRefreshToken();
      if (!refreshToken) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Lazy-import to avoid circular deps — api/auth imports this store
      const { refreshAccessToken } = await import('../api/auth');
      const result = await refreshAccessToken();
      if (result.accessToken && result.user) {
        cache.setObject(CACHE_KEYS.USER, result.user);
        set({ accessToken: result.accessToken, user: result.user, isAuthenticated: true });
      } else {
        await secureStorage.deleteRefreshToken();
        set({ isAuthenticated: false });
      }
    } catch {
      await secureStorage.deleteRefreshToken();
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));

// Selector helpers
export const selectUser = (s: AuthState) => s.user;
export const selectIsAuthenticated = (s: AuthState) => s.isAuthenticated;
export const selectPlan = (s: AuthState): SubscriptionPlanType =>
  s.user?.subscriptionPlan ?? 'free';
