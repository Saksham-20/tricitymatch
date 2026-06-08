import { apiClient } from './client';
import type { PlanFeatures, Subscription } from '../types';

export const getPlans = async (): Promise<PlanFeatures[]> => {
  const res = await apiClient.get<PlanFeatures[]>('/subscription/plans');
  return res.data;
};

export const createOrder = async (planType: string): Promise<{ orderId: string; amount: number; currency: string }> => {
  const res = await apiClient.post('/subscription/create-order', { planType });
  return res.data;
};

export const verifyPayment = async (data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<Subscription> => {
  const res = await apiClient.post<Subscription>('/subscription/verify-payment', data);
  return res.data;
};

export const getSubscriptionHistory = async (): Promise<Subscription[]> => {
  const res = await apiClient.get<Subscription[]>('/subscription/history');
  return res.data;
};
