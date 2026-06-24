import toast from 'react-hot-toast';
import { razorpay } from '../config';

// User-facing copy for when online payments can't be started. Never expose
// env-var names or "not configured" developer language to members.
export const PAYMENTS_UNAVAILABLE_MSG =
  'Online payments are temporarily unavailable. Please try again later or contact support@tricityshadi.com.';

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
      existing.addEventListener('error', () => { razorpayScriptPromise = null; reject(new Error('Failed to load payment SDK')); });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => { razorpayScriptPromise = null; reject(new Error('Failed to load payment SDK')); };
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
  toast.error(PAYMENTS_UNAVAILABLE_MSG);
  console.warn('Razorpay not configured: set VITE_RAZORPAY_KEY_ID');
  return false;
};
