import { apiClient } from './client';
import { secureStorage } from '../utils/secureStorage';
import type { AuthUser } from '../types';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface RefreshResponse {
  accessToken: string;
  user: AuthUser;
}

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  if (res.data.refreshToken) {
    await secureStorage.setRefreshToken(res.data.refreshToken);
  }
  return res.data;
};

export const signup = async (email: string, password: string): Promise<AuthResponse> => {
  const res = await apiClient.post<AuthResponse>('/auth/signup', { email, password });
  if (res.data.refreshToken) {
    await secureStorage.setRefreshToken(res.data.refreshToken);
  }
  return res.data;
};

export const logout = async (): Promise<void> => {
  await apiClient.post('/auth/logout').catch(() => {});
};

export const refreshAccessToken = async (): Promise<RefreshResponse> => {
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token stored');
  const res = await apiClient.post<RefreshResponse>('/auth/refresh-token', { refreshToken });
  return res.data;
};

export const googleLogin = async (idToken: string): Promise<AuthResponse> => {
  const res = await apiClient.post<AuthResponse>('/auth/google', { idToken });
  if (res.data.refreshToken) {
    await secureStorage.setRefreshToken(res.data.refreshToken);
  }
  return res.data;
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
  const res = await apiClient.get<AuthUser>('/auth/me');
  return res.data;
};

export const registerDeviceToken = async (token: string, platform: 'ios' | 'android'): Promise<void> => {
  await apiClient.post('/auth/device-token', { token, platform });
};

export const removeDeviceToken = async (): Promise<void> => {
  await apiClient.delete('/auth/device-token');
};

export const deleteAccount = async (): Promise<void> => {
  await apiClient.delete('/auth/delete-account');
};
