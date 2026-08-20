import { apiClient } from './client';
import { PLANS, PLAN_ORDER } from '@shared/constants/plans';
import type { PlanFeatures, Subscription } from '../types';

// The /subscription/plans endpoint does not carry the capability flags
// (canChat, etc.) the plan cards render, so the shared PLANS constant stays the
// source of truth for THOSE — but every commercial term (price, tenure, unlock
// cap, MRP anchor, badge) must come from the server, because the launch offer
// reprices and re-terms plans at runtime. Overlaying price alone shipped a card
// that advertised the launch price against the regular tenure.
type LivePlan = {
  price?: number;
  mrp?: number | null;
  perMonth?: number | null;
  durationDays?: number | null;
  contactUnlocks?: number | null;
  badge?: string | null;
  isLaunchPrice?: boolean;
  /** 'nri' marks a segment tier the screen hides from members it doesn't apply to. */
  segment?: string | null;
};
type LiveBundle = { bundleId: string; label?: string; name?: string; unlocks: number; price: number; mrp?: number | null };

export const getPlans = async (): Promise<PlanFeatures[]> => {
  const res = await apiClient.get<{ plans: Record<string, LivePlan> }>('/subscription/plans');
  const live = res.data.plans ?? {};
  // A tier the server omitted is WITHDRAWN for the current offer window and is
  // refused at checkout. Falling back to the shared constant for it — which is
  // what `if (!l) return base` used to do for every key — rendered a buyable
  // card at the regular price for a plan create-order rejects. Only fall back
  // wholesale when the server sent no plans at all (a failed/empty response).
  const served = Object.keys(live).length > 0;
  return PLAN_ORDER.map((planType) => {
    const base = PLANS[planType];
    const l = live[planType];
    if (!l) return served ? null : base;
    return {
      ...base,
      price: typeof l.price === 'number' ? l.price : base.price,
      mrp: typeof l.mrp === 'number' ? l.mrp : base.mrp,
      perMonth: typeof l.perMonth === 'number' ? l.perMonth : base.perMonth,
      durationDays: typeof l.durationDays === 'number' ? l.durationDays : base.durationDays,
      // The API sends -1 for "unlimited"; the shared shape uses null.
      contactUnlocks: typeof l.contactUnlocks === 'number'
        ? (l.contactUnlocks === -1 ? null : l.contactUnlocks)
        : base.contactUnlocks,
      badge: l.badge ?? base.badge,
      segment: l.segment ?? null,
    };
  }).filter((p): p is PlanFeatures => p !== null);
};

// Live unlock top-ups. The launch offer can reprice a bundle or withdraw it
// entirely, and a withdrawn bundle is REFUSED at checkout — so the screen must
// render the server's list, not the shared constant.
export const getUnlockBundles = async (): Promise<Array<{ bundleId: string; label: string; unlocks: number; price: number; mrp?: number | null }>> => {
  const res = await apiClient.get<{ bundles?: Record<string, LiveBundle> }>('/subscription/plans');
  const live = res.data.bundles;
  if (!live) return [];
  return Object.values(live).map((b) => ({
    bundleId: b.bundleId,
    label: b.label ?? b.name ?? `${b.unlocks} Contact Unlocks`,
    unlocks: b.unlocks,
    price: b.price,
    mrp: b.mrp ?? null,
  }));
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
  // Backend + web both read camelCase keys (razorpayOrderId…). The Razorpay SDK
  // hands back snake_case, so map here — sending snake_case 400s "Missing payment details".
  const res = await apiClient.post<{ subscription: Subscription }>('/subscription/verify-payment', {
    razorpayOrderId: data.razorpay_order_id,
    razorpayPaymentId: data.razorpay_payment_id,
    razorpaySignature: data.razorpay_signature,
  });
  return res.data.subscription;
};

// Verify a Google Play subscription purchase (Android user-choice billing).
export const verifyGooglePlay = async (data: {
  productId: string;
  purchaseToken: string;
}): Promise<Subscription> => {
  const res = await apiClient.post<{ subscription: Subscription }>('/subscription/google-verify', data);
  return res.data.subscription;
};

export const getSubscriptionHistory = async (): Promise<Subscription[]> => {
  const res = await apiClient.get<{ subscriptions: Subscription[] }>('/subscription/history');
  return res.data.subscriptions ?? [];
};

// ---- À-la-carte contact-unlock top-ups (require an active finite paid plan) ----
export const createBundleOrder = async (
  bundleId: string
): Promise<{ orderId: string; amount: number; currency: string }> => {
  const res = await apiClient.post<{ order: { id: string; amount: number; currency: string } }>(
    '/subscription/unlock-bundle/create-order',
    { bundleId }
  );
  const { id, amount, currency } = res.data.order;
  return { orderId: id, amount, currency };
};

export const verifyBundlePayment = async (data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ unlocks: number }> => {
  const res = await apiClient.post<{ unlocks: number }>('/subscription/unlock-bundle/verify-payment', {
    razorpayOrderId: data.razorpay_order_id,
    razorpayPaymentId: data.razorpay_payment_id,
    razorpaySignature: data.razorpay_signature,
  });
  return { unlocks: res.data.unlocks };
};
