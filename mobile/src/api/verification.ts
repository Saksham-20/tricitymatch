import { apiClient } from './client';
import type { PhotoVerification } from '../types';

/**
 * Photo verification — one live selfie, reviewed by a human.
 *
 * The server has been selfie-only since 2026-07-02: `POST /verification/submit`
 * requires a `selfiePhoto` file and deliberately ignores any documentType /
 * documentFront / documentBack a stale client still sends. This module used to
 * fan the single server status out into a four-tier ladder for the UI, which
 * meant the app advertised education and income tiers that have no backend and
 * an "ID" tier the product removed.
 */
export const getPhotoVerification = async (): Promise<PhotoVerification> => {
  const res = await apiClient.get<{ verification?: Partial<PhotoVerification> }>(
    '/verification/status'
  );
  const v = res.data.verification ?? {};
  return {
    status: v.status ?? 'not_submitted',
    selfiePhoto: v.selfiePhoto ?? null,
    adminNotes: v.adminNotes ?? null,
    verifiedAt: v.verifiedAt ?? null,
    submittedAt: v.submittedAt ?? null,
  };
};

/** `formData` must carry a `selfiePhoto` file captured from the live camera. */
export const submitVerification = async (formData: FormData): Promise<void> => {
  await apiClient.post('/verification/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
