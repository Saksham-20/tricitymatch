# TricityShadi Mobile App — Security & Access Control
**Version:** 1.0 | **Date:** June 2026

---

## 1. Overview

Security for the mobile app is enforced at three layers:
1. **Backend (API):** All authorization decisions happen server-side. The mobile app is an untrusted client.
2. **Transport:** All traffic over HTTPS/TLS. No HTTP fallback.
3. **Device:** Sensitive data stored in OS-secured enclaves (Keychain / Keystore), never in plaintext on disk.

The mobile app never stores user role, subscription plan, or feature flags locally in a way that unlocks features. Every protected action is re-validated by the backend on each request.

---

## 2. Authentication

### 2.1 Token Architecture (Existing, Unchanged)

The existing JWT httpOnly cookie system runs unchanged on the web. The mobile app uses the same backend tokens but via Authorization header (since mobile cannot reliably use httpOnly cookies across platforms):

| Token | Storage (Mobile) | TTL | Refresh |
|-------|-----------------|-----|---------|
| Access Token | Memory (Zustand store) | 15 min | Auto via interceptor |
| Refresh Token | expo-secure-store (Keychain/Keystore) | 7 days | POST /auth/refresh-token |

**Why not httpOnly cookies on mobile:** React Native's `withCredentials` works on Android but is unreliable on iOS with WKWebView-based fetch. The mobile app sends `Authorization: Bearer {accessToken}` header on every request instead.

**Token flow:**
```
Login → Backend returns { accessToken, refreshToken }
      → accessToken stored in Zustand (memory only, wiped on app restart)
      → refreshToken stored in expo-secure-store (persists across restarts)

On app restart:
      → No accessToken in memory
      → Axios interceptor detects 401
      → Reads refreshToken from secure-store
      → Calls POST /auth/refresh-token
      → Stores new accessToken in memory
      → Retries original request

On logout:
      → DELETE /auth/device-token (removes FCM token)
      → POST /auth/logout (revokes refresh token in DB)
      → expo-secure-store.deleteItemAsync('refreshToken')
      → Zustand store cleared
      → Navigate to Login
```

### 2.2 Biometric Login

Biometric is a UX convenience layer on top of the token system — it does NOT replace password-based authentication. It only auto-fills the refresh-token flow.

```
User enables biometric in Settings
    → App checks expo-local-authentication.hasHardwareAsync()
    → Stores preference flag in MMKV: biometric_enabled = true
    → No new keys are generated (refresh token in secure-store is the credential)

Next app open:
    → MMKV biometric_enabled === true
    → Prompt Face ID / Fingerprint
    → On success → read refreshToken from secure-store → call /auth/refresh-token
    → On failure (3 attempts) → clear biometric_enabled flag → prompt password
```

**Biometric does not work if:**
- Device has no biometric hardware
- User has not enrolled biometrics on device
- Refresh token has expired (7 days inactive) → full re-login required

### 2.3 Account Lockout (Backend, Unchanged)

5 failed login attempts → 30-min lockout via Redis. Mobile app receives `429 Too Many Requests` with `Retry-After` header and shows countdown timer.

### 2.4 Google OAuth (Mobile)

Uses `@react-native-google-signin/google-signin`. ID token sent to `POST /auth/google`. Backend validates with Google's public keys. Same endpoint as web.

---

## 3. Role-Based Access Control (RBAC)

### 3.1 Roles

| Role | Description | Set By |
|------|-------------|--------|
| `user` | Standard registered user | Default on signup |
| `admin` | Platform administrator | Manual DB update or admin seeder |
| `bureau` | Marriage bureau / B2B partner | Admin grants via dashboard |

Role is stored in the `users` table. The mobile app reads role from `/auth/me` response and conditionally renders Admin or Bureau tab.

**Critical:** Role-gated API routes check `req.user.role` server-side on every request. The mobile app rendering a tab is cosmetic only — the backend enforces the actual restriction.

### 3.2 Plan-Based Feature Gates

| Feature | Free | Plus | Premium | Elite |
|---------|------|------|---------|-------|
| Browse profiles | ✓ | ✓ | ✓ | ✓ |
| Send interests | 5 total | ∞ | ∞ | ∞ |
| View who liked me | ✗ | ✓ | ✓ | ✓ |
| Chat | ✗ | ✓ | ✓ | ✓ |
| Contact unlock | 0 | 5/mo | 10/mo | ∞ |
| Voice/video calls | ✗ | ✗ | ✓ | ✓ |
| Advanced filters | ✗ | ✗ | ✓ | ✓ |
| Profile boost | ✗ | ✗ | ✗ | ✓ |

**Gate enforcement pattern (backend middleware):**
```javascript
// middleware/planGate.js
const requirePlan = (...plans) => (req, res, next) => {
  const userPlan = req.user.subscriptionPlan; // from JWT claims
  if (!plans.includes(userPlan)) {
    return res.status(403).json({ error: 'UPGRADE_REQUIRED', requiredPlans: plans });
  }
  next();
};
// Usage: router.get('/chat/:userId', auth, requirePlan('plus','premium','elite'), chatCtrl.getThread)
```

**Gate enforcement pattern (mobile UI):**
```typescript
// hooks/useFeatureGate.ts
const useFeatureGate = (requiredPlans: Plan[]) => {
  const plan = useAuthStore(s => s.user?.subscriptionPlan);
  const isAllowed = requiredPlans.includes(plan);
  const showUpgradeModal = useUIStore(s => s.showUpgradeModal);
  
  const checkGate = () => {
    if (!isAllowed) showUpgradeModal(requiredPlans);
    return isAllowed;
  };
  return { isAllowed, checkGate };
};
// Usage: const { checkGate } = useFeatureGate(['plus','premium','elite']);
// onPress={() => checkGate() && navigateToChat()}
```

---

## 4. Data Privacy & Photo Protection

### 4.1 Photo Access Rules

| Viewer's relation to profile | Photo visibility |
|------------------------------|-----------------|
| Mutual match | Full, unwatermarked |
| Shortlisted by profile owner (accepted interest) | Full, unwatermarked |
| Premium+ with no match | Thumbnail only, watermarked |
| Free / Plus, no match | Blurred, watermarked |
| Profile owner | Full, no watermark |
| Blocked by profile owner | Not accessible at all |

**Watermark implementation:** Applied by Cloudinary URL transformation on the CDN, not in the app. The app requests the appropriately transformed URL from the backend based on the viewer's match status. The raw Cloudinary URL is never exposed to the client.

```javascript
// backend: generate appropriate Cloudinary URL
const getPhotoUrl = (photo, viewerRelation) => {
  const base = photo.cloudinaryPublicId;
  if (viewerRelation === 'mutual') {
    return cloudinary.url(base, { width: 800, crop: 'fill', quality: 'auto' });
  }
  if (viewerRelation === 'blurred') {
    return cloudinary.url(base, { 
      width: 400, effect: 'blur:800', 
      overlay: { text: 'TricityShadi', font_size: 20 }
    });
  }
  // watermarked only
  return cloudinary.url(base, { 
    width: 400, 
    overlay: { text: 'TricityShadi | @{username}', font_size: 16, opacity: 60 }
  });
};
```

### 4.2 Privacy Controls

| Control | What it does | API |
|---------|-------------|-----|
| Incognito Mode | Profile excluded from all search results | PATCH /profile/me { incognito: true } |
| Photo Privacy | Who can see unblurred photos | PATCH /profile/me { photoPrivacy: 'all' | 'shortlisted' | 'matched' } |
| Contact Privacy | Who can send contact unlock request | PATCH /profile/me { contactPrivacy: 'all' | 'matched' } |
| Block User | Bidirectional removal from all surfaces | POST /block/:userId |
| Delete Account | Soft delete → 30-day timer → purge | DELETE /auth/account |

### 4.3 Contact Number Protection

Phone numbers are **never** included in profile API responses by default. They are only returned:
1. When the viewer has successfully used a Contact Unlock (deducting from quota)
2. The unlocked record is stored in `contact_unlocks` table (existing)
3. The unlock is checked server-side on every request — not cached client-side

### 4.4 DPDP Act Compliance (India)

- Users can request their data export: `POST /account/data-export`
- Backend generates a ZIP of all user data and emails it within 72 hours
- Users can delete their account and have data purged after 30-day retention window
- Data retained after deletion: anonymized analytics aggregates only (no PII)

---

## 5. Device & On-Device Security

### 5.1 Secure Storage

| Data | Storage | Why |
|------|---------|-----|
| Refresh token | expo-secure-store (Keychain/Keystore) | OS-level hardware encryption |
| Biometric preference | MMKV | Non-sensitive preference flag |
| User profile cache | MMKV | Non-sensitive, convenience cache |
| Photos cache | react-native-fast-image cache dir | Standard app cache, cleared on uninstall |
| Access token | Zustand store (memory only) | Short-lived, never persisted to disk |
| Agora token | Memory (call state) | Ephemeral, 1-hour TTL |

**Never stored:**
- Passwords (not even hashed — backend only)
- Credit card details (Razorpay handles, never touches our systems)
- Other users' phone numbers in plaintext cache

### 5.2 Certificate Pinning

For production, implement SSL certificate pinning to prevent MITM attacks:
- Library: `react-native-ssl-pinning` or via OkHttp (Android) + TrustKit (iOS)
- Pin the production API domain cert SHA-256 hash
- Include backup pin for cert rotation scenarios

```javascript
// api/client.ts (with pinning)
import { fetch } from 'react-native-ssl-pinning';
// Replace axios for critical auth endpoints only
// Regular data fetches can remain on axios
```

### 5.3 Jailbreak / Root Detection

For a matrimonial app handling sensitive personal data, detect compromised devices:
- Library: `expo-device` + `react-native-jail-monkey`
- On jailbreak/root detection: show warning dialog, do not block (users may be developers), log to analytics

### 5.4 Screenshot Prevention (Optional)

- iOS: `FLAG_SECURE` equivalent — use `react-native-prevent-screenshot` on sensitive screens (profile with personal details, chat)
- Android: `FLAG_SECURE` on the Activity prevents screenshots and app switcher thumbnails
- Apply only on: ChatThreadScreen, OwnProfileScreen (phone number section), ContactUnlockScreen

---

## 6. Transport Security

- All API traffic: HTTPS/TLS 1.2+ (enforced by Nginx, existing)
- Agora calls: encrypted end-to-end by Agora SDK (AES-128 by default; AES-256 for premium if configured)
- Socket.io: WSS (WebSocket Secure) — enforced by Nginx config (existing)
- FCM: Google-managed TLS
- Image CDN (Cloudinary): HTTPS only, signed URLs for private photos

**Nginx security headers (existing config, verify these are present):**
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header Referrer-Policy strict-origin-when-cross-origin;
```

---

## 7. API Rate Limiting (Mobile Clients)

The existing 11 rate limiters apply to mobile clients equally. Mobile-specific considerations:

| Issue | Mitigation |
|-------|-----------|
| Shared IP (carrier NAT) | Rate limit by user ID (authenticated routes) not IP only |
| Aggressive retry on poor network | Axios retry with exponential backoff: 3 retries, 1s/2s/4s delays |
| Background sync flooding | React Query `staleTime` prevents unnecessary refetches |
| Call token fetching | Agora token rate limited: 10/hr (same as payment endpoints) |

---

## 8. Fraud & Abuse Prevention

### 8.1 Fake Profile Detection (AI Screening)

**Photo screening (on upload):**
- Reverse image lookup: compare uploaded photo against known stock photo hashes
- Face detection: ensure at least one face is present in profile photo
- Duplicate face detection: flag if same face already exists on another account
- Result: flag for admin review queue (not auto-ban)

**Behavioral signals:**
- New account sends identical copy-paste messages to 10+ users within 1 hour → flagged
- Profile bio contains phone number, email, or WhatsApp → auto-stripped + flagged
- Rapid account creation from same device ID → flagged for review

**Implementation approach (v1 — rule-based, no separate ML service):**
```javascript
// backend/utils/fraudDetection.js
const screenProfile = async (userId, photoUrl) => {
  const flags = [];
  // Check bio for contact info
  const profile = await Profile.findOne({ where: { userId } });
  if (/\b[6-9]\d{9}\b/.test(profile.bio)) flags.push('phone_in_bio');
  if (/[a-zA-Z0-9.]+@[a-zA-Z]+\.[a-zA-Z]{2,}/.test(profile.bio)) flags.push('email_in_bio');
  
  if (flags.length) {
    await AdminAlert.create({ userId, flags, type: 'fraud_signal' });
    // Auto-strip contact info from bio
    await profile.update({ bio: profile.bio.replace(contactRegex, '[removed]') });
  }
};
```

**Full ML-based detection is a v2 feature.**

### 8.2 Reporting System

User reports flow:
1. User taps Report on a profile
2. Selects category: Fake Profile / Harassment / Wrong Info / Spam / Other
3. Optional: attach screenshot (camera capture in-app)
4. Backend creates `reports` record + notifies admin via push + email
5. Admin reviews in moderation queue (web dashboard or mobile admin tab)
6. Actions: Warn user / Suspend 7 days / Permanent ban / Dismiss

### 8.3 Verification-Based Trust Signals

Verified profiles (ID + Education) are shown with badges. Search results can be filtered to show verified-only. This creates natural incentive for legitimate users to verify and disincentivizes fake accounts (verification requires real documents).

---

## 9. Razorpay Payment Security

- Razorpay SDK runs in its own native view — card details never touch our code
- Payment signature verification: `crypto.timingSafeEqual(hmac, signature)` on backend (existing)
- Webhook endpoint: raw body captured before JSON parsing (existing, verified)
- Mobile adds no new payment surface — same Razorpay flow as web, adapted for RN SDK

---

## 10. Access Control Matrix

| Action | Free | Plus | Premium | Elite | Bureau | Admin |
|--------|------|------|---------|-------|--------|-------|
| View own profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View other profiles | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Send interest | 5 max | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chat | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Voice/Video call | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| View who liked me | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Unlock contact | 0 | 5/mo | 10/mo | ∞ | 5/mo | ✓ |
| Advanced filters | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| Profile boost | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Bureau console | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Admin panel | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Approve verification | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| View all users | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Override subscription | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

*Document owner: Engineering / Security — Globoniks Studio*
