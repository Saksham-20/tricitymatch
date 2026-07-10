import { apiClient } from './client';
import type { VerificationTier } from '../types';

// The backend tracks a single selfie photo-verification (GET /verification/status →
// { verification: { status, selfiePhoto } }) plus phone-at-signup. Government-ID
// collection was removed (2026-07-02) — tier 2 is now a live selfie. Education/Income
// tiers have no backend yet (see CLAUDE.md). Map what exists onto the 4-tier UI shape.
export const getMyVerifications = async (): Promise<VerificationTier[]> => {
  const res = await apiClient.get<{ verification: { status?: string; selfiePhoto?: string } }>(
    '/verification/status'
  );
  const v = res.data.verification ?? {};
  const selfieStatus = (v.status ?? 'not_submitted') as string;
  const photoEarned = selfieStatus === 'approved';
  const photoStatus = selfieStatus !== 'not_submitted'
    ? (selfieStatus as VerificationTier['status'])
    : undefined;
  const t = (tier: 1 | 2 | 3 | 4, isEarned: boolean, status?: VerificationTier['status']): VerificationTier =>
    ({ tier, name: '', description: '', badge: '', isEarned, status });
  return [
    t(1, true, 'approved'),         // mobile — phone OTP at signup
    t(2, photoEarned, photoStatus), // photo — live selfie → admin review
    t(3, false, undefined),         // education — no backend
    t(4, false, undefined),         // income — no backend
  ];
};

export const submitVerification = async (formData: FormData): Promise<void> => {
  await apiClient.post('/verification/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const submitSelfieVerification = async (formData: FormData): Promise<void> => {
  await apiClient.post('/verification/selfie', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
