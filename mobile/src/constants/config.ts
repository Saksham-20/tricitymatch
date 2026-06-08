import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

function requireEnv(key: string, envValue: string | undefined): string {
  if (!envValue && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return envValue ?? '';
}

export const CONFIG = {
  API_URL: requireEnv('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  WS_URL:  requireEnv('EXPO_PUBLIC_WS_URL',  process.env.EXPO_PUBLIC_WS_URL),
  AGORA_APP_ID:         process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '',
  RAZORPAY_KEY_ID:      process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '',
  CLOUDINARY_CLOUD_NAME:process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
  GOOGLE_CLIENT_ID:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',

  IS_DEV: process.env.NODE_ENV !== 'production',
  IS_RAZORPAY_CONFIGURED: (process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '').startsWith('rzp_'),
  IS_GOOGLE_CONFIGURED:   (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '').endsWith('.apps.googleusercontent.com'),
} as const;
