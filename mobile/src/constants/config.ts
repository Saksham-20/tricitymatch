import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

function requireEnv(key: string, envValue: string | undefined): string {
  if (!envValue && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return envValue ?? '';
}

/**
 * Placeholder markers used across .env.development / .env.production. A value
 * carrying one of these is a reminder to fill it in, not a credential.
 *
 * This matters because the previous check was `.endsWith('.apps.googleusercontent.com')`
 * — which BOTH `placeholder.apps.googleusercontent.com` and
 * `replace_with_real.apps.googleusercontent.com` satisfy. It reported "configured"
 * when nothing was, so it could never have gated anything correctly.
 */
const PLACEHOLDER_MARKERS = ['placeholder', 'replace_with_real', 'replace-with-real', 'your_', 'changeme'];

const isConfigured = (value: string | undefined, extra?: (v: string) => boolean): boolean => {
  const v = (value ?? '').trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (PLACEHOLDER_MARKERS.some((m) => lower.includes(m))) return false;
  return extra ? extra(v) : true;
};

export const CONFIG = {
  API_URL: requireEnv('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  WS_URL:  requireEnv('EXPO_PUBLIC_WS_URL',  process.env.EXPO_PUBLIC_WS_URL),
  AGORA_APP_ID:         process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '',
  RAZORPAY_KEY_ID:      process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '',
  CLOUDINARY_CLOUD_NAME:process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
  GOOGLE_CLIENT_ID:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',

  IS_DEV: process.env.NODE_ENV !== 'production',

  // Feature gates. A feature whose credentials are absent must be HIDDEN, not
  // shown-and-broken: a button that opens an alert telling the user to set an
  // environment variable is developer text in a shipped app, and store reviewers
  // treat non-functional UI as a rejection reason.
  IS_RAZORPAY_CONFIGURED: isConfigured(process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID, (v) => v.startsWith('rzp_')),
  IS_AGORA_CONFIGURED:    isConfigured(process.env.EXPO_PUBLIC_AGORA_APP_ID),
  IS_GOOGLE_CONFIGURED:   isConfigured(
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    (v) => v.endsWith('.apps.googleusercontent.com')
  ),
} as const;
