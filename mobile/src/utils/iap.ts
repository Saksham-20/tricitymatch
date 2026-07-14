// Google Play Billing wrapper (Android "user-choice billing" rail).
//
// react-native-iap is a NATIVE module — it only works in a custom dev/production
// build, never in Expo Go. We load it behind a dynamic require (same pattern as
// react-native-razorpay in SubscriptionScreen) so the JS bundle still runs in
// Expo Go; the purchase call just throws IAP_UNAVAILABLE there, which the screen
// handles by falling back to the Razorpay rail / website.
//
// Product IDs must be created VERBATIM as subscription products in Play Console
// and mirror backend/constants/plans.js → GOOGLE_PLAY_PRODUCTS.
import { Platform } from 'react-native';
import type { SubscriptionPlanType } from '../types';

export const IAP_UNAVAILABLE = 'IAP_UNAVAILABLE';

// planType → Play product id
export const PLAY_PRODUCT_IDS: Partial<Record<SubscriptionPlanType, string>> = {
  basic_premium: 'tricityshadi_basic_premium',
  premium_plus:  'tricityshadi_premium_plus',
  elite:         'tricityshadi_elite',
  vip:           'tricityshadi_vip',
  nri:           'tricityshadi_nri',
};

export interface PlayPurchase {
  productId: string;
  purchaseToken: string;
}

// Minimal surface of react-native-iap we use (typed loosely — the lib isn't a
// declared type dependency in Expo Go).
type RNIap = {
  initConnection: () => Promise<boolean>;
  endConnection: () => Promise<void>;
  getSubscriptions: (opts: { skus: string[] }) => Promise<any[]>;
  requestSubscription: (opts: any) => Promise<any>;
  finishTransaction: (opts: { purchase: any; isConsumable: boolean }) => Promise<any>;
};

function loadIap(): RNIap | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-iap') as RNIap;
  } catch {
    return null;
  }
}

export function isGooglePlayAvailable(): boolean {
  return Platform.OS === 'android' && !!loadIap();
}

// Kick off a Google Play subscription purchase and return the productId +
// purchaseToken for server-side verification. Throws IAP_UNAVAILABLE when the
// native module is absent (Expo Go), or an Error on user-cancel / failure.
export async function purchaseGooglePlaySubscription(
  planType: SubscriptionPlanType,
): Promise<PlayPurchase> {
  const iap = loadIap();
  const productId = PLAY_PRODUCT_IDS[planType];
  if (!iap || Platform.OS !== 'android' || !productId) {
    throw new Error(IAP_UNAVAILABLE);
  }

  await iap.initConnection();
  try {
    // Android requires the offerToken from the product's base-plan offer.
    const subs = await iap.getSubscriptions({ skus: [productId] });
    const offerToken =
      subs?.[0]?.subscriptionOfferDetails?.[0]?.offerToken ?? undefined;

    const result = await iap.requestSubscription({
      sku: productId,
      ...(offerToken
        ? { subscriptionOffers: [{ sku: productId, offerToken }] }
        : {}),
    });

    const purchase = Array.isArray(result) ? result[0] : result;
    const purchaseToken: string | undefined =
      purchase?.purchaseToken ?? purchase?.purchaseTokenAndroid;

    if (!purchaseToken) {
      throw new Error('No purchase token returned by Google Play');
    }
    // NOTE: finishTransaction is called by the screen only AFTER the server
    // verifies + activates, so a crash mid-flow doesn't consume an unverified
    // purchase. We expose the raw purchase for that follow-up.
    (globalThis as any).__lastPlayPurchase = purchase;

    return { productId, purchaseToken };
  } finally {
    // connection is cheap to re-open; close to avoid leaks between attempts.
    try { await iap.endConnection(); } catch { /* noop */ }
  }
}

// Acknowledge/finish the purchase locally after the backend confirms activation.
export async function finishGooglePlayPurchase(): Promise<void> {
  const iap = loadIap();
  const purchase = (globalThis as any).__lastPlayPurchase;
  if (!iap || !purchase) return;
  try {
    await iap.initConnection();
    await iap.finishTransaction({ purchase, isConsumable: false });
  } catch {
    /* server already acknowledged via Play Developer API; local finish is best-effort */
  } finally {
    try { await iap.endConnection(); } catch { /* noop */ }
    (globalThis as any).__lastPlayPurchase = undefined;
  }
}
