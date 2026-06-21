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

export const verifyOtp = async (phone: string, otp: string): Promise<void> => {
  await apiClient.post('/auth/verify-otp', { phone, otp });
};

export const getMe = async (): Promise<AuthUser> => {
  const res = await apiClient.get<{ user: AuthUser }>('/auth/me');
  return res.data.user;
};

export const deleteAccount = async (): Promise<void> => {
  await apiClient.delete('/auth/account');
};
