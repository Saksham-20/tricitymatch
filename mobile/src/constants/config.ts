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
  SENTRY_DSN:           process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',

  // Support channels. The WhatsApp number was hardcoded to 919876543210 — a
  // placeholder that shipped as a real, tappable "WhatsApp Support" button
  // going nowhere. Unset now means the channel is HIDDEN, not fake.
  SUPPORT_EMAIL:    process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@tricitymatch.com',
  SUPPORT_WHATSAPP: process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '',

  // Legal identity, published because the law requires it to be published
  // (IT Rules 2021 r.3(2)(a) — Grievance Officer by NAME; E-Commerce Rules 2020
  // r.4(3) — legal name + office address; DPDP Rules 2025 r.14(3) — a published
  // contact and grievance timeline). Same doctrine as the support channels
  // above: unset means the line is OMITTED, never a plausible placeholder — a
  // fabricated statutory disclosure is worse than a missing one.
  LEGAL_ENTITY:       process.env.EXPO_PUBLIC_LEGAL_ENTITY ?? 'TricityMatch',
  LEGAL_ADDRESS:      process.env.EXPO_PUBLIC_LEGAL_ADDRESS ?? '',
  GRIEVANCE_OFFICER:  process.env.EXPO_PUBLIC_GRIEVANCE_OFFICER ?? '',
  GRIEVANCE_EMAIL:    process.env.EXPO_PUBLIC_GRIEVANCE_EMAIL ?? 'grievance@tricitymatch.com',
  PRIVACY_EMAIL:      process.env.EXPO_PUBLIC_PRIVACY_EMAIL ?? 'privacy@tricitymatch.com',
  // One constant so the two apps and the website cannot drift apart.
  LEGAL_UPDATED:      '26 August 2026',

  IS_DEV: process.env.NODE_ENV !== 'production',

  // Feature gates. A feature whose credentials are absent must be HIDDEN, not
  // shown-and-broken: a button that opens an alert telling the user to set an
  // environment variable is developer text in a shipped app, and store reviewers
  // treat non-functional UI as a rejection reason.
  IS_RAZORPAY_CONFIGURED: isConfigured(process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID, (v) => v.startsWith('rzp_')),
  IS_AGORA_CONFIGURED:    isConfigured(process.env.EXPO_PUBLIC_AGORA_APP_ID),
  IS_SENTRY_CONFIGURED:   isConfigured(process.env.EXPO_PUBLIC_SENTRY_DSN, (v) => v.startsWith('https://')),
  IS_GOOGLE_CONFIGURED:   isConfigured(
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    (v) => v.endsWith('.apps.googleusercontent.com')
  ),
  // A WhatsApp number must be digits-only with a country code (wa.me format),
  // and must not be the old 9876543210 placeholder series.
  IS_WHATSAPP_CONFIGURED: isConfigured(
    process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP,
    (v) => /^[0-9]{10,15}$/.test(v) && !v.includes('9876543210')
  ),
} as const;
