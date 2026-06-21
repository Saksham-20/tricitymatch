import { apiClient } from './client';
import { PLANS, PLAN_ORDER } from '@shared/constants/plans';
import type { PlanFeatures, Subscription } from '../types';

// The /subscription/plans endpoint only returns marketing copy (name/price/
// duration/feature-strings) — NOT the capability flags (canChat, etc.) the plan
// cards render. The shared PLANS constant is the source of truth for those, so
// use it and overlay the live price from the API.
export const getPlans = async (): Promise<PlanFeatures[]> => {
  const res = await apiClient.get<{ plans: Record<string, { price?: number }> }>('/subscription/plans');
  const live = res.data.plans ?? {};
  return PLAN_ORDER.map((planType) => {
    const base = PLANS[planType];
    const livePrice = live[planType]?.price;
    return { ...base, price: typeof livePrice === 'number' ? livePrice : base.price };
  });
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
