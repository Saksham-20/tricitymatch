import { apiClient } from './client';
import { secureStorage } from '../utils/secureStorage';
import type { AuthUser } from '../types';

// Backend returns `{ success, user, tokens: { accessToken, refreshToken } }`.
// Native clients can't rely on the httpOnly cookies, so we read the tokens from
// the body and persist the refresh token in the device keychain.
interface AuthEnvelope {
  user: AuthUser;
  tokens: { accessToken: string; refreshToken: string };
}

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

const persistTokens = async (env: AuthEnvelope): Promise<AuthResult> => {
  if (env.tokens?.refreshToken) {
    await secureStorage.setRefreshToken(env.tokens.refreshToken);
  }
  return { accessToken: env.tokens?.accessToken, user: env.user };
};

export const login = async (email: string, password: string): Promise<AuthResult> => {
  const res = await apiClient.post<AuthEnvelope>('/auth/login', { email, password });
  return persistTokens(res.data);
};

export const signup = async (email: string, password: string): Promise<AuthResult> => {
  const res = await apiClient.post<AuthEnvelope>('/auth/signup', { email, password });
  return persistTokens(res.data);
};

export const logout = async (): Promise<void> => {
  await apiClient.post('/auth/logout').catch(() => {});
};

export const refreshAccessToken = async (): Promise<AuthResult> => {
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token stored');
  const res = await apiClient.post<AuthEnvelope>('/auth/refresh', { refreshToken });
  return persistTokens(res.data);
};

export const googleLogin = async (idToken: string): Promise<AuthResult> => {
  const res = await apiClient.post<AuthEnvelope>('/auth/google', { idToken });
  return persistTokens(res.data);
};

export const forgotPassword = async (email: string): Promise<void> => {
  await apiClient.post('/auth/forgot-password', { email });
};

export const resetPassword = async (token: string, password: string): Promise<void> => {
  await apiClient.post('/auth/reset-password', { token, password });
};

export const sendOtp = async (phone: string): Promise<void> => {
  await apiClient.post('/auth/send-otp', { type: 'phone', target: phone });
};

export const verifyOtp = async (phone: string, otp: string): Promise<void> => {
  await apiClient.post('/auth/verify-otp', { type: 'phone', target: phone, code: otp });
};

export const getMe = async (): Promise<AuthUser> => {
  const res = await apiClient.get<{ user: AuthUser }>('/auth/me');
  return res.data.user;
};

export const deleteAccount = async (): Promise<void> => {
  await apiClient.delete('/auth/account');
};

// ─── Account security ─────────────────────────────────────────────────────────

export interface AuthSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  /** Server-resolved from the access token's session claim — see authController. */
  isCurrent: boolean;
}

/**
 * Changing the password revokes every OTHER session server-side; the one making
 * the request survives, so the app is not signed out by its own security
 * action. The server identifies it from the access token, so nothing about the
 * refresh token goes over the wire here.
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
};

export const getSessions = async (): Promise<AuthSession[]> => {
  const res = await apiClient.get<{ sessions: AuthSession[] }>('/auth/sessions');
  return res.data.sessions ?? [];
};

export const revokeSession = async (sessionId: string): Promise<void> => {
  await apiClient.delete(`/auth/sessions/${sessionId}`);
};

/** Signs out every device including this one. */
export const logoutAll = async (): Promise<void> => {
  await apiClient.post('/auth/logout-all');
};
