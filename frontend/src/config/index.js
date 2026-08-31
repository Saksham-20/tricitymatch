/**
 * Frontend Configuration
 * Centralized configuration from environment variables
 */

// Environment detection
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
export const mode = import.meta.env.MODE;

// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

// Feature Flags
export const features = {
  // Enable/disable features based on environment
  enableAnalytics: isProduction && import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  enableErrorReporting: isProduction && !!import.meta.env.VITE_ERROR_REPORTING_URL,
  enablePushNotifications: 'Notification' in window && 'serviceWorker' in navigator,
  enableOfflineMode: 'serviceWorker' in navigator,
  showDevTools: isDevelopment,
};

// Razorpay Configuration
const isRealPublicKey = (value) => {
  if (!value) return false;

  const normalized = String(value).trim().toLowerCase();
  return normalized.startsWith('rzp_') && !normalized.includes('your-') && !normalized.includes('xxxxxxxx');
};

export const razorpay = {
  keyId: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
  isConfigured: isRealPublicKey(import.meta.env.VITE_RAZORPAY_KEY_ID),
};

// Google OAuth Configuration
const isRealGoogleClientId = (value) => {
  if (!value) return false;
  const normalized = String(value).trim();
  return normalized.endsWith('.apps.googleusercontent.com') && !normalized.startsWith('your-');
};

export const google = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  isConfigured: isRealGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID),
};

// Agora (in-browser voice/video calls) Configuration
export const agora = {
  appId: import.meta.env.VITE_AGORA_APP_ID || '',
  isConfigured: !!(import.meta.env.VITE_AGORA_APP_ID && String(import.meta.env.VITE_AGORA_APP_ID).trim()),
};

// Support channels. The footer shipped a hardcoded WhatsApp link and phone
// number (…9876543210) that were placeholders — real, clickable, and going
// nowhere. Unset now means the channel is HIDDEN rather than fake.
const isRealPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && !digits.includes('9876543210');
};

export const support = {
  email: import.meta.env.VITE_SUPPORT_EMAIL || 'support@tricitymatch.com',
  // wa.me format: country code + number, digits only.
  whatsapp: isRealPhone(import.meta.env.VITE_SUPPORT_WHATSAPP) ? String(import.meta.env.VITE_SUPPORT_WHATSAPP).replace(/\D/g, '') : '',
  phone: isRealPhone(import.meta.env.VITE_SUPPORT_PHONE) ? String(import.meta.env.VITE_SUPPORT_PHONE).trim() : '',
  address: import.meta.env.VITE_SUPPORT_ADDRESS || '',
};

// Legal identity, published because the law requires it to be published.
//
//   - Consumer Protection (E-Commerce) Rules, 2020 r.4(3)/r.5(3): an e-commerce
//     entity must display its legal name, the address of its head office, and
//     the name, contact and designation of its grievance officer.
//   - IT (Intermediary Guidelines) Rules, 2021 r.3(2)(a): the Grievance
//     Officer's name and contact must be prominently published.
//   - DPDP Rules, 2025 r.14(3): the contact for data-protection queries and the
//     grievance-response timeline must be published.
//
// Same doctrine as `support` above: a value we do not have is HIDDEN, never a
// plausible-looking placeholder. A fabricated grievance officer is worse than a
// missing one — it is a false statutory disclosure.
const orEmpty = (value) => String(value || '').trim();

export const legal = {
  // Registered legal name of the operator. Falls back to the brand so the pages
  // still read correctly before the entity is incorporated/registered.
  entity: orEmpty(import.meta.env.VITE_LEGAL_ENTITY) || 'TricityMatch',
  // Registered/principal place of business. Blank => the address line is omitted.
  address: orEmpty(import.meta.env.VITE_LEGAL_ADDRESS),
  gstin: orEmpty(import.meta.env.VITE_LEGAL_GSTIN),
  // Named natural person, resident in India (IT Rules 2021 r.3(2)(a)).
  grievanceOfficer: orEmpty(import.meta.env.VITE_GRIEVANCE_OFFICER),
  grievanceEmail: orEmpty(import.meta.env.VITE_GRIEVANCE_EMAIL) || 'grievance@tricitymatch.com',
  // DPDP contact — the person who answers questions about personal-data processing.
  privacyEmail: orEmpty(import.meta.env.VITE_PRIVACY_EMAIL) || 'privacy@tricitymatch.com',
  dataProtectionOfficer: orEmpty(import.meta.env.VITE_DPO_NAME),
  // Shown as "Last updated" on both policies. One constant so the two pages,
  // the mobile mirrors and the annual re-notification cannot drift apart.
  termsUpdated: '26 August 2026',
  privacyUpdated: '26 August 2026',
};

// Cloudinary Configuration
export const cloudinary = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
  folder: import.meta.env.VITE_CLOUDINARY_FOLDER || 'tricitymatch',
};

// App Configuration
export const app = {
  name: 'TricityMatch',
  version: __APP_VERSION__ || '1.0.0',
  buildTime: __BUILD_TIME__ || new Date().toISOString(),
  supportEmail: 'support@tricitymatch.com',
};

// Limits and Constraints
export const limits = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxGalleryPhotos: 6,
  maxMessageLength: 2000,
  maxBioLength: 1000,
  maxInterestTags: 20,
  minPasswordLength: 8,
  minAge: 18,
  maxAge: 99,
};

// UI Configuration
export const ui = {
  toastDuration: 4000,
  animationDuration: 0.3,
  debounceDelay: 300,
  infiniteScrollThreshold: 200,
  imageQuality: 85,
  thumbnailSize: 150,
};

// Subscription Plans
export const subscriptionPlans = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['Basic search', 'View profiles', '10 likes per day'],
    limits: {
      dailyLikes: 10,
      galleryPhotos: 3,
      canChat: false,
      canSeeWhoLiked: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 2999,
    features: [
      'Unlimited likes',
      'See who liked you',
      'Chat with matches',
      'Advanced filters',
      'Priority support',
    ],
    limits: {
      dailyLikes: Infinity,
      galleryPhotos: 10,
      canChat: true,
      canSeeWhoLiked: true,
    },
  },
  elite: {
    id: 'elite',
    name: 'Elite',
    price: 4999,
    features: [
      'All Premium features',
      'Verified badge',
      'Profile boost',
      'Priority in search',
      'Dedicated support',
    ],
    limits: {
      dailyLikes: Infinity,
      galleryPhotos: 20,
      canChat: true,
      canSeeWhoLiked: true,
      hasProfileBoost: true,
      hasVerifiedBadge: true,
    },
  },
};

// Validation Patterns
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  name: /^[a-zA-Z\s'-]{2,50}$/,
};

// Error Messages
export const errorMessages = {
  network: 'Network error. Please check your connection.',
  unauthorized: 'Please log in to continue.',
  forbidden: 'You do not have permission to perform this action.',
  notFound: 'The requested resource was not found.',
  validation: 'Please check your input and try again.',
  server: 'Server error. Please try again later.',
  default: 'Something went wrong. Please try again.',
};

// Export all config
const config = {
  isDevelopment,
  isProduction,
  mode,
  API_URL,
  WS_URL,
  features,
  razorpay,
  legal,
  cloudinary,
  app,
  limits,
  ui,
  subscriptionPlans,
  patterns,
  errorMessages,
};

export default config;
