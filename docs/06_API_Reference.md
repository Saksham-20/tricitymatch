# TricityShadi — API Reference
**Version:** 2.0 | **Updated:** 2026-06-05 (Session 16)

All endpoints are under `/api/v1` unless noted. Legacy alias `/api` also works for some routes.

**Base URL (dev):** `http://localhost:5001/api/v1`  
**Base URL (prod):** `https://tricityshadi.com/api/v1`

---

## Authentication

All protected routes require an `accessToken` httpOnly cookie set at login. The cookie is sent automatically by the browser/app. Mobile clients send `Authorization: Bearer <token>` via axios interceptor.

**Token lifecycle:**
- Access token: 15-minute JWT, httpOnly cookie
- Refresh token: 7-day, hashed in DB, rotated on each use
- Account lockout: 5 failed attempts → 30-minute Redis lock

**Error format:**
```json
{ "success": false, "error": { "message": "...", "code": "..." } }
```

---

## Rate Limits

| Limiter | Applies to | Window | Max |
|---------|-----------|--------|-----|
| `apiLimiter` | all endpoints | 15 min | 200 |
| `authLimiter` | login/refresh | 15 min | 5 |
| `signupLimiter` | signup | 1 hr | 3 |
| `passwordResetLimiter` | forgot/reset password | 1 hr | 3 |
| `otpLimiter` | send-otp/verify-otp | 10 min | 10 |
| `searchLimiter` | search | 1 min | 30 |
| `messageLimiter` | chat send | 1 min | 60 |
| `profileUpdateLimiter` | PUT /profile/me | 1 min | 10 |
| `matchActionLimiter` | POST /match/:userId | 1 min | 60 |
| `uploadLimiter` | photo/doc uploads | 1 hr | 20 |
| `adminLimiter` | /admin/* | 1 min | 100 |
| `paymentLimiter` | payment endpoints | 1 hr | 10 |

---

## 1. Auth — `/auth`

### `POST /auth/signup`
Register new user. Rate: signupLimiter (3/hr).

**Body:**
```json
{ "email": "user@example.com", "password": "Pass@1234" }
```

**Response 201:**
```json
{ "success": true, "user": { "id": "uuid", "email": "...", "role": "user" } }
```
Sets `accessToken` + `refreshToken` httpOnly cookies.

---

### `POST /auth/login`
Login with email + password. Rate: authLimiter (5/15min) + lockout check.

**Body:**
```json
{ "email": "user@example.com", "password": "Pass@1234" }
```

**Response 200:**
```json
{ "success": true, "user": { "id": "uuid", "email": "...", "role": "user" } }
```
Sets cookies. Returns `{ remainingAttempts }` on 401 before lockout.

---

### `POST /auth/refresh`
Refresh access token using refresh cookie.

**Response 200:**
```json
{ "success": true }
```
Rotates both cookies. Returns 401 if refresh token invalid/expired.

---

### `POST /auth/logout`
🔒 Auth required. Revoke current session refresh token.

**Response 200:** `{ "success": true }`

---

### `POST /auth/logout-all`
🔒 Auth required. Revoke all refresh tokens for this user.

**Response 200:** `{ "success": true }`

---

### `POST /auth/forgot-password`
Send password reset email. Rate: passwordResetLimiter (3/hr).

**Body:** `{ "email": "user@example.com" }`

**Response 200:** Always returns success (email enumeration protection).

---

### `POST /auth/reset-password`
Reset password using token from email.

**Body:** `{ "token": "...", "password": "NewPass@1234" }`

**Response 200:** `{ "success": true }`

---

### `POST /auth/google`
Google OAuth — verify Google ID token, sign in or register. Rate: authLimiter.

**Body:** `{ "idToken": "google-id-token" }`

**Response 200:** `{ "success": true, "user": { ... }, "isNewUser": true }`. Sets cookies.

---

### `POST /auth/send-otp`
Send OTP to phone number. Rate: otpLimiter (10/10min). Real SMS via Fast2SMS/MSG91 when `SMS_PROVIDER=fast2sms`.

**Body:** `{ "phone": "+919876543210" }`

**Response 200:** `{ "success": true, "message": "OTP sent" }`

---

### `POST /auth/verify-otp`
Verify OTP. Rate: otpLimiter.

**Body:** `{ "phone": "+919876543210", "otp": "123456" }`

**Response 200:** `{ "success": true, "message": "Phone verified" }`

---

### `GET /auth/me`
🔒 Auth required. Get current authenticated user.

**Response 200:**
```json
{
  "success": true,
  "user": { "id": "uuid", "email": "...", "role": "user", "isVerified": true, "hasProfile": true }
}
```

---

### `POST /auth/change-password`
🔒 Auth required.

**Body:** `{ "currentPassword": "...", "newPassword": "NewPass@1234" }`

**Response 200:** `{ "success": true }`

---

### `GET /auth/sessions`
🔒 Auth required. List active sessions.

**Response 200:** `{ "success": true, "sessions": [{ "id": "uuid", "createdAt": "...", "userAgent": "..." }] }`

---

### `DELETE /auth/sessions/:sessionId`
🔒 Auth required. Revoke a specific session. `sessionId` must be UUID v4.

---

### `DELETE /auth/account`
🔒 Auth required. Soft-delete account (30-day retention before purge).

**Body:** `{ "password": "..." }`

**Response 200:** `{ "success": true, "message": "Account deletion scheduled" }`

---

## 2. Profile — `/profile`

### `GET /profile/me`
🔒 Auth required. Get own full profile.

**Response 200:** Full `Profile` object (see shared types).

---

### `PUT /profile/me`
🔒 Auth required. Update own profile. Accepts `multipart/form-data` (for photo uploads) or JSON. Rate: profileUpdateLimiter (10/min).

**Body fields (all optional):** firstName, lastName, dateOfBirth, height, weight, city, state, religion, caste, subCaste, gotra, motherTongue, maritalStatus, manglikStatus, zodiacSign, rashi, nakshatra, placeOfBirth, birthTime, education, profession, income, diet, smoking, drinking, bio, interestTags[], preferredAgeMin, preferredAgeMax, preferredHeightMin, preferredHeightMax, preferredCity[], familyType, familyStatus, photoPrivacy.

**Response 200:**
```json
{ "success": true, "profile": { ... }, "completionPercentage": 75 }
```

---

### `GET /profile/me/stats`
🔒 Auth required. Profile view count + interest stats.

**Response 200:** `{ "success": true, "stats": { "profileViews": 42, "likesReceived": 8, "matchCount": 3 } }`

---

### `GET /profile/me/viewers`
🔒 Auth + Premium required. List who viewed your profile.

**Query:** `?page=1&limit=20`

**Response 200:** `{ "success": true, "viewers": [{ "userId": "...", "viewedAt": "..." }] }`

---

### `DELETE /profile/me/photo`
🔒 Auth required. Delete a gallery photo.

**Body:** `{ "photoId": "cloudinary-public-id" }`

---

### `DELETE /profile/me/profile-photo`
🔒 Auth required. Delete primary profile photo.

---

### `POST /profile/voice-intro`
🔒 Auth required. Upload 30s voice intro. `multipart/form-data`, field `voiceIntro`. Rate: uploadLimiter (20/hr). Cloudinary `resource_type: 'video'`.

**Response 200:** `{ "success": true, "voiceIntroUrl": "https://..." }`

---

### `DELETE /profile/voice-intro`
🔒 Auth required. Delete voice intro.

---

### `PUT /profile/privacy`
🔒 Auth required. Update privacy settings.

**Body:** `{ "profileVisibility": "everyone"|"matches_only", "showOnlineStatus": true, "showLastSeen": true }`

---

### `GET /profile/:userId`
🔒 Auth required. Get another user's profile (with privacy + blur logic applied). Logs a profile view.

**Response 200:** Profile object. `photos` have blur applied if viewer is not mutual match or Premium+. Watermark flag included.

---

### `POST /profile/:userId/unlock-contact`
🔒 Auth + Premium required + contact unlock quota check. Reveal contact details.

**Response 200:** `{ "success": true, "contact": { "phone": "...", "email": "..." } }`

---

### `GET /profile/:userId/compatibility`
🔒 Auth required. Full compatibility breakdown (APP-049 "Why This Match").

**Response 200:**
```json
{
  "success": true,
  "overallScore": 78,
  "breakdown": {
    "overall": 78,
    "categories": {
      "age": { "score": 100, "detail": "1 year difference" },
      "location": { "score": 100, "detail": "Same city" },
      "lifestyle": { "score": 67, "detail": "Matching: diet, smoking habits" },
      "horoscope": { "score": 85, "detail": "Ashtakoot: 28/36 (Very Good) · Manglik: Compatible" },
      "community": { "score": 100, "detail": "Same religion & caste" }
    },
    "ashtakoot": { ... }
  }
}
```

---

### `GET /profile/:userId/horoscope-match`
🔒 Auth required. Full Vedic Ashtakoot Guna Milan (APP-055).

**Response 200:**
```json
{
  "success": true,
  "ashtakoot": {
    "totalScore": 29,
    "totalMax": 36,
    "rawOut36": 29,
    "percentageScore": 81,
    "interpretation": "Very Good",
    "hasNadiDosha": false,
    "hasBhakootDosha": false,
    "hasGanaDosha": false,
    "manglikCompatible": true,
    "manglikDetail": "No Manglik dosha",
    "gunas": {
      "varna":   { "score": 1, "max": 1, "name": "Varna",       "detail": "Spiritual compatibility" },
      "vashya":  { "score": 2, "max": 2, "name": "Vashya",      "detail": "Mutual attraction & control" },
      "tara":    { "score": 3, "max": 3, "name": "Tara",         "detail": "Birth star compatibility" },
      "yoni":    { "score": 2, "max": 4, "name": "Yoni",         "detail": "Physical & biological harmony" },
      "maitri":  { "score": 4, "max": 5, "name": "Graha Maitri", "detail": "Psychological compatibility" },
      "gana":    { "score": 6, "max": 6, "name": "Gana",         "detail": "Temperament compatibility" },
      "bhakoot": { "score": 7, "max": 7, "name": "Bhakoot",      "detail": "Love & health compatibility" },
      "nadi":    { "score": 0, "max": 8, "name": "Nadi",         "detail": "Health & progeny" }
    }
  },
  "manglikCompatible": true,
  "manglikDetail": "No Manglik dosha",
  "rashiScore": 80,
  "summary": "Guna Milan: 29/36 (Very Good). Excellent match for marriage."
}
```

Returns `ashtakoot: null` if either user's nakshatra is missing — `rashiScore` is populated from rashi fallback. Response also includes a `numerology` life-path block.

### `GET /profile/:userId/horoscope-match/pdf`
🔒 Auth + **premium**. Streams a downloadable **Kundli match-report PDF** (`Content-Type: application/pdf`) — Ashtakoot guna table, Manglik, numerology, summary. Generated by `utils/kundli.js` (pdfkit).

---

## 3. Search — `/search`

### `GET /search`
🔒 Auth required. Search profiles with filters. Rate: searchLimiter (30/min).

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `name` | string | Name search |
| `religion` | string | Filter by religion |
| `caste` | string | Filter by caste |
| `gotra` | string | Exclude this gotra |
| `motherTongue` | string | Filter by mother tongue |
| `minAge` / `maxAge` | int | Age range |
| `minHeight` / `maxHeight` | int | Height range (cm) |
| `city` | string | City filter |
| `state` | string | State filter |
| `maritalStatus` | string | `never_married\|divorced\|widowed` |
| `profession` | string | Profession filter |
| `minIncome` / `maxIncome` | int | Income range |
| `education` | string | Education level |
| `diet` | string | `vegetarian\|non-vegetarian\|vegan\|jain` |
| `smoking` / `drinking` | string | `never\|occasionally\|regularly` |
| `manglik` | string | `any\|manglik\|non_manglik` |
| `nri` | boolean | NRI filter |
| `onlineWithin` | int | Active within N days |
| `sortBy` | string | `compatibility\|newest\|active` |
| `cursor` | string | Pagination cursor (base64) |
| `limit` | int | 1–50, default 20 |

**Response 200:**
```json
{
  "success": true,
  "profiles": [ { ...ProfileSummary } ],
  "nextCursor": "base64string",
  "total": 847
}
```

---

### `GET /search/suggestions`
🔒 Auth required. AI-ranked daily suggestions (max 50).

**Query:** `?limit=10`

**Response 200:** `{ "success": true, "profiles": [ ...ProfileSummary ] }`

---

## 4. Match — `/match`

### `POST /match/:userId`
🔒 Auth required. Perform a match action. Rate: matchActionLimiter (60/min).

**Body:** `{ "action": "like"|"shortlist"|"pass" }`

**Response 200:**
```json
{
  "success": true,
  "action": "like",
  "isMutualMatch": true,
  "match": { "id": "uuid", ... }
}
```
`isMutualMatch: true` when both users have liked each other. Push notification sent to both.

---

### `GET /match/mutual`
🔒 Auth required. Get mutual matches (paginated).

**Query:** `?page=1&limit=20`

**Response 200:** `{ "success": true, "matches": [ ...ProfileSummary ], "total": 5 }`

---

### `GET /match/shortlist`
🔒 Auth required. Get shortlisted profiles.

---

### `GET /match/likes`
🔒 Auth + Premium required. Get profiles that liked you.

---

## 5. Chat — `/chat`

All chat routes require **Premium subscription** (basic_premium / premium_plus / vip).

### `GET /chat/conversations`
🔒 Auth + Premium. List conversations.

**Query:** `?page=1&limit=20`

**Response 200:**
```json
{
  "success": true,
  "conversations": [{
    "userId": "uuid",
    "profile": { ...ProfileSummary },
    "lastMessage": { "content": "...", "createdAt": "..." },
    "unreadCount": 3
  }]
}
```

---

### `GET /chat/messages/:userId`
🔒 Auth + Premium. Get paginated messages with a user.

**Query:** `?before=messageId&limit=30` (cursor-based, newest first)

**Response 200:** `{ "success": true, "messages": [ ...Message ], "hasMore": true }`

---

### `POST /chat/send` *(alias: `POST /chat/messages`)*
🔒 Auth + Premium. Send a message. Rate: messageLimiter (60/min).

**Body:** `{ "receiverId": "uuid", "content": "Hello!", "type": "text" }`

**Response 201:** `{ "success": true, "message": { ...Message } }`

Also emitted via Socket.io to both parties.

---

### `PUT /chat/messages/:messageId`
🔒 Auth + Premium. Edit own message (15-minute window).

**Body:** `{ "content": "Edited text" }`

---

### `DELETE /chat/messages/:messageId`
🔒 Auth + Premium. Delete message.

**Query:** `?deleteFor=me|both`

---

## 6. Subscription — `/subscription`

### `GET /subscription/plans`
**Public.** Get all plan details.

**Response 200:**
```json
{
  "success": true,
  "plans": [
    { "type": "free", "price": 0, "features": { "chatAccess": false, "contactUnlocks": 0 } },
    { "type": "basic_premium", "price": 1500, "duration": 15, "contactUnlocks": 5, "chatAccess": true },
    { "type": "premium_plus", "price": 3000, "duration": 30, "contactUnlocks": 10, "voiceCalls": true },
    { "type": "vip", "price": 7499, "duration": 90, "contactUnlocks": -1, "boost": true }
  ]
}
```

---

### `GET /subscription/my-subscription`
🔒 Auth required.

**Response 200:** `{ "success": true, "subscription": { "planType": "premium_plus", "endDate": "...", "status": "active" } }`

---

### `POST /subscription/create-order`
🔒 Auth required. Create Razorpay order. Rate: paymentLimiter (10/hr).

**Body:** `{ "planType": "premium_plus" }`

**Response 200:** `{ "success": true, "order": { "id": "order_xxx", "amount": 300000, "currency": "INR" } }`

---

### `POST /subscription/verify-payment`
🔒 Auth required. Verify Razorpay payment signature, activate plan.

**Body:**
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "hex_sig"
}
```

**Response 200:** `{ "success": true, "subscription": { ...Subscription } }`

---

### `POST /subscription/webhook`
**Public** (HMAC-SHA256 verified via `X-Razorpay-Signature` header). Razorpay webhook fallback for payment capture.

---

### `DELETE /subscription/current`
🔒 Auth required. Cancel active subscription.

---

### `GET /subscription/history`
🔒 Auth required. Paginated payment history.

---

### `GET /subscription/invoice/:subscriptionId`
🔒 Auth required. Download invoice PDF.

---

## 7. Verification — `/verification`

### `GET /verification/status`
🔒 Auth required. Get own verification tier status.

**Response 200:**
```json
{
  "success": true,
  "verifications": [
    { "tier": "mobile", "status": "approved" },
    { "tier": "id", "status": "pending" },
    { "tier": "education", "status": "not_submitted" },
    { "tier": "income", "status": "not_submitted" }
  ]
}
```

---

### `POST /verification/submit`
🔒 Auth required. Submit verification documents. `multipart/form-data`. Rate: uploadLimiter (20/hr).

**Form fields:** `tier` (id|education|income), `documentType` (aadhaar|pan|passport|degree|offer_letter|itr|salary_slip), `document` (file).

**Response 201:** `{ "success": true, "verification": { "id": "uuid", "tier": "id", "status": "pending" } }`

Admin notified of new submission.

---

### `POST /verification/selfie`
🔒 Auth required. Submit selfie liveness video (APP-052 stub). `multipart/form-data`, field `selfie`.

**Response 200:** `{ "success": true, "message": "Selfie submitted for review" }`

---

## 8. Notifications — `/notifications`

### `GET /notifications`
🔒 Auth required. Get notifications (paginated).

**Query:** `?page=1&limit=20`

**Response 200:**
```json
{
  "success": true,
  "notifications": [{
    "id": "uuid",
    "type": "new_match|new_message|interest_received|interest_accepted|profile_viewed|system|...",
    "title": "New Match!",
    "body": "You and Priya matched",
    "isRead": false,
    "relatedId": "uuid",
    "createdAt": "..."
  }],
  "total": 42
}
```

---

### `GET /notifications/unread-count`
🔒 Auth required. Get unread count for badge.

**Response 200:** `{ "success": true, "count": 7 }`

---

### `PUT /notifications/:id/read`
🔒 Auth required. Mark one notification read.

---

### `PUT /notifications/read-all`
🔒 Auth required. Mark all notifications read.

---

### `DELETE /notifications/:id`
🔒 Auth required. Delete a notification.

---

### `POST /notifications/fcm-token`
🔒 Auth required. Register FCM device token.

**Body:** `{ "token": "fcm_token_string", "platform": "ios"|"android" }`

---

### `DELETE /notifications/fcm-token`
🔒 Auth required. Deregister FCM token (call on logout).

---

## 9. Block & Report

### `POST /block/:userId`
🔒 Auth required. Block a user (bidirectional, immediate).

### `DELETE /block/:userId`
🔒 Auth required. Unblock.

### `GET /block`
🔒 Auth required. List blocked users.

### `POST /report/:userId`
🔒 Auth required. Report a user.

**Body:**
```json
{
  "reason": "fake_profile|harassment|spam|inappropriate_content|underage|other",
  "description": "Optional details (max 1000 chars)"
}
```

---

## 10. Calls — `/calls`

All call routes require **Premium+ subscription**.

### `GET /calls/agora-token`
🔒 Auth + Premium. Get Agora RTC token.

**Query:** `?channelName=user1_user2`

**Response 200:**
```json
{
  "success": true,
  "token": "agora_rtc_token",
  "channelName": "user1_user2",
  "uid": 12345,
  "isStub": false
}
```
Returns `isStub: true` with `token: "DEV_STUB_TOKEN"` when `AGORA_APP_ID`/`AGORA_APP_CERTIFICATE` not set.

---

### `POST /calls/initiate`
🔒 Auth + Premium. Log call start + emit `call-incoming` Socket.io event to callee.

**Body:** `{ "calleeId": "uuid", "callType": "voice"|"video", "channelName": "..." }`

**Response 201:** `{ "success": true, "call": { "id": "uuid", "channelName": "..." } }`

---

### `GET /calls/history`
🔒 Auth required. Paginated call history.

---

### `PUT /calls/:id/accept`
🔒 Auth required. Accept incoming call.

### `PUT /calls/:id/decline`
🔒 Auth required. Decline call (logs as declined).

### `PUT /calls/:id/end`
🔒 Auth required. End call (logs duration).

> **Web client:** in-browser voice/video implemented via `agora-rtc-sdk-ng` (`context/CallContext.jsx`, `components/calls/CallOverlay.jsx`). Requires `VITE_AGORA_APP_ID`; UI auto-hides when unset.

---

## 10b. Family Groups — `/groups`

🔒 All routes require auth. Every read/write is **membership-gated** (`GroupMember`) — non-members get `403 NOT_A_MEMBER`/`You are not a member of this group`. Models: Group / GroupMember / GroupMessage (migration 000039).

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/groups` | Create group `{ name, description?, candidateUserId? }`; creator becomes `owner`. |
| `GET` | `/groups` | List groups the caller belongs to (with `memberCount`, `myRole`). |
| `GET` | `/groups/:groupId` | Group detail + members. |
| `DELETE` | `/groups/:groupId` | Delete group (owner only; cascades members + messages). |
| `POST` | `/groups/:groupId/members` | Add member `{ userId }` or `{ phone }` (owner only; max 20). |
| `POST` | `/groups/:groupId/invite` | Alias of add-member (invite by `userId`/`phone`). |
| `DELETE` | `/groups/:groupId/leave` | Caller leaves (owner must delete/transfer first). |
| `DELETE` | `/groups/:groupId/members/:memberUserId` | Remove member (owner; or self). |
| `GET` | `/groups/:groupId/messages` | Newest-first, `?page&limit`; returns `{ messages, nextCursor, pagination }`. |
| `POST` | `/groups/:groupId/messages` | Post `{ content }`; broadcasts `group-message-received`. Rate: messageLimiter. |
| `PUT` | `/groups/:groupId/messages/:messageId` | Edit own message; broadcasts `group-message-edited`. |
| `DELETE` | `/groups/:groupId/messages/:messageId` | Delete own message (owner can delete any); broadcasts `group-message-deleted`. |

Message shape: `{ id, groupId, senderId, senderName, content, createdAt, editedAt }`.

---

## 11. Guardian Co-Pilot — `/guardian` (APP-054)

> **Dev note:** Uses in-memory store — data resets on server restart. Replace with DB migration before production.

### `GET /guardian/my-guardians`
🔒 Auth required. List guardians I've invited (candidate view).

**Response 200:** `{ "success": true, "guardians": [{ "guardianId": "uuid", "email": "...", "addedAt": "..." }] }`

---

### `POST /guardian/invite`
🔒 Auth required. Invite a guardian by email (max 3 total).

**Body:** `{ "email": "guardian@example.com" }`

**Response 200:** `{ "success": true, "message": "Guardian linked", "method": "direct"|"pending" }`

- `direct` — user already on platform, linked immediately + notified
- `pending` — user not on platform, invite stored for when they join

---

### `DELETE /guardian/:guardianId`
🔒 Auth required. Revoke guardian access.

---

### `GET /guardian/my-candidates`
🔒 Auth required. List candidates I have guardian access to.

**Response 200:** `{ "success": true, "candidates": [{ "candidateId": "uuid", "name": "...", "city": "..." }] }`

---

### `GET /guardian/candidate/:candidateId/matches`
🔒 Auth required. Read-only mutual matches for candidate. Returns 403 if not a guardian.

---

### `GET /guardian/candidate/:candidateId/shortlisted`
🔒 Auth required. Read-only shortlist for candidate. Returns 403 if not a guardian.

---

## 12. Astrologer Marketplace — `/astrologers` (APP-059)

> **Stub:** Returns hardcoded data. Real implementation requires Astrologer/Booking DB models.

### `GET /astrologers`
🔒 Auth required. List all astrologers.

**Response 200:**
```json
[{
  "id": "ast_1",
  "name": "Pt. Rajesh Sharma",
  "speciality": ["Kundli Matching", "Marriage Timing"],
  "experience": 18,
  "rating": 4.8,
  "reviewCount": 342,
  "pricePerMin": 25,
  "languages": ["Hindi", "Punjabi", "English"],
  "isOnline": true
}]
```

---

### `GET /astrologers/:id`
🔒 Auth required. Get one astrologer by ID.

---

### `POST /astrologers/book`
🔒 Auth required. Create a consultation booking.

**Body:** `{ "astrologerId": "ast_1", "scheduledAt": "2026-06-06T16:00:00Z", "durationMin": 30 }`

**Response 201:** `{ "id": "bk_...", "astrologerName": "...", "status": "pending", "amount": 750 }`

---

### `GET /astrologers/my-bookings`
🔒 Auth required. List own bookings.

---

## 13. Admin — `/admin`

All admin routes require **role: admin or super_admin**. Rate: adminLimiter (100/min).

### User Management
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/users` | List users (search, pagination) |
| `POST` | `/admin/users` | Create user |
| `GET` | `/admin/users/:userId` | Get user detail |
| `PUT` | `/admin/users/:userId/status` | Update user status (active/suspended/deleted) |
| `PUT` | `/admin/users/:userId/subscription` | Override subscription plan |

### Verification Queue
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/verifications` | List pending verifications |
| `PUT` | `/admin/verifications/:verificationId` | `{ status: "approved"\|"rejected", adminNotes?: "..." }` |

### Analytics & Revenue
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/analytics` | Signups, active users, conversion stats |
| `GET` | `/admin/revenue` | Revenue breakdown by plan |

### Reports Queue
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/reports` | List user reports |
| `PUT` | `/admin/reports/:reportId` | `{ status: "reviewed"\|"dismissed", adminNotes?: "..." }` |

### Invoices
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/invoice/:subscriptionId` | Admin view invoice |

### Marketing Users
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/marketing-users` | List marketing accounts |
| `POST` | `/admin/marketing-users` | Create marketing account |
| `PUT` | `/admin/marketing-users/:userId/status` | Toggle active/inactive |
| `GET` | `/admin/marketing-users/:userId/stats` | Performance stats |

### Referral Codes
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/referral-codes` | List codes |
| `POST` | `/admin/referral-codes` | Create code |
| `PUT` | `/admin/referral-codes/:id/toggle` | Enable/disable |

### Leads
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/leads` | List marketing leads |

---

## 14. Marketing — `/marketing`

Requires **role: marketing**. Internal marketing team dashboard.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/marketing/dashboard` | Overview stats |
| `GET` | `/marketing/leads` | Lead list |
| `PUT` | `/marketing/leads/:leadId/status` | Update lead status |
| `GET` | `/marketing/referral-codes` | Own referral codes |
| `POST` | `/marketing/referral-codes` | Create referral code |

---

## 15. Socket.io Events

**Connection:** `ws://localhost:5001` (proxied via Nginx in prod). Auth via `accessToken` cookie or `Authorization: Bearer` header.

On connect, user is automatically joined to `user_{userId}` room for notifications.

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `roomId: string` | Join 1:1 chat room (`userId1_room_userId2`, sorted). Requires mutual match + premium. |
| `leave-room` | `roomId: string` | Leave 1:1 chat room. |
| `send-message` | `{ roomId, message: Message }` | Broadcast a message (must be DB-persisted first via REST). |
| `typing` | `{ receiverId: string, isTyping: boolean }` | Typing indicator (gated on mutual match). |
| `message-edited` | `{ roomId, message: Message }` | Broadcast edit. |
| `message-deleted` | — | **Server-authoritative**: deletion is broadcast by the REST `DELETE /chat/messages/:id` handler after verifying ownership. The client-emitted `message-deleted` event is ignored (anti-spoof). |
| `get-online-status` | `userIds: string[]` (max 50) | Check online status. |
| `join-group` | `groupId: string` (or `{ groupId }`) | Join a family-group room. **Membership-gated**: rejects with `NOT_A_MEMBER` unless a `GroupMember` row exists. |
| `leave-group` | `groupId: string` | Leave the group room. |
| `group-send-message` | — | **Ignored (anti-spoof).** Group messages are created via REST `POST /groups/:id/messages`, which broadcasts server-authoritatively. |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `Message` | New 1:1 chat message. |
| `user_typing` | `{ userId, isTyping }` | Typing indicator from other user. |
| `message-edited` | `{ message }` | Message edited by other user. |
| `message-deleted` | `{ messageId }` | Message deleted. |
| `online-status` | `Record<userId, boolean>` | Online status map. |
| `new-match` | `{ match }` | Mutual match detected. |
| `new-notification` | `Notification` | Any new notification. |
| `call-incoming` | `{ callId, callerId, callType, channelName }` | Incoming call. |
| `call-accepted` | `{ callId }` | Callee accepted. |
| `call-declined` | `{ callId }` | Callee declined. |
| `call-ended` | `{ callId, duration }` | Call ended. |
| `group-message-received` | `{ id, groupId, senderId, senderName, content, createdAt, editedAt }` | New family-group message (flat shape; emitted by REST `POST /groups/:id/messages`). |
| `group-message-edited` | `{ groupId, messageId, content, editedAt }` | Group message edited. |
| `group-message-deleted` | `{ groupId, messageId }` | Group message deleted. |
| `error` | `{ code, message }` | Socket error. |

**Rate limits:** `send-message` 30/min · `typing` 60/min · `join-room` 20/min · `get-online-status` 30/min.

---

## Shared Types (reference)

Defined in `shared/src/types/`. Key types:

```typescript
// Profile (abbreviated)
interface Profile {
  id: string; userId: string;
  firstName: string; lastName: string;
  gender: 'male'|'female'|'other'; dateOfBirth: string;
  height: number; weight: number;
  city: string; state: string;
  religion: string; caste: string; gotra: string; motherTongue: string;
  manglikStatus: 'manglik'|'non_manglik'|'anshik_manglik'|'not_sure';
  rashi: string; nakshatra: string; placeOfBirth: string; birthTime: string;
  education: string; profession: string; income: number;
  diet: 'vegetarian'|'non-vegetarian'|'vegan'|'jain';
  bio: string; interestTags: string[];
  photos: string[]; voiceIntroUrl?: string;
  completionPercentage: number; authenticityScore: number;
  quizAnswers?: QuizAnswer[];
}

// Subscription plans
type SubscriptionPlanType = 'free'|'basic_premium'|'premium_plus'|'vip';

// Notification types
type NotificationType =
  | 'new_match' | 'new_message' | 'interest_received' | 'interest_accepted'
  | 'profile_viewed' | 'verification_approved' | 'verification_rejected'
  | 'subscription_expiring' | 'saved_search_alert' | 'system';

// Call types
type CallType = 'voice'|'video';
type CallStatus = 'initiated'|'accepted'|'declined'|'ended'|'missed';
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | ✅ | Backend port (default 5001) |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | ✅ | PostgreSQL connection |
| `JWT_SECRET` | ✅ | Access token signing key |
| `COOKIE_SECRET` | ✅ | Cookie signing key |
| `FRONTEND_URL` | ✅ | CORS allowed origin |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | ✅ | Photo/audio uploads |
| `RAZORPAY_KEY_ID/KEY_SECRET` | 🔴 | Payments (placeholder in dev) |
| `RAZORPAY_WEBHOOK_SECRET` | 🔴 | Webhook signature verification |
| `REDIS_URL` | 🟡 | Cache + rate limiting (in-memory fallback) |
| `SMTP_HOST/PORT/USER/PASSWORD` | 🟡 | Email delivery |
| `GOOGLE_CLIENT_ID` | 🟡 | Google OAuth |
| `AGORA_APP_ID/AGORA_APP_CERTIFICATE` | 🟡 | Video/voice calls (stub if missing) |
| `SMS_PROVIDER` | 🟡 | `fast2sms\|msg91\|dev` (default: dev) |
| `SMS_API_KEY` | 🟡 | Required when SMS_PROVIDER≠dev |
| `ADMIN_EMAIL/ADMIN_PASSWORD` | 🟡 | Seed admin credentials |

Legend: ✅ = required for any env · 🔴 = required for prod · 🟡 = optional/degraded without

---

## Migration History

| File | Description |
|------|-------------|
| `20240101000001` | Create users table |
| `20240101000002` | Create profiles table |
| `20240101000003` | Create subscriptions |
| `20240101000004` | Create matches |
| `20240101000005` | Create messages |
| `20240101000006` | Create verifications |
| `20240101000007` | Profile views |
| `20240101000008–022` | Enhanced fields, indexes, horoscope, privacy, notifications, blocks, reports, contact-unlocks, subscription-plans, sync-users, deleted-status, Google OAuth |
| `20240101000027` | Create call_sessions |
| `20240101000028` | Add quizAnswers + voiceIntroUrl to Profiles |
| *(pending)* | guardian_links table (replace in-memory store) |
| *(pending)* | astrologers + bookings tables |

---

*Document owner: Engineering — Globoniks Studio*  
*Updated automatically after each session. Next: Session 17 — production hardening.*
