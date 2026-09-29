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

/**
 * Ask the server for a capture session when the camera opens. The submission must
 * present the token it returns (X-Capture-Token), which proves the selfie followed
 * a session the server started rather than a scripted upload.
 */
export const startCaptureSession = async (): Promise<string | null> => {
  try {
    const res = await apiClient.post<{ captureToken?: string }>('/verification/capture-session');
    return res.data.captureToken ?? null;
  } catch {
    // The upload is refused with a clear message if the token is missing.
    return null;
  }
};

/** `formData` must carry a `selfiePhoto` file captured from the live camera. */
export const submitVerification = async (
  { formData, captureToken }: { formData: FormData; captureToken: string | null }
): Promise<void> => {
  await apiClient.post('/verification/submit', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(captureToken ? { 'X-Capture-Token': captureToken } : {}),
    },
  });
};
