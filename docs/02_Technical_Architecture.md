# TricityShadi Mobile App — Technical Architecture
**Version:** 1.0 | **Date:** June 2026

---

## 1. Architecture Philosophy

**Single backend, multiple clients.** The existing Express.js + PostgreSQL backend is the single source of truth. The React Native mobile app is a new client — it consumes the same `/api/v1` REST endpoints as the web app. User data, profiles, matches, and messages are identical across both surfaces in real time.

**What we add to the backend (mobile-specific only):**
1. FCM device token registration/deregistration
2. Push notification delivery (replacing the existing stub)
3. Agora RTC token generation endpoint
4. Call session logging
5. Cursor-based pagination on high-volume list endpoints (web uses offset; mobile needs cursors for infinite scroll)

**What we do NOT do:**
- No separate mobile database
- No separate mobile API service
- No data duplication between web and app

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                 │
│                                                                 │
│   ┌─────────────────┐          ┌──────────────────────────┐    │
│   │   React Web App │          │  React Native Mobile App │    │
│   │   (Vite + RN)   │          │   (Expo bare, iOS+Android)│   │
│   └────────┬────────┘          └────────────┬─────────────┘    │
└────────────┼──────────────────────────────── ┼─────────────────┘
             │  HTTPS REST + Socket.io          │ HTTPS REST + Socket.io
             │                                  │
┌────────────▼──────────────────────────────────▼─────────────────┐
│                         NGINX (Reverse Proxy)                    │
│              Rate limiting · TLS termination · Load balance      │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                    Express.js API Server (Node 20)               │
│                    /api/v1  ·  Socket.io                         │
│                                                                  │
│  Auth · Profile · Search · Match · Chat · Subscription          │
│  Verification · Notification · Block/Report · Admin · Bureau     │
│  [NEW] Push Notification Service · Agora Token Generator         │
└─────┬───────────────┬──────────────────┬────────────────────────┘
      │               │                  │
┌─────▼─────┐  ┌──────▼──────┐  ┌───────▼──────┐
│PostgreSQL │  │   Redis 7   │  │  Bull Queues  │
│    15     │  │(Cache+Locks)│  │(Email·Push·  │
│(Primary   │  │             │  │ Cleanup jobs)│
│ DB)       │  └─────────────┘  └──────────────┘
└───────────┘
      │
┌─────▼──────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
│                                                                 │
│  Cloudinary (photos)  ·  Razorpay (payments)                   │
│  Firebase Admin SDK (FCM/APNs push)                             │
│  Agora RTC (voice/video)  ·  Gmail SMTP (email)                │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Decided Tech Stack

### 3.1 Mobile Frontend

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| Framework | React Native 0.74+ | JS/TS — code-sharing with web logic, large ecosystem |
| Expo | Bare Workflow (SDK 51+) | EAS Build for app store, OTA updates, supports all native modules |
| Navigation | React Navigation v6 | Industry standard, Stack + Bottom Tabs + Drawer |
| State management | Zustand | Simple, lightweight, no boilerplate — right for solo dev |
| Server state / caching | TanStack Query (React Query v5) | Caching, background sync, offline support, pagination |
| API client | Axios | Same pattern as existing web app, interceptors for JWT refresh |
| Real-time | Socket.io-client | Same server already runs Socket.io |
| Forms | React Hook Form + Zod | Fast validation, works well with RN |
| Styling | NativeWind v4 | Tailwind CSS for RN — same design language as web |
| UI Components | React Native Paper (base) + custom | Material-ish base, extend with custom branded components |
| Voice/Video calls | react-native-agora | Official Agora SDK, well-maintained |
| Push notifications | @react-native-firebase/messaging | FCM (Android) + APNs via Firebase (iOS) |
| Biometric auth | expo-local-authentication | Face ID / Fingerprint, cross-platform |
| Secure storage | expo-secure-store | Keychain (iOS) + Keystore (Android) for tokens |
| Fast local cache | MMKV via react-native-mmkv | 30x faster than AsyncStorage for offline cache |
| Images | react-native-fast-image | Persistent cache, priority loading |
| Internationalization | i18next + react-i18next | En/Hi/Pa language support |
| In-call VoIP (iOS) | react-native-callkeep | CallKit integration for native call UI |
| Animations | React Native Reanimated v3 | Native thread animations (swipe cards, transitions) |
| Gesture handling | React Native Gesture Handler | Works with Reanimated for swipe cards |
| Date/time | date-fns | Lightweight, tree-shakeable |
| Build | EAS Build (Expo) | Cloud builds, no local Xcode/Android Studio required |
| OTA updates | EAS Update | Push JS bundle updates without app store review |

### 3.2 Backend (Extensions to Existing)

The existing Express.js stack does not change. These are additions:

| Addition | Library | Purpose |
|---------|---------|---------|
| FCM push delivery | firebase-admin | Send push to Android + iOS |
| Agora token generation | agora-access-token | Generate RTC tokens for voice/video |
| Device token table | (new DB migration) | Store FCM tokens per user device |
| Call sessions table | (new DB migration) | Log call start/end, duration, type |
| Cursor pagination | (query modification) | Mobile-friendly infinite scroll |

### 3.3 Infrastructure (Unchanged)

Docker Compose, Nginx, PostgreSQL 15, Redis 7, Bull queues, Cloudinary, Razorpay, Gmail SMTP — all unchanged from existing web backend.

---

## 4. Mobile App Architecture

### 4.1 Folder Structure

```
/mobile-app (new repo or /app in monorepo)
├── app.json                    # Expo config
├── eas.json                    # EAS build profiles
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── index.js                    # Entry point
└── src/
    ├── api/                    # API layer
    │   ├── client.ts           # Axios instance (same base URL as web)
    │   ├── auth.ts
    │   ├── profile.ts
    │   ├── search.ts
    │   ├── matches.ts
    │   ├── chat.ts
    │   ├── calls.ts            # NEW: Agora token fetch
    │   ├── notifications.ts
    │   ├── subscription.ts
    │   └── bureau.ts
    ├── components/
    │   ├── ui/                 # Base components (Button, Input, Badge, Card, Avatar, Modal)
    │   ├── common/             # App-wide (Navbar, BottomTab, LoadingSpinner, UpgradeModal)
    │   ├── cards/              # ProfileCard, MatchCard, ConversationCard
    │   ├── profile/            # ProfileCompletionMeter, VerificationBadges, PhotoGallery
    │   ├── search/             # FilterPanel, SearchResultCard
    │   ├── matching/           # SwipeCard, CompatibilityMeter, MutualMatchAnimation
    │   └── calls/              # CallScreen, VideoCallScreen, IncomingCallUI
    ├── features/               # Feature-based slices
    │   ├── auth/
    │   ├── onboarding/         # Steps 1-14 screens + context
    │   ├── profile/
    │   ├── search/
    │   ├── matches/
    │   ├── chat/
    │   ├── calls/
    │   ├── subscription/
    │   ├── notifications/
    │   ├── bureau/
    │   └── admin/
    ├── navigation/
    │   ├── RootNavigator.tsx   # Auth check → Auth stack or Main stack
    │   ├── AuthNavigator.tsx   # Splash → Login → Signup → Onboarding
    │   ├── MainNavigator.tsx   # Bottom tabs
    │   ├── OnboardingNavigator.tsx
    │   └── types.ts            # Navigation param types
    ├── stores/                 # Zustand stores
    │   ├── authStore.ts        # User, tokens, plan
    │   ├── uiStore.ts          # Language, elder mode, theme
    │   └── callStore.ts        # Active call state
    ├── hooks/
    │   ├── useSocket.ts        # Socket.io connection + event handlers
    │   ├── usePushNotifications.ts
    │   ├── useIncomingCall.ts  # Agora incoming call handling
    │   ├── useBiometric.ts
    │   └── useOfflineSync.ts
    ├── i18n/
    │   ├── index.ts
    │   ├── en.json
    │   ├── hi.json
    │   └── pa.json
    ├── constants/
    │   ├── plans.ts
    │   ├── routes.ts
    │   └── config.ts           # API base URL, Agora App ID, Firebase config
    ├── types/
    │   └── index.ts            # Shared TypeScript types (mirrors backend models)
    └── utils/
        ├── cache.ts            # MMKV helpers
        ├── secureStorage.ts    # Keychain/Keystore helpers
        ├── imageUtils.ts       # Watermark, resize
        └── dateUtils.ts
```

### 4.2 Navigation Structure

```
RootNavigator
├── AuthStack (when not logged in)
│   ├── SplashScreen
│   ├── WelcomeScreen
│   ├── LoginScreen
│   ├── SignupScreen
│   ├── ForgotPasswordScreen
│   ├── OTPScreen
│   └── OnboardingNavigator (Steps 1–14)
│
└── MainStack (when logged in)
    ├── BottomTabNavigator
    │   ├── HomeTab
    │   │   ├── HomeScreen (Daily matches + Stats)
    │   │   └── NotificationsScreen
    │   ├── SearchTab
    │   │   ├── SearchScreen
    │   │   ├── FilterPanel (bottom sheet)
    │   │   └── SearchResultsScreen
    │   ├── MatchesTab
    │   │   ├── MatchesScreen (Mutual | Shortlisted | Liked Me | Liked By Me)
    │   │   └── InterestDetailScreen
    │   ├── ChatTab
    │   │   ├── ConversationsScreen
    │   │   └── ChatThreadScreen
    │   └── ProfileTab
    │       ├── OwnProfileScreen
    │       ├── EditProfileScreen
    │       └── SettingsScreen
    │
    ├── ProfileScreen (other user — pushed from anywhere)
    ├── CallScreen (Voice — pushed by call trigger)
    ├── VideoCallScreen (pushed by call trigger)
    ├── SubscriptionScreen
    ├── VerificationScreen
    ├── SuccessStoryScreen
    ├── SupportScreen
    ├── AdminStack (role=admin only)
    │   ├── AdminHomeScreen
    │   ├── VerificationQueueScreen
    │   └── ReportsQueueScreen
    └── BureauStack (role=bureau only)
        ├── BureauHomeScreen
        ├── ClientRosterScreen
        ├── MatchProposalScreen
        └── EarningsScreen
```

---

## 5. Backend Extensions (New Code)

### 5.1 New API Endpoints

These are additive — the existing API is not modified, only extended.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/device-token` | Auth | Register FCM device token |
| DELETE | `/api/v1/auth/device-token` | Auth | Remove FCM token on logout |
| GET | `/api/v1/calls/agora-token` | Auth + Premium | Generate Agora RTC token |
| POST | `/api/v1/calls/initiate` | Auth + Premium | Log call start, notify recipient |
| PUT | `/api/v1/calls/:id/end` | Auth | Log call end + duration |
| GET | `/api/v1/calls/history` | Auth | Paginated call history |
| GET | `/api/v1/matches/feed` | Auth | Cursor-paginated daily curated feed |
| GET | `/api/v1/search?cursor=` | Auth | Cursor-based search (mobile) |

### 5.2 New Database Migrations

**Migration 023 — device_tokens**
```sql
CREATE TABLE device_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  platform      VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
```

**Migration 024 — call_sessions**
```sql
CREATE TABLE call_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id     UUID NOT NULL REFERENCES users(id),
  callee_id     UUID NOT NULL REFERENCES users(id),
  call_type     VARCHAR(10) NOT NULL CHECK (call_type IN ('voice', 'video')),
  agora_channel VARCHAR(255) NOT NULL,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  duration_secs INTEGER,
  status        VARCHAR(20) DEFAULT 'initiated' 
                CHECK (status IN ('initiated','connected','ended','missed','declined')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_call_sessions_caller ON call_sessions(caller_id);
CREATE INDEX idx_call_sessions_callee ON call_sessions(callee_id);
```

### 5.3 Push Notification Service Implementation

Replace the existing stub in `backend/utils/emailService.js` area. Create `backend/utils/pushService.js`:

```javascript
// backend/utils/pushService.js
const admin = require('firebase-admin');

// Init once at startup (in server.js)
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const sendPush = async (userId, { title, body, data = {} }) => {
  const tokens = await DeviceToken.findAll({ where: { userId } });
  if (!tokens.length) return;

  const messages = tokens.map(t => ({
    notification: { title, body },
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    token: t.token,
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } }
  }));

  const response = await admin.messaging().sendEach(messages);
  // Handle token cleanup on InvalidRegistration errors
  response.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === 'messaging/invalid-registration-token') {
      tokens[i].destroy();
    }
  });
};

const sendVoIPPush = async (userId, { callerName, callId, callType }) => {
  // iOS: use APNs VoIP push via firebase-admin with voip content-available
  // Android: high-priority FCM data-only message
  // ... implementation
};

module.exports = { sendPush, sendVoIPPush };
```

### 5.4 Agora Token Generator

```javascript
// backend/utils/agoraToken.js
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

const generateToken = (channelName, uid, role = RtcRole.PUBLISHER) => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const expiresIn = 3600; // 1 hour
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expiresIn;

  return RtcTokenBuilder.buildTokenWithUid(
    appId, appCertificate, channelName,
    uid, role, privilegeExpireTime
  );
};

// Channel name convention: sorted user IDs joined with underscore
// e.g. users abc and xyz → channel "abc_xyz" (alphabetical sort)
const getChannelName = (userId1, userId2) =>
  [userId1, userId2].sort().join('_');

module.exports = { generateToken, getChannelName };
```

### 5.5 New Environment Variables (add to .env)

```bash
# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@project.iam.gserviceaccount.com

# Agora (Voice/Video)
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-app-certificate
```

---

## 6. Real-Time Architecture (Socket.io)

The existing Socket.io server is used by the mobile app identically to the web. No changes required to `backend/socket/socketHandler.js`.

**Mobile-specific considerations:**
- Socket.io client reconnects automatically on app foreground (handled by `useSocket` hook)
- Socket disconnects gracefully on app background (to save battery)
- Socket.io events consumed by mobile:

| Event | Direction | Handler |
|-------|-----------|---------|
| `join-room` | Client → Server | Join `user_{userId}` room on connect |
| `send-message` | Client → Server | Send chat message |
| `message-received` | Server → Client | New message received |
| `typing` | Client → Server | Typing indicator |
| `typing-indicator` | Server → Client | Show typing bubble |
| `message-edited` | Server → Client | Update message in thread |
| `message-deleted` | Server → Client | Remove message from thread |
| `new-match` | Server → Client | Mutual match event → celebration animation |
| `new-notification` | Server → Client | Any notification → update badge count |
| `call-incoming` | Server → Client | Incoming call → VoIP notification |
| `call-accepted` | Server → Client | Other party accepted → connect Agora |
| `call-declined` | Server → Client | Other party declined |
| `call-ended` | Server → Client | Other party ended call |

---

## 7. Agora Voice/Video Call Flow

```
Caller taps "Call"
      │
      ▼
App fetches Agora token from backend
GET /api/v1/calls/agora-token?channelName={sorted_user_ids}&uid={callerId}
      │
      ▼
Backend logs call session (status: initiated)
POST /api/v1/calls/initiate
      │
      ├── Socket.io emits 'call-incoming' to callee's room
      │       ├── If callee app is foreground → IncomingCallUI shows
      │       └── If callee app is background → VoIP push notification (CallKit/ConnectionService)
      │
      ▼
Callee accepts
      │
      ├── Callee fetches their own Agora token
      ├── Both apps join same Agora channel
      ├── Socket.io emits 'call-accepted' to caller
      └── Agora SDK handles A/V streams (peer-to-peer via Agora servers)
      │
      ▼
Either party ends call
      │
      ├── App calls PUT /api/v1/calls/:id/end
      ├── Socket.io emits 'call-ended' to other party
      └── Agora channel closed
```

---

## 8. Offline Architecture

**What works offline:**
- Shortlisted profiles (cached via MMKV + fast-image)
- Chat conversation list (React Query cache)
- Own profile (React Query cache)
- Notification list (React Query cache)

**What requires internet:**
- Search / browse
- Sending messages / interests
- Voice/video calls
- Payments

**Implementation:**
- React Query `staleTime: 1000 * 60 * 5` (5 min) + `cacheTime: 1000 * 60 * 60 * 24` (24h)
- Shortlisted profiles: additionally persisted to MMKV on sync
- NetInfo from `@react-native-community/netinfo` to detect connectivity
- Offline banner shown when `isConnected === false`
- Queue failed mutations (optimistic updates) and replay on reconnect

---

## 9. Image Handling

**Upload flow:**
1. User picks photo from gallery or camera (expo-image-picker)
2. App resizes to max 1200×1200, converts to JPEG (expo-image-manipulator)
3. Uploaded to backend via multipart form → Multer → Cloudinary
4. Cloudinary returns URL → stored in DB (same as web)

**Display flow:**
- Profile photos served from Cloudinary with transformation params: `w_400,h_400,c_fill,f_auto,q_auto`
- Thumbnails for card grid: `w_150,h_150,c_fill,f_auto,q_70`
- Photo blur: CSS `blur(20px)` on web → React Native blurRadius prop on Image
- Watermark: applied server-side by Cloudinary overlay text layer for non-mutual views

---

## 10. API Client Pattern (Mobile)

```typescript
// src/api/client.ts
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { refreshAccessToken } from './auth';

const API_BASE = process.env.EXPO_PUBLIC_API_URL; // e.g. https://tricityshadi.com/api/v1

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,  // send httpOnly cookies (same as web)
  timeout: 15000,
});

// Request interceptor: attach access token
apiClient.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 → refresh token → retry
apiClient.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        useAuthStore.getState().setAccessToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(err);
  }
);
```

---

## 11. Environment Configuration

### Mobile app `.env` (via Expo env)

```bash
EXPO_PUBLIC_API_URL=https://tricityshadi.com/api/v1
EXPO_PUBLIC_WS_URL=https://tricityshadi.com
EXPO_PUBLIC_AGORA_APP_ID=your-agora-app-id
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxx
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

### EAS Build profiles (`eas.json`)

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "http://localhost:5001/api/v1" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://staging.tricityshadi.com/api/v1" }
    },
    "production": {
      "env": { "EXPO_PUBLIC_API_URL": "https://tricityshadi.com/api/v1" }
    }
  }
}
```

---

## 12. Monorepo Structure (Recommended)

Add the mobile app to the existing monorepo:

```
/ (existing monorepo root)
├── backend/                  # Existing Express.js API (unchanged)
├── frontend/                 # Existing React web app (unchanged)
├── mobile/                   # NEW: React Native app
│   ├── app.json
│   ├── eas.json
│   ├── package.json
│   └── src/
├── shared/                   # NEW: Shared TypeScript types + constants
│   ├── types/
│   │   ├── user.ts
│   │   ├── profile.ts
│   │   ├── match.ts
│   │   └── subscription.ts
│   └── constants/
│       └── plans.ts
├── docker-compose.yml        # Unchanged
└── package.json              # Update workspaces: ["backend","frontend","mobile","shared"]
```

---

## 13. Deployment & CI/CD

| Step | Tool | Notes |
|------|------|-------|
| Backend deploy | Docker Compose (unchanged) | No change from existing |
| iOS build | EAS Build | Builds in Expo cloud, no local Xcode required |
| Android build | EAS Build | Builds AAB for Play Store |
| OTA JS updates | EAS Update | Push non-native changes without store review |
| App Store submit | EAS Submit | Automated submission to App Store + Play Store |
| CI | GitHub Actions | Run tests → EAS build → EAS submit |

**GitHub Actions pipeline (mobile):**
```yaml
on: push (main branch)
jobs:
  test → build (EAS) → submit (EAS) → notify (Slack)
```

---

*Document owner: Engineering / Globoniks Studio*
