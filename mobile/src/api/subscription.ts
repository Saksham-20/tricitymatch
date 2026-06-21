import { apiClient } from './client';
import type { PlanFeatures, Subscription } from '../types';

// Backend returns plans as an object keyed by planType; flatten to the array the screen expects.
export const getPlans = async (): Promise<PlanFeatures[]> => {
  const res = await apiClient.get<{ plans: Record<string, Omit<PlanFeatures, 'planType'>> }>('/subscription/plans');
  const plans = res.data.plans ?? {};
  return Object.entries(plans).map(([planType, p]) => ({ planType, ...p } as PlanFeatures));
};

export const createOrder = async (planType: string): Promise<{ orderId: string; amount: number; currency: string }> => {
  const res = await apiClient.post<{ order: { id: string; amount: number; currency: string } }>(
    '/subscription/create-order',
    { planType }
  );
  const { id, amount, currency } = res.data.order;
  return { orderId: id, amount, currency };
};

export const verifyPayment = async (data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<Subscription> => {
  const res = await apiClient.post<{ subscription: Subscription }>('/subscription/verify-payment', data);
  return res.data.subscription;
};

export const getSubscriptionHistory = async (): Promise<Subscription[]> => {
  const res = await apiClient.get<{ subscriptions: Subscription[] }>('/subscription/history');
  return res.data.subscriptions ?? [];
};
