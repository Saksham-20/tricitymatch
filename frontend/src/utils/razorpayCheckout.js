import toast from 'react-hot-toast';
import i18n from '../i18n';
import { razorpay } from '../config';

// User-facing copy for when online payments can't be started. Never expose
// env-var names or "not configured" developer language to members.
// The constant is the English text (kept for existing importers); the function
// returns it in the member's current language.
export const PAYMENTS_UNAVAILABLE_MSG =
  'Online payments are temporarily unavailable. Please try again later or contact support@tricitymatch.com.';
export const paymentsUnavailableMessage = () => i18n.t('payments.unavailable');
const sdkLoadError = () => new Error(i18n.t('payments.sdkLoadFailed'));

// Load the Razorpay checkout SDK once and reuse it (avoids stacking a new
// <script> + onload handler on every payment click). The SDK is intentionally
// not in index.html — it's only fetched on the first real payment attempt.
let razorpayScriptPromise = null;
export const loadRazorpayScript = () => {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => { razorpayScriptPromise = null; reject(sdkLoadError()); });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => { razorpayScriptPromise = null; reject(sdkLoadError()); };
    document.body.appendChild(s);
  });
  return razorpayScriptPromise;
};

/**
 * Returns true if online payments can be started. When not, shows a friendly
 * toast (no developer detail) and logs the real reason to the console.
 * Call this BEFORE creating any order/booking so we don't leave orphaned rows.
 */
export const ensurePaymentsAvailable = () => {
  if (razorpay.isConfigured) return true;
  toast.error(paymentsUnavailableMessage());
  console.warn('Razorpay not configured: set VITE_RAZORPAY_KEY_ID');
  return false;
};
