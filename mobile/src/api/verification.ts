import { apiClient } from './client';
import type { VerificationTier } from '../types';

// The backend tracks a single ID-document verification (GET /verification/status →
// { verification: { status, documentType } }) plus phone-at-signup. Education/Income
// tiers have no backend yet (see CLAUDE.md). Map what exists onto the 4-tier UI shape.
export const getMyVerifications = async (): Promise<VerificationTier[]> => {
  const res = await apiClient.get<{ verification: { status?: string; documentType?: string } }>(
    '/verification/status'
  );
  const v = res.data.verification ?? {};
  const docStatus = (v.status ?? 'not_submitted') as string;
  const idEarned = docStatus === 'approved';
  const idStatus = docStatus !== 'not_submitted'
    ? (docStatus as VerificationTier['status'])
    : undefined;
  const t = (tier: 1 | 2 | 3 | 4, isEarned: boolean, status?: VerificationTier['status']): VerificationTier =>
    ({ tier, name: '', description: '', badge: '', isEarned, status });
  return [
    t(1, true, 'approved'),     // mobile — phone OTP at signup
    t(2, idEarned, idStatus),   // ID document
    t(3, false, undefined),     // education — no backend
    t(4, false, undefined),     // income — no backend
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
