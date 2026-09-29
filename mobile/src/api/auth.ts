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

export const login = async (email: string, password: string, mfaCode?: string): Promise<AuthResult> => {
  const res = await apiClient.post<AuthEnvelope>('/auth/login', { email, password, ...(mfaCode ? { mfaCode } : {}) });
  return persistTokens(res.data);
};

// D6 door: signup carries the basics so the server derives
// onboardingComplete=true and RootNavigator goes straight to Main. Identity is
// EITHER email or phone (flexible auth) — pass the other as undefined.
export interface SignupPayload {
  email?: string;
  phone?: string;
  password: string;
  /** Proof from verifyOtp() for whichever contact is being registered. */
  emailProof?: string;
  phoneProof?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  /** Stated in the request: the server refuses a signup that does not assert it. */
  termsAccepted: boolean;
  /** Optional, unticked by default: promotional email. */
  marketingConsent?: boolean;
  /** 'self' or 'other'; with 'other', the operator's attestation is required. */
  creatingFor?: 'self' | 'other';
  relationshipToProfile?: string;
  subjectAttestation?: boolean;
}

export const signup = async (payload: SignupPayload): Promise<AuthResult> => {
  const res = await apiClient.post<AuthEnvelope>('/auth/signup', payload);
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

// Password reset by texted code, for accounts with no verified email. The first
// call answers identically for every number (the server never says whether one
// is registered), so its result is never used to decide what to show.
export const forgotPasswordPhone = async (phone: string): Promise<void> => {
  await apiClient.post('/auth/forgot-password/phone', { phone });
};

export const resetPasswordPhone = async (phone: string, code: string, password: string): Promise<void> => {
  await apiClient.post('/auth/reset-password/phone', { phone, code, password });
};

export const resetPassword = async (token: string, password: string): Promise<void> => {
  await apiClient.post('/auth/reset-password', { token, password });
};

export const sendOtp = async (target: string, type: 'phone' | 'email' = 'phone'): Promise<void> => {
  await apiClient.post('/auth/send-otp', { type, target });
};

// Returns the single-use proof signup must present for this contact.
export const verifyOtp = async (target: string, otp: string, type: 'phone' | 'email' = 'phone'): Promise<string> => {
  const res = await apiClient.post<{ verificationProof?: string }>('/auth/verify-otp', { type, target, code: otp });
  return res.data?.verificationProof ?? '';
};

export const getMe = async (): Promise<AuthUser> => {
  const res = await apiClient.get<{ user: AuthUser }>('/auth/me');
  return res.data.user;
};

// The server verifies the member's password before erasing the account; a bare DELETE 400s.
export const deleteAccount = async (password: string): Promise<void> => {
  await apiClient.delete('/auth/account', { data: { password } });
};

// Deletion with a grace period: the profile is hidden now and the account is
// erased on `scheduledFor`, and can be cancelled by signing in before then.
export const scheduleAccountDeletion = async (password: string): Promise<{ scheduledFor: string | null; immediate: boolean }> => {
  const res = await apiClient.post<{ scheduledFor?: string; immediate?: boolean }>('/auth/account/schedule-deletion', { password });
  return { scheduledFor: res.data.scheduledFor ?? null, immediate: Boolean(res.data.immediate) };
};

export const cancelAccountDeletion = async (): Promise<void> => {
  await apiClient.post('/auth/account/cancel-deletion');
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

/** Re-accept the Terms after a version bump. `termsVersion` is the one the server asked for. */
export const acceptTerms = async (termsVersion: string): Promise<void> => {
  await apiClient.post('/auth/accept-terms', { termsVersion, accepted: true });
};
