export const API_ROUTES = {
  // Auth
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  LOGOUT: '/auth/logout',
  REFRESH_TOKEN: '/auth/refresh-token',
  GOOGLE: '/auth/google',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  VERIFY_OTP: '/auth/verify-otp',
  ME: '/auth/me',
  DEVICE_TOKEN: '/auth/device-token',

  // Profile
  MY_PROFILE: '/profile/me',
  PROFILE: (userId: string) => `/profile/${userId}`,
  PROFILE_VIEW: (userId: string) => `/profile/${userId}/view`,
  UPLOAD_PHOTO: '/profile/photo',
  DELETE_PHOTO: (photoId: string) => `/profile/gallery/${photoId}`,

  // Search
  SEARCH: '/search',
  SAVED_SEARCHES: '/search/saved',

  // Matches
  MATCH_ACTION: (userId: string) => `/match/${userId}`,
  MY_MATCHES: '/match/matches',
  SHORTLISTED: '/match/shortlisted',
  LIKED_ME: '/match/liked-me',
  SENT_INTERESTS: '/match/sent',
  DAILY_FEED: '/matches/feed',
  UNLOCK_CONTACT: (userId: string) => `/match/${userId}/unlock-contact`,

  // Chat
  CONVERSATIONS: '/chat/conversations',
  THREAD: (userId: string) => `/chat/${userId}`,
  SEND_MESSAGE: '/chat/send',

  // Calls
  AGORA_TOKEN: '/calls/agora-token',
  INITIATE_CALL: '/calls/initiate',
  END_CALL: (callId: string) => `/calls/${callId}/end`,
  CALL_HISTORY: '/calls/history',

  // Notifications
  NOTIFICATIONS: '/notifications',
  MARK_READ: (id: string) => `/notifications/${id}/read`,
  MARK_ALL_READ: '/notifications/read-all',

  // Subscription
  PLANS: '/subscription/plans',
  CREATE_ORDER: '/subscription/create-order',
  VERIFY_PAYMENT: '/subscription/verify-payment',
  SUBSCRIPTION_HISTORY: '/subscription/history',
  INVOICE: (id: string) => `/subscription/invoice/${id}`,

  // Verification
  SUBMIT_VERIFICATION: '/verification/submit',
  MY_VERIFICATION: '/verification/me',

  // Block & Report
  BLOCK: (userId: string) => `/block/${userId}`,
  REPORT: '/report',

  // Admin
  ADMIN_VERIFICATION_QUEUE: '/admin/verification/pending',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_APPROVE_VERIFICATION: (id: string) => `/admin/verification/${id}/approve`,
  ADMIN_REJECT_VERIFICATION: (id: string) => `/admin/verification/${id}/reject`,

  // Success Stories
  STORIES: '/stories',
} as const;
