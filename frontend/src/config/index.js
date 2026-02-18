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
export const razorpay = {
  keyId: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
  isConfigured: !!import.meta.env.VITE_RAZORPAY_KEY_ID,
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
  maxGalleryPhotos: 5,
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
  cloudinary,
  app,
  limits,
  ui,
  subscriptionPlans,
  patterns,
  errorMessages,
};

export default config;
