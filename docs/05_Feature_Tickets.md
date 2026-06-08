# TricityShadi Mobile App — Feature Ticket List
**Version:** 1.0 | **Date:** June 2026

---

## How to Read This Document

| Field | Values |
|-------|--------|
| **Priority** | P0 = Blocker / Launch critical · P1 = High / Core experience · P2 = Medium / Enhancement · P3 = Low / Nice-to-have |
| **Effort** | S = < 1 day · M = 1–3 days · L = 3–7 days · XL = 1–2 weeks |
| **Phase** | 1 = MVP launch · 2 = v1.1 enhancement · 3 = v2+ growth |

Tickets are ordered by execution sequence within each phase — implement in order.

---

# PHASE 1 — MVP (Must Ship to Launch)

---

## EPIC 1: Project Setup & Infrastructure

### APP-001 · React Native Project Initialisation
**Priority:** P0 | **Effort:** M | **Phase:** 1

**Description:** Bootstrap the React Native project using Expo bare workflow with TypeScript, configured for iOS and Android.

**Tasks:**
- `npx create-expo-app mobile --template expo-template-bare-typescript`
- Install and configure: NativeWind v4, React Navigation v6, Zustand, TanStack Query v5, Axios
- Configure TypeScript strict mode (`tsconfig.json`)
- Set up ESLint + Prettier + Husky pre-commit hooks
- Configure path aliases (`@/components`, `@/api`, `@/stores`, etc.)
- Set up EAS project: `eas init` + `eas build --profile development`
- Add `.env.development` + `.env.production` templates
- Integrate with existing monorepo (`package.json` workspaces)

**Acceptance Criteria:**
- [ ] `npx expo start` launches on iOS simulator and Android emulator
- [ ] TypeScript compiles with zero errors
- [ ] EAS development build installable on physical device
- [ ] Path aliases resolve correctly

**Dependencies:** None

---

### APP-002 · Shared Type Definitions
**Priority:** P0 | **Effort:** S | **Phase:** 1

**Description:** Create a `shared/` package in the monorepo with TypeScript types mirroring the existing backend Sequelize models.

**Types to define:** `User`, `Profile`, `Match`, `Message`, `Notification`, `Subscription`, `Verification`, `CallSession`, `BureauClient`, `Report`, `Block`

**Acceptance Criteria:**
- [ ] All shared types importable in both `mobile/` and `frontend/`
- [ ] Types match backend model field names exactly

**Dependencies:** APP-001

---

### APP-003 · API Client Setup
**Priority:** P0 | **Effort:** S | **Phase:** 1

**Description:** Configure the Axios API client with base URL, JWT interceptors, and 401 auto-refresh.

**Tasks:**
- Create `src/api/client.ts` with Axios instance pointing to `EXPO_PUBLIC_API_URL`
- Request interceptor: attach `Authorization: Bearer {accessToken}` header
- Response interceptor: on 401 → call `/auth/refresh-token` → retry original request → on refresh failure → logout
- Exponential backoff retry: 3 retries at 1s/2s/4s for network errors (not 4xx/5xx)
- Log all API errors in development mode

**Acceptance Criteria:**
- [ ] API calls include auth header on authenticated routes
- [ ] 401 triggers silent token refresh + request retry
- [ ] 3 failed retries logout the user
- [ ] Timeout set to 15 seconds

**Dependencies:** APP-001

---

### APP-004 · Authentication Store (Zustand)
**Priority:** P0 | **Effort:** S | **Phase:** 1

**Description:** Set up the Zustand auth store and secure token storage.

**Tasks:**
- `authStore.ts`: user, accessToken, isAuthenticated, isLoading, setUser, setAccessToken, logout
- On app start: read refresh token from `expo-secure-store` → attempt silent refresh → hydrate store
- `logout()`: clear store + delete secure-store token + delete device FCM token via API
- Persist user object to MMKV for offline profile access

**Acceptance Criteria:**
- [ ] Refresh token survives app restart (expo-secure-store)
- [ ] Access token is memory-only (wiped on app close)
- [ ] Logout clears all stored tokens

**Dependencies:** APP-003

---

### APP-005 · Backend: FCM Push Notification Service
**Priority:** P0 | **Effort:** L | **Phase:** 1

**Description:** Replace the existing push notification stub in the backend with a working Firebase Admin SDK implementation.

**Backend Tasks:**
- Install `firebase-admin` package in `/backend`
- Initialize Firebase Admin in `server.js` using service account from environment
- Create `backend/utils/pushService.js` with `sendPush()` and `sendVoIPPush()` functions
- Create Migration 023: `device_tokens` table (user_id, token, platform, created_at)
- Create `DeviceToken` Sequelize model
- Add endpoints:
  - `POST /api/v1/auth/device-token` — register token (auth required)
  - `DELETE /api/v1/auth/device-token` — remove token on logout (auth required)
- Hook `sendPush()` into existing notification triggers: new match, new message, new interest, interest accepted
- Handle token cleanup when FCM returns `InvalidRegistration`

**Acceptance Criteria:**
- [ ] Device token saved on first login
- [ ] Device token deleted on logout
- [ ] Push notification arrives on device within 10s of trigger
- [ ] Stale tokens auto-cleaned from DB
- [ ] Existing notification triggers (new match, message) now also send push

**Dependencies:** APP-001, Firebase project created in Firebase Console

---

### APP-006 · Backend: Agora Token Generation
**Priority:** P0 | **Effort:** S | **Phase:** 1

**Description:** Add Agora RTC token generation endpoint to backend.

**Backend Tasks:**
- Install `agora-access-token` package
- Create `backend/utils/agoraToken.js`
- Create Migration 024: `call_sessions` table
- Add endpoints:
  - `GET /api/v1/calls/agora-token?channel={name}` — returns `{ token, channelName, uid }` (Premium+ only)
  - `POST /api/v1/calls/initiate` — log call, emit Socket.io `call-incoming` event
  - `PUT /api/v1/calls/:id/end` — log end time + duration
  - `GET /api/v1/calls/history` — paginated call history
- Add `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` to env config and validation

**Acceptance Criteria:**
- [ ] Token endpoint returns valid Agora token (1-hour TTL)
- [ ] Token endpoint returns 403 for non-Premium users
- [ ] Call session logged in DB with start/end/duration
- [ ] `call-incoming` Socket.io event emitted to callee's room

**Dependencies:** Agora account created, App ID + Certificate obtained

---

## EPIC 2: Authentication Screens

### APP-007 · Splash & Welcome Screen
**Priority:** P0 | **Effort:** S | **Phase:** 1

**Description:** App entry point. Checks auth state and routes appropriately.

**Tasks:**
- Splash: logo centred on rose-600 background, 2s display
- Auto-check for stored refresh token → silent refresh → route to Main or Welcome
- Welcome: hero illustration, 3 value-prop swipe cards, Get Started + Sign In buttons
- Language selector (top-right) → updates i18n and persists to MMKV

**Acceptance Criteria:**
- [ ] Returning logged-in user skips Welcome screen
- [ ] New/logged-out user sees Welcome screen
- [ ] Language change on Welcome screen persists through full app

**Dependencies:** APP-004

---

### APP-008 · Login Screen
**Priority:** P0 | **Effort:** S | **Phase:** 1

**Description:** Email/password login with Google OAuth option.

**Tasks:**
- Email + password inputs with validation (React Hook Form + Zod)
- Call `POST /auth/login` → store tokens → navigate to Main
- Google Sign-In button (expo-auth-session or @react-native-google-signin/google-signin) → `POST /auth/google`
- Biometric auto-prompt on mount (if `biometric_enabled` MMKV flag is true)
- Handle 401: "Invalid credentials" error
- Handle 429: "Account locked, try again in X minutes" with countdown
- Forgot password link → ForgotPasswordScreen

**Acceptance Criteria:**
- [ ] Successful login navigates to HomeScreen
- [ ] Google sign-in works on both platforms
- [ ] Account lockout countdown is accurate
- [ ] Biometric prompt appears automatically if enabled

**Dependencies:** APP-004, APP-007

---

### APP-009 · Sign Up Screen
**Priority:** P0 | **Effort:** S | **Phase:** 1

**Description:** New user registration (email + password only — full profile is in Onboarding).

**Tasks:**
- Email, password, confirm password inputs
- Password strength indicator (weak/medium/strong)
- "I agree to Terms & Privacy Policy" checkbox — links open webview
- Call `POST /auth/signup` → auto-login → navigate to OnboardingNavigator
- Google sign-up same endpoint as login (backend upserts)

**Acceptance Criteria:**
- [ ] Invalid email blocked with helpful error message
- [ ] Password confirmation mismatch shown inline
- [ ] T&C checkbox required before submit

**Dependencies:** APP-008

---

### APP-010 · Forgot & Reset Password Screens
**Priority:** P1 | **Effort:** S | **Phase:** 1

**Tasks:**
- Forgot password: email input → `POST /auth/forgot-password` → success message
- Reset password: token from deep link → new password form → `POST /auth/reset-password`
- Deep link scheme: `tricityshadi://reset-password?token=xxx`

**Acceptance Criteria:**
- [ ] Deep link opens Reset Password screen with token pre-filled
- [ ] Success navigates back to Login with success toast

**Dependencies:** APP-009

---

## EPIC 3: Onboarding Flow (14 Steps)

### APP-011 · Onboarding Navigator & Context
**Priority:** P0 | **Effort:** M | **Phase:** 1

**Description:** Scaffold the 14-step onboarding navigator with shared state context.

**Tasks:**
- `OnboardingNavigator`: Stack navigator with Steps 0–14
- `OnboardingContext`: React context holding all form values across steps
- Progress bar component (step count / 14)
- Back navigation (swipe back or back button)
- "Save & Continue" button: validates current step → saves partial profile to backend (PATCH /profile/me) → next step
- Skip button (for steps 8–11): marks step as skipped in context, skips to next
- Resume logic: on re-entry, check `/profile/me` completeness → navigate to first incomplete step

**Acceptance Criteria:**
- [ ] Progress bar shows correct step number on every screen
- [ ] Back navigation retains form values
- [ ] Partial profile saved on each step (not just at end)
- [ ] Exiting and re-entering resumes from correct step

**Dependencies:** APP-009, APP-003

---

### APP-012 · Onboarding Steps 0–7 (Core Required Steps)
**Priority:** P0 | **Effort:** L | **Phase:** 1

**Description:** Implement steps 0 (registering for), 1 (basic info), 2 (community), 3 (manglik/kundli), 4 (education), 5 (career), 6 (location), 7 (marital status).

**Tasks per step:**
- Form layout per Frontend Spec section 4.2
- React Hook Form field registration
- Zod validation schema per step
- NRI toggle in Step 6 → conditional country/visa fields
- Kundli upload in Step 3: expo-document-picker for PDF + expo-image-picker for image → upload to backend
- "Who are you registering for" selection persists pronouns throughout

**Acceptance Criteria:**
- [ ] All required fields validated before advancing
- [ ] Kundli document uploads successfully to Cloudinary
- [ ] NRI country field shows only when NRI toggle is on
- [ ] Data persists if user leaves and returns

**Dependencies:** APP-011

---

### APP-013 · Onboarding Steps 8–11 (Skippable Steps)
**Priority:** P0 | **Effort:** M | **Phase:** 1

**Description:** Implement lifestyle (8), family details (9), about me (10), partner preferences (11).

**Tasks:**
- Multi-select chip components for lifestyle choices and interest tags
- Dual-handle range slider for age/height preferences (Step 11)
- Character counter on bio textarea (Step 10)
- All steps have visible "Skip for now" button

**Acceptance Criteria:**
- [ ] Skipped steps appear as incomplete on profile meter
- [ ] All multi-selects persist correctly across navigation
- [ ] "Any" selection in preferences means no filter applied

**Dependencies:** APP-011

---

### APP-014 · Onboarding Step 12: Photo Upload
**Priority:** P0 | **Effort:** M | **Phase:** 1

**Description:** Multi-photo upload with reordering and face mask option.

**Tasks:**
- 6-slot photo grid (minimum 1 required)
- expo-image-picker: gallery + camera options
- expo-image-manipulator: resize to max 1200×1200, convert to JPEG
- Drag-to-reorder (react-native-draggable-flatlist or Reanimated)
- Face mask toggle per photo (sends `{ faceBlur: true }` to backend)
- Upload via `POST /profile/photo` (existing endpoint)
- Delete via `DELETE /profile/gallery/:photoId`
- Photo guidelines: "Clear face, no sunglasses, recent photo"

**Acceptance Criteria:**
- [ ] Photos upload successfully and appear in grid
- [ ] Reordering updates photo order in backend
- [ ] Face mask toggle visible and functional
- [ ] First slot (profile photo) cannot be deleted if it's the only photo

**Dependencies:** APP-011

---

### APP-015 · Onboarding Step 13: Mobile OTP Verification
**Priority:** P0 | **Effort:** S | **Phase:** 1

**Description:** Phone number collection and OTP verification.

**Tasks:**
- Phone number input with country code picker (India +91 default)
- "Send OTP" → `POST /auth/verify-otp` (existing endpoint)
- 6-box OTP input (auto-advance, auto-submit on fill)
- Resend OTP with 60-second countdown timer
- On success: navigate to Step 14

**Note:** Existing backend accepts `123456` / `000000` in dev. This must be fixed before production launch (see APP-056).

**Acceptance Criteria:**
- [ ] OTP auto-submits when all 6 digits entered
- [ ] Resend button disabled during 60-second cooldown
- [ ] Incorrect OTP shows inline error

**Dependencies:** APP-011

---

### APP-016 · Onboarding Step 14: Completion + Next Steps
**Priority:** P1 | **Effort:** S | **Phase:** 1

**Description:** Completion celebration screen with next-step CTAs.

**Tasks:**
- Profile completeness ring animation (Reanimated)
- 3 next-step cards: Get Verified / Complete Profile / Upload Kundli
- "Browse Matches" primary CTA → MainNavigator
- Request push notification permission here (first natural ask)

**Acceptance Criteria:**
- [ ] Push notification permission dialog appears
- [ ] Completion ring animates to correct percentage
- [ ] "Browse Matches" replaces Onboarding with Main stack (not nested)

**Dependencies:** APP-015

---

## EPIC 4: Core Navigation & Home

### APP-017 · Root & Main Navigator
**Priority:** P0 | **Effort:** S | **Phase:** 1

**Description:** Wire together all navigators with auth-gated routing.

**Tasks:**
- `RootNavigator`: checks `isAuthenticated` → Auth stack or Main stack
- `MainNavigator`: Bottom tab bar with 5 tabs (or 4 in Elder Mode)
- Tab icons (Ionicons), active rose-600 / inactive gray-400
- Unread badge on Messages tab (sourced from `notifications` query)
- Deep link handler: `tricityshadi://profile/:id`, `tricityshadi://chat/:userId`

**Acceptance Criteria:**
- [ ] Auth state change immediately switches navigator (no flicker)
- [ ] Deep links open correct screens
- [ ] Messages badge updates in real time via Socket.io

**Dependencies:** APP-004, APP-016

---

### APP-018 · Home Screen
**Priority:** P0 | **Effort:** M | **Phase:** 1

**Description:** Main dashboard with daily curated matches and quick stats.

**Tasks:**
- Header: logo + notification bell with badge count
- Profile completeness strip (tappable → EditProfile)
- Subscription plan badge
- "Today's Matches" horizontal scroll (fetches `GET /api/v1/matches/feed`, max 10)
- Quick action cards: "Who liked you: X" (Plus gate) + "Profile views: Y"
- "New Profiles" vertical list (recent registrations matching broad preferences)
- Skeleton loaders while loading
- Pull-to-refresh

**Acceptance Criteria:**
- [ ] Daily feed shows max 10 curated profiles
- [ ] Skeleton loaders appear before data loads
- [ ] Pull-to-refresh refetches all sections
- [ ] Notification badge count reflects unread count

**Dependencies:** APP-017

---

## EPIC 5: Profile

### APP-019 · Own Profile Screen
**Priority:** P0 | **Effort:** M | **Phase:** 1

**Description:** Full self-profile view with edit access and verification status.

**Tasks:**
- Fetch `GET /profile/me`
- Photo gallery (horizontal scroll with PageView dots)
- All sections from onboarding displayed in read mode
- Verification badges row + "Get Verified" CTA for unearned tiers
- Profile completeness ring + percentage
- "Preview as others see me" toggle (re-fetches with `?viewAs=public` to see blurred version)
- Edit button per section → EditProfileScreen
- Subscription plan + "Upgrade" button

**Acceptance Criteria:**
- [ ] All profile fields display correctly
- [ ] "Preview as others see" shows blurred photos
- [ ] Verification badges match actual verification tier

**Dependencies:** APP-017

---

### APP-020 · Other User Profile Screen
**Priority:** P0 | **Effort:** M | **Phase:** 1

**Description:** Viewing another user's profile with match actions.

**Tasks:**
- Fetch `GET /profile/:userId`
- Photo gallery with blur/watermark for non-mutual viewers
- Compatibility score bar
- Verification badges
- Authenticity score
- All detail sections (collapsible accordions)
- Kundli document viewer
- Sticky bottom action bar: Like / Shortlist / Pass → `POST /match/:userId`
- Replace action bar with "Send Message" if mutual match + Plus+
- ⋮ menu (top-right): Report / Block
- "Back" navigation
- Profile views are logged automatically on view (`POST /profile/:userId/view`)

**Acceptance Criteria:**
- [ ] Blurred photos show for non-mutual non-Premium viewers
- [ ] Watermark visible on blurred photos
- [ ] Match action responds within 500ms (optimistic UI)
- [ ] Mutual match triggers MutualMatchAnimation overlay

**Dependencies:** APP-019

---

### APP-021 · Edit Profile Screen
**Priority:** P1 | **Effort:** M | **Phase:** 1

**Description:** Allow users to edit any profile section post-onboarding.

**Tasks:**
- Navigate from Own Profile tapping any section
- Reuse onboarding step form components
- Save: `PUT /profile/me` → toast success → navigate back
- Photo management: add/remove/reorder photos inline

**Acceptance Criteria:**
- [ ] Changes reflect immediately on Own Profile without full reload
- [ ] Validation errors shown inline (same as onboarding)

**Dependencies:** APP-020

---

## EPIC 6: Search & Matching

### APP-022 · Search Screen & Results
**Priority:** P0 | **Effort:** L | **Phase:** 1

**Description:** Search with advanced filters and infinite scroll results.

**Tasks:**
- Search bar (name search → `GET /search?name=xxx`)
- Filter button → FilterPanel bottom sheet (APP-023)
- Results: FlatList with ProfileCard components
- Infinite scroll: cursor-based pagination (`GET /search?cursor=xxx&limit=20`)
- Sort picker: Compatibility / Newest / Recently Active
- Result count shown
- Saved search: load / save filter set (Plus+ gate for > 1 saved)
- Empty state component

**Acceptance Criteria:**
- [ ] Results load in < 2 seconds
- [ ] Scroll loads next page without visible jank
- [ ] Sort applies immediately without page reload
- [ ] Empty state shows with appropriate message

**Dependencies:** APP-018

---

### APP-023 · Filter Panel (Bottom Sheet)
**Priority:** P0 | **Effort:** L | **Phase:** 1

**Description:** Full advanced filter UI as a bottom sheet.

**Tasks:**
- @gorhom/bottom-sheet with snap points ['50%', '92%']
- Accordion sections for each filter category
- Dual-handle sliders for age and height ranges (react-native-range-slider or custom Reanimated)
- Multi-select dropdowns (religion, caste, profession, diet, marital status)
- Gotra exclusion tag input (type gotra name → chip appears → tap X to remove)
- NRI toggle → country multi-select
- Manglik radio: Any / Manglik Only / Non-Manglik Only
- "Apply" button shows live count: "Show 847 profiles" (fetches count on filter change, debounced 500ms)
- "Reset All" clears all filters
- "Save this search" button → naming modal → `POST /search/saved`

**Acceptance Criteria:**
- [ ] Filter count updates within 800ms of any change (debounced)
- [ ] Gotra exclusion removes same-gotra results from search
- [ ] Filter state persists when dismissing and reopening panel
- [ ] "Save this search" only available to Plus+ (gate shows upgrade modal for Free)

**Dependencies:** APP-022

---

### APP-024 · Match Actions (Like / Shortlist / Pass)
**Priority:** P0 | **Effort:** M | **Phase:** 1

**Description:** Swipe and button match actions with mutual match detection.

**Tasks:**
- Swipe gestures on ProfileCard (Reanimated + Gesture Handler): right=Like, left=Pass, up=Shortlist
- Overlay animations: green/heart for like, gray/X for pass, amber/bookmark for shortlist
- Action buttons on profile screen: Like / Shortlist / Pass
- API call: `POST /match/:userId { action: 'like' | 'shortlist' | 'pass' }`
- Optimistic UI: action registers immediately, reverts on API error
- Mutual match detection: backend returns `{ isMutualMatch: true }` → trigger MutualMatchAnimation
- MutualMatchAnimation: full-screen overlay with confetti + "It's a Match! 🎉" + "Start Chatting" CTA

**Acceptance Criteria:**
- [ ] Swipe gestures register with correct threshold (120dp)
- [ ] Optimistic action shows immediately (< 100ms)
- [ ] Mutual match animation triggers within 1s of API response
- [ ] Passing a profile removes it from current feed

**Dependencies:** APP-022, APP-020

---

### APP-025 · Matches Tab
**Priority:** P1 | **Effort:** M | **Phase:** 1

**Description:** 4-sub-tab matches screen.

**Tasks:**
- Sub-tabs: Mutual / Shortlisted / Liked Me / My Interests
- Mutual tab: `GET /match/matches` → show cards with "Chat" button
- Shortlisted tab: `GET /match/shortlisted` → show cards; cache in MMKV for offline
- Liked Me tab: `GET /match/liked-me` → Plus+ gate (blur + upgrade prompt for Free)
- My Interests tab: `GET /match/sent` → show status (Pending/Accepted/Declined) per card
- Accept/Decline incoming interests on Liked Me tab

**Acceptance Criteria:**
- [ ] Shortlisted tab loads from MMKV when offline
- [ ] Liked Me tab shows upgrade prompt for Free users
- [ ] Accept interest triggers mutual match check

**Dependencies:** APP-024, APP-025

---

## EPIC 7: Real-Time (Socket.io)

### APP-026 · Socket.io Client Integration
**Priority:** P0 | **Effort:** M | **Phase:** 1

**Description:** Connect to existing Socket.io server, handle events, manage connection lifecycle.

**Tasks:**
- Install `socket.io-client`
- `useSocket` hook: connect on auth, join `user_{userId}` room, reconnect on app foreground, disconnect on background (AppState listener)
- Handle events: `new-match`, `new-notification`, `message-received`, `typing-indicator`, `message-edited`, `message-deleted`, `call-incoming`, `call-accepted`, `call-declined`, `call-ended`
- Dispatch events to relevant React Query cache invalidations or Zustand store updates

**Acceptance Criteria:**
- [ ] Socket connects within 2s of login
- [ ] Socket reconnects automatically when app returns to foreground
- [ ] `new-match` event triggers mutual match animation
- [ ] `message-received` updates chat thread without manual refresh

**Dependencies:** APP-017, APP-005

---

## EPIC 8: Chat

### APP-027 · Conversations List Screen
**Priority:** P1 | **Effort:** M | **Phase:** 1

**Description:** List of active chat conversations (Plus+ gate).

**Tasks:**
- Plus+ gate check: show upgrade modal for Free users
- Fetch `GET /chat/conversations`
- FlatList of ConversationCard: avatar, name, last message preview, time, unread count badge
- Unread badge updated via Socket.io `message-received` event
- Tap → ChatThreadScreen
- Empty state: "Start chatting with your matches"

**Acceptance Criteria:**
- [ ] Conversations list updates in real time when new message arrives
- [ ] Unread count clears when thread is opened
- [ ] Free users see upgrade modal instead of conversations

**Dependencies:** APP-026

---

### APP-028 · Chat Thread Screen
**Priority:** P1 | **Effort:** L | **Phase:** 1

**Description:** Full chat thread with real-time messaging.

**Tasks:**
- Fetch `GET /chat/:userId` (paginated, load more on scroll up)
- Inverted FlatList (newest at bottom)
- MessageBubble component: own (right, rose) vs theirs (left, gray), timestamp, read receipts (✓ sent / ✓✓ read)
- Date separator between messages from different days
- Typing indicator bubble (3 animated dots)
- Input bar: text input + send button + attachment icon (future)
- Send message: `POST /chat/send` → optimistic UI → Socket.io delivery
- Long-press message: Edit (if own, < 15 min old) / Delete / Report
- "Request Contact" button in header (if quota > 0, Plus+) → confirmation modal → `POST /match/:userId/unlock-contact`
- Voice/Video call buttons in header (Premium+ gate)
- Socket.io: emit `typing` on input focus, handle `typing-indicator`

**Acceptance Criteria:**
- [ ] Message appears in own thread immediately (optimistic)
- [ ] Other party's message appears without refresh
- [ ] Read receipts update when other party reads
- [ ] Edit only available within 15 minutes of send
- [ ] Contact unlock deducts from quota (visible in header: "3 unlocks left")

**Dependencies:** APP-027, APP-026

---

## EPIC 9: Voice & Video Calls

### APP-029 · Voice Call Screen
**Priority:** P1 | **Effort:** L | **Phase:** 1

**Description:** In-app voice calls via Agora RTC.

**Tasks:**
- Install `react-native-agora`
- `VoiceCallScreen`: triggered by pressing call button in ChatThread
- Flow: fetch Agora token → `POST /calls/initiate` → join Agora channel → wait for callee
- In-call UI: callee avatar, timer, Mute / Speaker / End buttons
- End call: leave Agora channel → `PUT /calls/:id/end`
- Handle callee not answering: 30-second timeout → log as missed
- Background audio: keep call alive when app is backgrounded (iOS background mode: voip)

**Acceptance Criteria:**
- [ ] Call connects in < 5 seconds on 4G
- [ ] Mute toggle works correctly
- [ ] Speaker toggle works correctly
- [ ] Call duration logged in backend

**Dependencies:** APP-006, APP-028

---

### APP-030 · Video Call Screen
**Priority:** P1 | **Effort:** M | **Phase:** 1

**Description:** Video call built on top of the voice call implementation.

**Tasks:**
- Full-screen remote video feed
- PiP local camera (draggable corner, Reanimated)
- Camera toggle, camera flip, mute, end call buttons
- Auto-hide controls after 3 seconds (tap to show)
- Graceful fallback to audio-only if camera permission denied

**Acceptance Criteria:**
- [ ] Local camera preview shows before call connects
- [ ] Camera toggle switches on/off in real time
- [ ] Controls auto-hide and show on tap

**Dependencies:** APP-029

---

### APP-031 · Incoming Call (VoIP Push)
**Priority:** P1 | **Effort:** L | **Phase:** 1

**Description:** Native call UI for incoming calls when app is backgrounded or locked.

**Tasks:**
- iOS: `react-native-callkeep` (CallKit integration) + `@react-native-firebase/messaging` VoIP push
- Android: high-priority FCM data-only notification → launch `IncomingCallActivity`
- Foreground: show `IncomingCallModal` (accept/decline)
- Background/locked: native call UI appears
- Accept → app opens → `VideoCallScreen` or `VoiceCallScreen`
- Decline → log as declined via Socket.io
- Timeout after 30 seconds: log as missed, dismiss UI

**Acceptance Criteria:**
- [ ] Incoming call shows native call UI on locked iOS screen
- [ ] Incoming call shows heads-up notification on Android
- [ ] Declining sends real-time signal to caller

**Dependencies:** APP-029, APP-005

---

## EPIC 10: Notifications

### APP-032 · Push Notification Setup (Mobile)
**Priority:** P0 | **Effort:** M | **Phase:** 1

**Description:** Configure FCM + APNs on the mobile app.

**Tasks:**
- Install `@react-native-firebase/app` + `@react-native-firebase/messaging`
- Configure `google-services.json` (Android) + `GoogleService-Info.plist` (iOS)
- Request notification permission on onboarding completion (APP-016)
- On permission granted: get FCM token → `POST /auth/device-token`
- Handle FCM token refresh: `onTokenRefresh` → re-register
- `useNotificationHandler` hook: handle foreground notifications (show in-app toast) and background tap (deep link to relevant screen)
- Map notification type to deep link:
  - new_match → `/matches/mutual`
  - new_message → `/chat/:userId`
  - interest_received → `/matches/liked-me`
  - call_incoming → (handled by APP-031)

**Acceptance Criteria:**
- [ ] FCM token registered on login and on token refresh
- [ ] Foreground notification shows as toast
- [ ] Background notification tap navigates to correct screen
- [ ] Permission not requested before onboarding completion

**Dependencies:** APP-005, APP-016

---

### APP-033 · Notifications Screen
**Priority:** P1 | **Effort:** S | **Phase:** 1

**Description:** In-app notification list.

**Tasks:**
- Fetch `GET /notifications` (paginated)
- FlatList of NotificationItem: icon + text + time + unread indicator
- Tap: mark as read (`PUT /notifications/:id/read`) + navigate to relevant screen
- "Mark all read" button → `PUT /notifications/read-all`
- Pull to refresh
- Empty state

**Acceptance Criteria:**
- [ ] Unread notifications have distinct visual treatment
- [ ] Tapping notification navigates to correct screen
- [ ] Badge count on bell icon updates in real time

**Dependencies:** APP-032

---

## EPIC 11: Subscription & Payments

### APP-034 · Subscription Plans Screen
**Priority:** P1 | **Effort:** M | **Phase:** 1

**Description:** Plan selection and Razorpay payment.

**Tasks:**
- Fetch `GET /subscription/plans`
- Display 4 plan cards with features comparison (Free / Plus / Premium / Elite)
- Highlight current plan
- "Select" button → Razorpay payment flow
- Razorpay RN SDK: `react-native-razorpay`
- On payment success → `POST /subscription/verify-payment` → plan activates → toast + UI refresh
- On payment failure → error message + retry option
- Show UpgradeModal from feature gates → links to this screen

**Acceptance Criteria:**
- [ ] Razorpay sheet opens within 2 seconds
- [ ] Plan activates within 5 seconds of successful payment
- [ ] Plan state reflects identically on web and app (same DB)

**Dependencies:** APP-017, Razorpay keys configured

---

### APP-035 · Subscription History & Invoices
**Priority:** P2 | **Effort:** S | **Phase:** 1

**Tasks:**
- `GET /subscription/history` → list of past payments
- Per-item "Download Invoice" → `GET /subscription/invoice/:id` → PDF download
- Share invoice PDF via native share sheet

**Acceptance Criteria:**
- [ ] Invoice PDF downloads and opens correctly
- [ ] Share sheet opens with PDF attached

**Dependencies:** APP-034

---

## EPIC 12: Privacy & Account

### APP-036 · Settings Screen
**Priority:** P1 | **Effort:** M | **Phase:** 1

**Description:** Full settings screen with all controls.

**Tasks:**
- Grouped list layout (see Frontend Spec section 4.10)
- Toggle controls: Incognito mode, Elder mode, Biometric login
- Language picker (sheet with 3 options: En / Hi / Pa) → i18n.changeLanguage() + MMKV persist
- Photo privacy picker (3 options)
- Notification preferences sub-screen (per-category toggles)
- Family contact form (name + phone/email)
- Delete account flow: confirmation modal with "This cannot be undone" warning

**Acceptance Criteria:**
- [ ] Language change reflects immediately (no restart)
- [ ] Elder Mode toggles larger fonts and simplified nav
- [ ] Incognito toggle calls API and reflects within 60 seconds

**Dependencies:** APP-017

---

### APP-037 · Verification Screen
**Priority:** P1 | **Effort:** M | **Phase:** 1

**Description:** Document upload for verification tiers 2–4.

**Tasks:**
- Show 4 verification tiers with status (Pending / Verified / Not Submitted)
- ID Verification: Aadhaar or PAN photo upload
- Education: degree certificate or offer letter upload
- Income: ITR or salary slip upload
- Document picker (expo-document-picker + expo-image-picker)
- Upload via `POST /verification/submit` (existing endpoint)
- Show status: "Under review — typically 24–48 hours"

**Acceptance Criteria:**
- [ ] Documents upload successfully
- [ ] Status reflects admin approval/rejection in real time (push notification)
- [ ] Rejected submissions show rejection reason with retry option

**Dependencies:** APP-036, APP-005

---

### APP-038 · Block & Report
**Priority:** P1 | **Effort:** S | **Phase:** 1

**Tasks:**
- "Report" option in ⋮ menu on any profile
- Report sheet: category select + optional description + screenshot capture
- `POST /block/:userId` / `POST /report`
- Block: confirmation modal, profile disappears from all views immediately

**Acceptance Criteria:**
- [ ] Block is bidirectional and takes effect immediately
- [ ] Report creates entry in admin queue
- [ ] Blocked user cannot be searched or messaged

**Dependencies:** APP-020

---

## EPIC 13: Biometric & Offline

### APP-039 · Biometric Login
**Priority:** P1 | **Effort:** S | **Phase:** 1

**Tasks:**
- expo-local-authentication: check hardware availability
- Offer biometric setup after first successful password login (one-time prompt)
- On biometric success: read refresh token from expo-secure-store → silent refresh → login
- Settings toggle to enable/disable
- 3-attempt lockout → fall back to password

**Acceptance Criteria:**
- [ ] Biometric completes login in < 1.5 seconds
- [ ] Works on both Face ID (iOS) and fingerprint (Android)
- [ ] Disabling removes stored biometric preference but not refresh token

**Dependencies:** APP-008

---

### APP-040 · Offline Shortlist Cache
**Priority:** P1 | **Effort:** M | **Phase:** 1

**Tasks:**
- On shortlist action: store profile data in MMKV (key: `shortlist:{userId}`)
- On shortlist sync: fetch full shortlisted list, store all in MMKV
- Offline detection: `@react-native-community/netinfo`
- When offline: load shortlisted tab from MMKV (no API call)
- Show "Last synced: 2 hours ago" when offline
- Cache limit: 200 profiles (evict oldest on overflow)
- Cache images: react-native-fast-image pre-warm cache for shortlisted profile photos

**Acceptance Criteria:**
- [ ] Shortlisted tab loads in < 300ms from cache (no internet)
- [ ] Profile photos visible offline
- [ ] Cache syncs within 30 seconds of reconnection

**Dependencies:** APP-025

---

## EPIC 14: Multilingual & Elder Mode

### APP-041 · i18n Setup (English / Hindi / Punjabi)
**Priority:** P1 | **Effort:** L | **Phase:** 1

**Tasks:**
- Install i18next + react-i18next
- Create `src/i18n/en.json`, `hi.json`, `pa.json`
- Translate all UI strings for all 3 screens sets (auth, onboarding, home, search, matches, chat, settings, notifications)
- `useTranslation()` hook on every screen
- Language persisted in MMKV, loaded before app renders (no flash)

**Acceptance Criteria:**
- [ ] Zero English strings visible in Hindi or Punjabi mode
- [ ] Language switch instant (< 200ms)
- [ ] RTL not required for these languages (Punjabi/Gurmukhi is LTR)

**Dependencies:** APP-007

---

### APP-042 · Elder Mode
**Priority:** P1 | **Effort:** M | **Phase:** 1

**Tasks:**
- `elderMode` boolean in `uiStore.ts`
- When enabled:
  - Font scale: all Typography constants increase by 4sp
  - Bottom nav: reduce to 4 tabs (remove Chat → accessible via Matches)
  - Tap targets: increase container padding for minimum 60dp
  - Animations: disable (check `AccessibilityInfo.isReduceMotionEnabled()`)
- Toggle in Settings → Appearance → Elder Mode
- Persisted in MMKV

**Acceptance Criteria:**
- [ ] Font size visibly larger in Elder Mode
- [ ] Bottom nav shows 4 tabs only
- [ ] Animations disabled in Elder Mode

**Dependencies:** APP-036

---

## EPIC 15: Admin & Bureau Consoles

### APP-043 · Admin Panel (Mobile)
**Priority:** P2 | **Effort:** L | **Phase:** 1

**Tasks:**
- Admin tab visible only for `role === 'admin'` (checked from `/auth/me`)
- Verification queue: `GET /admin/verification/pending` → list with approve/reject buttons
- Reports queue: `GET /admin/reports` → list with block/dismiss actions
- Stats cards: signups today, active subscriptions, revenue (from existing admin endpoints)
- Reject modal: reason text input

**Acceptance Criteria:**
- [ ] Admin tab not visible to non-admin accounts
- [ ] Approve/reject triggers backend action and removes item from queue
- [ ] Stats reflect real-time data

**Dependencies:** APP-017

---

### APP-044 · Marriage Bureau Console (Mobile)
**Priority:** P2 | **Effort:** L | **Phase:** 1

**Tasks:**
- Bureau tab visible only for `role === 'bureau'`
- Client roster: `GET /bureau/clients` → list with profile summaries
- Add client form: same fields as onboarding (simplified for bureau agent entry)
- Match proposals: browse search → "Propose to Client" → select client modal
- Proposal status tracking: Pending / Viewed / Accepted / Declined
- Earnings: `GET /bureau/earnings` → total + breakdown

**Acceptance Criteria:**
- [ ] Bureau tab not visible to non-bureau accounts
- [ ] Proposal creates notification to both client and proposed match
- [ ] Earnings data reflects backend calculations

**Dependencies:** APP-022

---

## EPIC 16: Support & Success Stories

### APP-045 · In-App Support & Success Stories
**Priority:** P2 | **Effort:** S | **Phase:** 1

**Tasks:**
- Help Centre: webview loading help docs URL
- Contact Support: WhatsApp deep link (`https://wa.me/91XXXXXXXXXX?text=Hi+TricityShadi+Support`)
- Success Story submission form: couple names + wedding date + story text + optional photo
- `POST /stories` → admin queue → success toast

**Acceptance Criteria:**
- [ ] WhatsApp opens with pre-filled message
- [ ] Story submission confirms with toast

**Dependencies:** APP-036

---

# PHASE 2 — v1.1 Enhancements (Post-Launch, 60–90 days)

---

### APP-046 · Profile Completeness Rewards
**Priority:** P2 | **Effort:** M | **Phase:** 2

Gamification: milestone notifications ("Your profile is 80% complete — add your kundli to improve matches"), inline badges on Own Profile for each milestone hit.

---

### APP-047 · "Interests Waiting" Weekly Digest Push
**Priority:** P2 | **Effort:** S | **Phase:** 2

Backend cron job (already exists for email) extended to also send push notification with weekly count of new matches and pending interests.

---

### APP-048 · Saved Search Alerts (Push)
**Priority:** P2 | **Effort:** M | **Phase:** 2

When a new profile matches a saved search filter set, send a push notification: "New match for your 'Punjabi Doctor in Chandigarh' search."

---

### APP-049 · "Why This Match" Explainer
**Priority:** P2 | **Effort:** M | **Phase:** 2

Tapping the compatibility score bar opens a bottom sheet explaining the breakdown: "Community: 95% | Lifestyle: 80% | Location: 70% | Preferences: 75%". Backend computes and returns breakdown in compatibility score API response.

---

### APP-050 · Voice Note Profile Intros
**Priority:** P2 | **Effort:** L | **Phase:** 2

Users can record a 30-second voice note that plays on their profile. Upload via new `POST /profile/voice-intro` endpoint. Played in profile view (Premium+ viewers only).

---

### APP-051 · Compatibility Quiz
**Priority:** P2 | **Effort:** M | **Phase:** 2

10-question quiz in profile section. Answers factored into compatibility score. Questions: lifestyle habits, family values, future goals. Stored as `profile.quizAnswers` JSON.

---

### APP-052 · Video Profile Verification (Selfie Liveness)
**Priority:** P2 | **Effort:** XL | **Phase:** 2

Selfie liveness check at verification submission: user records 3-second selfie → compared to uploaded profile photo. Integration with AWS Rekognition or similar. Adds "Video Verified" badge.

---

### APP-053 · Family Group Chat
**Priority:** P2 | **Effort:** L | **Phase:** 2

Group chat thread that includes the candidate and their designated family contacts. Socket.io room with multiple participants. Frontend: group chat UI variation of ChatThread.

---

### APP-054 · Guardian Co-Pilot Mode
**Priority:** P2 | **Effort:** L | **Phase:** 2

Read-only guardian account linked to candidate (by invitation from candidate). Guardian can browse candidate's matches and shortlists, but cannot send messages or make match actions.

---

# PHASE 3 — v2 Growth Features

---

### APP-055 · Horoscope Auto-Match Score
**Priority:** P3 | **Effort:** XL | **Phase:** 3

Vedic kundli matching algorithm (Ashtakoot / 36-point system). Input: birth details from both profiles. Output: compatibility score contribution. Third-party API or in-house implementation.

---

### APP-056 · Real OTP Integration (Production Security Fix)
**Priority:** P0 | **Effort:** M | **Phase:** 1 (before production launch)

**CRITICAL:** The existing backend accepts `123456` and `000000` as valid OTPs. This must be fixed before the app goes live.

**Tasks:**
- Integrate MSG91, Twilio, or Fast2SMS for real OTP delivery
- Remove dev bypass codes
- Add OTP rate limiting (3 sends per hour per number)

---

### APP-057 · WhatsApp-Based Onboarding
**Priority:** P3 | **Effort:** XL | **Phase:** 3

Allow users to complete basic profile setup via WhatsApp chatbot (WhatsApp Business API). Profile created from WhatsApp conversation, user then downloads app for full experience.

---

### APP-058 · Dark Mode
**Priority:** P3 | **Effort:** L | **Phase:** 3

Full dark colour palette. All components updated with dark-mode variants. Follows system dark mode setting with manual override in Settings.

---

### APP-059 · Astrologer Consult Marketplace
**Priority:** P3 | **Effort:** XL | **Phase:** 3

In-app marketplace for booking astrologer consultations. Browse astrologers (verified, rated), book slots, pay via Razorpay, video call via Agora. New service category requiring its own DB schema.

---

### APP-060 · Background / Marital Status Check
**Priority:** P3 | **Effort:** L | **Phase:** 3

Integration with third-party background check API (e.g., AuthBridge, Signzy India). User consents and pays a fee. Check court records and marital status database. Result shown as additional verification badge.

---

# Summary Table

| Phase | Tickets | P0 | P1 | P2 | P3 |
|-------|---------|----|----|----|----|
| Phase 1 (MVP) | 45 | 16 | 21 | 8 | 0 |
| Phase 2 (v1.1) | 9 | 0 | 0 | 9 | 0 |
| Phase 3 (v2) | 6 | 1 | 0 | 0 | 5 |

**Recommended build order for solo dev + AI agent:**
EPIC 1 (Setup) → EPIC 2 (Auth) → EPIC 3 (Onboarding) → EPIC 4 (Navigation) → EPIC 14 (i18n early) → EPIC 5 (Profile) → EPIC 6 (Search) → EPIC 7 (Socket.io) → EPIC 8 (Chat) → EPIC 9 (Calls) → EPIC 10 (Notifications) → EPIC 11 (Subscription) → EPIC 12 (Privacy) → EPIC 13 (Biometric/Offline) → EPIC 15 (Admin/Bureau) → EPIC 16 (Support)

---

*Document owner: Product / Engineering — Globoniks Studio*
