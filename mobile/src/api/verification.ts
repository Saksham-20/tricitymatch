import { apiClient } from './client';
import type { VerificationTier } from '../types';

export const getMyVerifications = async (): Promise<VerificationTier[]> => {
  const res = await apiClient.get<VerificationTier[]>('/verification/me');
  return res.data;
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

export interface BgCheckStatus {
  bgCheckStatus: 'not_requested' | 'pending_payment' | 'in_progress' | 'passed' | 'failed';
  bgCheckRequestedAt: string | null;
  bgCheckCompletedAt: string | null;
  hasPassed: boolean;
}

export const getBgCheckStatus = async (): Promise<BgCheckStatus> => {
  const res = await apiClient.get<{ success: boolean } & BgCheckStatus>('/verification/bg-check/status');
  return res.data;
};

export const initiateBgCheck = async (): Promise<{
  razorpayOrderId: string | null;
  amountPaise: number;
  message: string;
}> => {
  const res = await apiClient.post('/verification/bg-check/initiate', { consent: true });
  return res.data;
};

export const verifyBgCheckPayment = async (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<void> => {
  await apiClient.post('/verification/bg-check/verify-payment', payload);
};
