# TricityShadi Mobile App — Product Requirements Document (PRD)
**Version:** 1.0 | **Date:** June 2026 | **Status:** Final for v1 Build

---

## 1. Executive Summary

TricityShadi is a working matrimonial web platform serving Chandigarh, Mohali, and Panchkula, built on React + Express.js + PostgreSQL. This PRD defines requirements for the **iOS + Android mobile app** built in React Native, sharing the same backend and database as the web.

The app is not a rebuild — it is a new client layer. All user data, profiles, matches, and messages are shared in real time between the web and the app. The mobile app adds what the web cannot deliver well: push notifications, biometric login, in-app voice/video calls (Agora), offline shortlist viewing, and native UX patterns.

**Platform decision:** React Native (bare Expo) — iOS + Android simultaneous launch.  
**Backend decision:** Existing Express.js + PostgreSQL — unified, no fork, no duplication.  
**Voice/Video:** Agora RTC SDK.

---

## 2. Problem Statement

- ~80% of Indian matrimonial searches happen on mobile. TricityShadi has no app.
- The existing web PWA has no push notifications (FCM stub never implemented), making re-engagement impossible.
- Key differentiators — voice/video calls without number sharing, biometric login, family mode — cannot be delivered well in a mobile browser.
- Competitors (Shaadi.com, Jeevansathi, BharatMatrimony) have polished native apps with millions of downloads.

---

## 3. Goals & Success Metrics

### 90-Day Post-Launch Targets

| Metric | Target |
|--------|--------|
| App downloads | 5,000+ |
| DAU / MAU ratio | ≥ 25% |
| Profile completion rate | ≥ 70% |
| Free → Paid conversion | ≥ 8% |
| Push notification opt-in rate | ≥ 60% |
| Average session length | ≥ 6 min |
| App Store / Play Store rating | ≥ 4.2 ★ |
| Crash-free session rate | ≥ 99.2% |
| Voice/video call completion rate | ≥ 70% |

---

## 4. User Personas

Sourced from Globoniks flow document and existing platform user data.

### 4.1 The Candidate (Self)
- **Age:** 24–35, tech-comfortable
- **Goal:** Find a match privately, efficiently, on their own terms
- **Behaviour:** Browses during commute/evening; wants quick swipe UX, fast chat, no number-sharing
- **Key needs:** Privacy controls, quality filters, smooth chat + video without exposing phone number

### 4.2 The Parent / Guardian
- **Age:** 45–60, variable tech comfort
- **Goal:** Find a suitable match for son/daughter; conduct family-to-family introductions
- **Behaviour:** Cautious, verification-focused, prefers phone calls over chat
- **Key needs:** Elder Mode UI (large fonts, simple nav), family sharing, trust badges, family-to-family intro mode

### 4.3 The NRI / NRI Family
- **Age:** 28–45, based in USA / Canada / UK / Gulf
- **Goal:** Find a match in the home community (often Punjabi Khatri, Arora, Jatt)
- **Behaviour:** High willingness to pay, time-zone-constrained, needs video calls + strong verification
- **Key needs:** NRI country filter, time-zone-aware video scheduling, Elite Assisted tier, strong verification

### 4.4 The Marriage Bureau (B2B)
- **Profile:** Professional matchmaker with a roster of client profiles
- **Goal:** Propose matches between their clients and platform users, earn commission
- **Behaviour:** Bulk-management, needs a console not a dating-style UX
- **Key needs:** Bureau console, client roster upload, match proposal workflow, commission tracking

---

## 5. User Journey Summary

```
INSTALL
  └── Onboarding (self or on behalf of family)
        └── 14-Step Profile Build
              └── Mobile OTP Verification
                    └── HOME FEED (Daily Curated Matches)
                          ├── [Free]     Browse + 5 Interests → Upgrade wall at Chat/Contact
                          ├── [Plus]     Unlimited Interests + Chat + Contact View
                          ├── [Premium]  Plus + Voice/Video Calls + Advanced Filters + Boost
                          ├── [Elite]    Relationship Manager + Hand-picked + Background Check
                          └── [Bureau]   Console → Client Roster → Match Proposals → Commission
```

---

## 6. Feature Requirements — Must-Have (v1.0)

---

### F-01 · Onboarding & Registration

**Goal:** Get users to a complete, verified profile in one guided session with low drop-off.

**Requirements:**

- Screen 0: "Who are you registering for?" — Self / Son / Daughter / Sibling / Relative / Friend. Selection changes pronouns and copy throughout.
- Google Sign-In button (pulls name + email; profile build still required).
- Email + password fallback.
- 14-step profile wizard (one topic per screen, progress bar visible):

| Step | Topic | Key Fields |
|------|-------|-----------|
| 1 | Basic Info | Full name, DOB, gender, height, weight |
| 2 | Community | Religion, caste, sub-caste, gotra, mother tongue |
| 3 | Manglik & Kundli | Manglik status, kundli upload (image/PDF), manual birth details |
| 4 | Education | Highest qualification, field of study, institution |
| 5 | Career | Profession, employer/company, income range |
| 6 | Location | Current city, home state, NRI toggle → country + visa/PR status |
| 7 | Marital Status | Never Married / Divorced / Widowed / Annulled; children (Y/N/N-count) |
| 8 | Lifestyle | Diet, drinking, smoking, exercise habits |
| 9 | Family Details | Father/mother occupation, no. of siblings, family type, family values |
| 10 | About Me | Free-text bio (max 500 chars), interest tags (multi-select) |
| 11 | Partner Preferences | Age range, height, education, profession, income, community, location, diet, manglik preference |
| 12 | Photos | Upload 1–6 photos (camera or gallery); face-mask toggle per photo; first photo = profile photo |
| 13 | Mobile Verify | OTP to mobile number (mandatory before proceeding) |
| 14 | Done + Next Steps | Prompt for ID verification, explanation of verification tiers |

- Skip-and-complete-later allowed on Steps 8–11 (non-critical).
- Profile completeness meter shown throughout and on profile home.
- Re-entry: if user exits mid-wizard, resume from last completed step.

**Acceptance Criteria:**
- [ ] User can complete full 14-step flow in < 8 minutes
- [ ] Skipped steps are clearly flagged as incomplete on profile
- [ ] OTP step blocks progression until verified
- [ ] Google OAuth pre-fills name + email on Step 1
- [ ] "Registering for" selection correctly updates all copy

---

### F-02 · Profile

**Goal:** A rich, trustworthy, attractive profile that conveys personality and community context.

**Requirements:**

- Profile view (own and others') with all structured fields from onboarding
- Profile photo gallery:
  - Photo blur for users who are not mutual matches and not Premium+
  - Watermark overlay (username + platform name) on all photos for non-mutual viewers
  - No in-app download button (photos are not downloadable via app UI)
- Verification badge row: Mobile ✓ | ID ✓ | Education ✓ | Income ✓ (shows earned badges only)
- Profile Authenticity Score (0–100) computed server-side: verification tier + completeness + activity signals
- Compatibility score shown on all other-user profile views
- "Interested" / "Shortlist" / "Pass" action bar on other-user profile
- "Send Interest" / "Accept" / "Decline" for incoming interests
- Profile views count (visible to profile owner)
- "Who viewed me" list (Plus+)
- Edit profile: tap any section to edit inline; save triggers API PUT
- Horoscope/Kundli section: view/upload kundli document

**Acceptance Criteria:**
- [ ] Photos are blurred for non-premium, non-mutual viewers
- [ ] Watermark renders on top of photos for non-mutual viewers
- [ ] Authenticity score displays correctly with tier breakdown tooltip
- [ ] Edit saves persist on both app and web without page reload

---

### F-03 · Search & Filters

**Goal:** Let users find highly specific matches using community, cultural, and lifestyle filters.

**Filter Fields:**

| Category | Fields |
|----------|--------|
| Community | Religion, caste, sub-caste, gotra (include/exclude list) |
| Demographics | Age range, height range, marital status |
| Location | City, state, NRI country, home state |
| Education & Career | Education level, profession category, income range |
| Lifestyle | Diet, drinking, smoking |
| Cultural | Mother tongue, manglik (any / manglik only / non-manglik only) |
| Activity | Recently active (last 7 / 30 days) |

**Requirements:**
- Filter panel as bottom sheet (swipe up)
- Apply / Reset buttons
- Save up to 3 filter sets (Plus: 3, Premium+: unlimited)
- Saved searches trigger push notifications on new matches
- Reverse matching toggle: "Show profiles I match for" (flips the filter logic)
- Results card shows: profile photo, name (first name + last initial), age, city, profession, compatibility score
- Infinite scroll with cursor-based pagination (20 per page)
- Sort: Compatibility ↓ | Newest | Recently Active
- Daily Curated Matches section on Home (top, max 10 cards, AI-ranked, refreshed daily at midnight)

**Acceptance Criteria:**
- [ ] Gotra exclusion removes same-gotra results entirely
- [ ] Saved searches persist between sessions
- [ ] Reverse matching returns correct inverse results
- [ ] Scroll loads next page without visible jank
- [ ] Daily curated feed refreshes at midnight IST

---

### F-04 · Match Actions

**Goal:** Simple, fast swipe/tap actions with clear mutual-match detection.

**Requirements:**
- Cards support swipe-right (Like), swipe-left (Pass), swipe-up (Shortlist)
- Tap-to-open full profile; action buttons also shown on full profile view
- Mutual match: when both users have liked each other → celebration animation + push notification to both
- "Liked Me" tab: list of users who sent interest (Plus+; blurred/locked for Free with upgrade prompt)
- "Shortlisted" tab: viewable offline (cached)
- Express Interest: sends a push notification + in-app notification to recipient
- Interest status: Pending / Accepted / Declined visible to sender
- Pass action: soft pass (no notification to other user), removable from pass list within 24h

**Acceptance Criteria:**
- [ ] Swipe gestures register correctly on both iOS and Android
- [ ] Mutual match animation triggers within 1s of detection
- [ ] Shortlisted profiles load from cache with no internet
- [ ] Free users see "Liked Me" list blurred with upgrade prompt overlay

---

### F-05 · Communication

**Goal:** Rich communication tools that protect privacy (no number sharing until user chooses).

#### 5a · In-App Chat (Plus+)
- Chat available only between users with mutual interest (at least one accepted interest)
- Text messages with: read receipts (double tick), typing indicator, 15-min edit window, delete-for-me / delete-for-both
- Contact unlock: within chat, Premium+ users can use a "Request Contact" button that deducts from their monthly quota and reveals phone number if recipient approves
- Message list: infinite scroll upward, grouped by date
- Unread count badge on tab icon

#### 5b · Voice Calls (Premium+, Agora RTC)
- Initiated from chat thread ("Call" button) or profile page
- Agora channel name = deterministic hash of sorted user ID pair
- Agora token fetched from backend before call start
- In-call screen: mute, speaker toggle, end call
- Incoming call: VoIP push notification (CallKit on iOS, ConnectionService on Android)
- Call history tab in communications screen
- No phone number ever shared via this flow

#### 5c · Video Calls (Premium+, Agora RTC)
- Same as voice with camera toggle added
- Front/rear camera switch
- Blur background option (Agora virtual background if SDK supports)
- Call quality indicator (signal bars)

#### 5d · Family-to-Family Introduction Mode
- User can designate a "family contact" (name + phone/email) in settings
- When enabled on their profile, inbound Introduction Requests are routed to family contact (email notification) not to in-app chat
- Sending user sees "Family Introduction Mode — your request will be forwarded to their family"

**Acceptance Criteria:**
- [ ] Chat is not accessible unless mutual interest exists
- [ ] Agora call connects in < 5 seconds on 4G
- [ ] Incoming call triggers native call UI (not just an app notification)
- [ ] Contact unlock deducts from quota and is reversible by admin only
- [ ] Family introduction email fires within 60 seconds

---

### F-06 · Verification & Trust

**Goal:** Build user trust through a tiered, admin-reviewed verification system with visible badges.

**Verification Tiers:**

| Tier | Name | What User Submits | Admin Action | Badge |
|------|------|-------------------|--------------|-------|
| 1 | Mobile Verified | OTP to phone | Auto-approved | ✓ Mobile |
| 2 | ID Verified | Aadhaar or PAN photo | Manual review (admin) | ✓ ID |
| 3 | Education/Employment | Degree certificate or offer letter | Manual review | ✓ Education |
| 4 | Income Verified | ITR acknowledgement or salary slip | Manual review | ✓ Income |

**Profile Authenticity Score (0–100):**
- Mobile verified: +20
- Profile completeness ≥ 80%: +20
- ID verified: +20
- Education verified: +15
- Income verified: +15
- 1+ real-looking profile photo (AI signal): +10

**AI Fraud Detection (backend):**
- Reverse image search check on uploaded profile photos (flag if stock photo match)
- Duplicate account detection (same device ID or same Aadhaar hash)
- Scam pattern detection (contact info in profile bio, rapid message templating)
- All flags go to admin moderation queue; user is not auto-banned

**Photo Controls:**
- All photos served via Cloudinary CDN with URL-signed tokens (time-limited)
- Watermark applied server-side for non-mutual views
- In-app share/screenshot: no technical block (OS-level prevention unreliable), but watermark ensures attribution

**Acceptance Criteria:**
- [ ] All four verification tiers are submittable from in-app
- [ ] Admin receives push/email notification for each new submission
- [ ] Authenticity score recalculates within 5 min of verification approval
- [ ] Flagged accounts appear in admin moderation queue within 2 min

---

### F-07 · Subscription & Payments

**Goal:** Frictionless upgrade with Razorpay; consistent plan state across web and app.

**Plan Matrix:**

| Feature | Free | Plus (₹1,500/15d) | Premium (₹3,000/30d) | Elite (₹7,499/90d) |
|---------|------|-------------------|----------------------|---------------------|
| Browse profiles | ✓ | ✓ | ✓ | ✓ |
| Send interests | 5 total | Unlimited | Unlimited | Unlimited |
| Chat | ✗ | ✓ | ✓ | ✓ |
| Who liked me | ✗ | ✓ | ✓ | ✓ |
| Contact unlock | 0 | 5/month | 10/month | Unlimited |
| Voice/Video calls | ✗ | ✗ | ✓ | ✓ |
| Advanced filters | Basic | Basic | Full | Full |
| Profile boost | ✗ | ✗ | ✗ | ✓ |
| Relationship manager | ✗ | ✗ | ✗ | ✓ |

**Requirements:**
- Upgrade prompts appear contextually at feature gates (chat, who liked me, calls)
- Razorpay payment sheet opens within the app (not browser)
- Payment methods: UPI, Google Pay, Debit/Credit Card, NetBanking
- On payment success: plan activates immediately, UI refreshes, push notification sent
- Subscription status shown in Settings and as a banner on profile
- Invoice downloadable as PDF from subscription history
- Elite Assisted: payment unlocks an onboarding form; relationship manager contacts within 24h (manual process)
- Subscription state is source of truth from backend — no client-side plan spoofing

**Acceptance Criteria:**
- [ ] Razorpay sheet opens within 2s of tapping "Upgrade"
- [ ] Plan activates within 5s of Razorpay webhook receipt
- [ ] Invoice PDF is downloadable from app
- [ ] Plan state is identical on web and app for same account

---

### F-08 · Push Notifications

**Goal:** Re-engage users with timely, relevant, user-controllable notifications.

**Notification Types & Triggers:**

| Notification | Trigger | Priority |
|---|---|---|
| New mutual match | Both users liked each other | High |
| Interest received | Someone sent you an interest | High |
| Interest accepted | Recipient accepted your interest | High |
| New message | Chat message received (app in background) | High |
| Incoming call | Voice/video call initiated | Critical (VoIP) |
| Profile viewed | Someone viewed your profile (Plus+) | Medium |
| Daily match digest | Midnight IST — new curated matches | Low |
| Subscription expiring | 3 days + 1 day before expiry | Medium |
| Verification approved | Admin approved a verification tier | Medium |
| Verification rejected | Admin rejected with reason | Medium |
| Saved search alert | New profile matches a saved search | Medium |

**Implementation:**
- Android: FCM (Firebase Cloud Messaging)
- iOS: APNs via Firebase Admin SDK
- Incoming call: VoIP push (PushKit on iOS, high-priority FCM on Android)
- Device token registered at login, refreshed on token rotation, deleted on logout
- User controls: per-category on/off toggle in Notification Settings screen

**Acceptance Criteria:**
- [ ] Notification delivered within 10s of trigger event
- [ ] VoIP notification presents native call UI on locked screen (both platforms)
- [ ] User can disable any notification category without disabling all
- [ ] Device token is deleted from backend on logout

---

### F-09 · Privacy & Account Controls

**Requirements:**
- **Incognito Mode:** Hide profile from all search results (profile still accessible via direct link to mutual matches)
- **Photo Privacy:** All | Shortlisted only | Mutual matches only
- **Contact Privacy:** Control who can request contact unlock
- **Block User:** Removes from all search results, prevents any communication, hides both profiles from each other
- **Report User:** Categories — Fake profile / Harassment / Incorrect information / Spam / Other. Report goes to admin queue with evidence capture (screenshot prompt)
- **Delete Account:** Soft delete (data retained 30 days for legal, then purged). User sees clear "your data will be permanently deleted in 30 days" message.
- **Download My Data:** DPDP Act compliance — generate and email a ZIP of user's own data within 72h

**Acceptance Criteria:**
- [ ] Incognito mode hides profile from search within 60s of toggle
- [ ] Block is bidirectional and immediate
- [ ] Report triggers admin queue entry within 60s
- [ ] Account deletion triggers 30-day retention timer with confirmation email

---

### F-10 · Multilingual UI + Elder Mode

**Languages:** English, Hindi (हिंदी), Punjabi (ਪੰਜਾਬੀ)

**Requirements:**
- Language picker in Onboarding Step 0 and in Settings
- Language change applies immediately (no restart required)
- All UI strings, error messages, notifications, and email templates available in all 3 languages
- i18n library: i18next + react-i18next
- Translation strings stored in `/src/i18n/en.json`, `hi.json`, `pa.json`

**Elder Mode:**
- Toggled in Settings → Accessibility → Elder Mode
- Font scale: minimum 18sp across all text (vs default 14sp)
- Bottom navigation simplified to 4 tabs: Home | Search | Matches | Profile
- Tap target minimum: 60dp × 60dp (vs standard 48dp)
- Animations reduced (respects system "Reduce Motion" setting)
- Contrast: higher-contrast text on all backgrounds

**Acceptance Criteria:**
- [ ] Language switch renders all strings (no English fallbacks visible in Hindi/Punjabi mode)
- [ ] Elder Mode increases all font sizes by minimum 4sp
- [ ] Elder Mode bottom nav shows exactly 4 tabs

---

### F-11 · Biometric Login

**Requirements:**
- Face ID (iOS) / Fingerprint / Face Unlock (Android) offered after first successful login
- Biometric preference stored locally in MMKV (never synced to server)
- On biometric success: app uses stored refresh token (Keychain/Keystore) to get new access token silently
- Fallback: if biometric fails 3 times → prompt for password
- Biometric can be disabled in Settings → Security

**Acceptance Criteria:**
- [ ] Biometric login completes in < 1.5s
- [ ] Refresh token stored in iOS Keychain / Android Keystore (not AsyncStorage)
- [ ] 3 failed biometric attempts → password screen
- [ ] Disabling biometric from settings removes stored keys

---

### F-12 · Offline Shortlist Viewing

**Requirements:**
- All shortlisted profiles cached locally using MMKV + react-native-fast-image cache
- Offline mode: user can open the Shortlisted tab with no internet and see full profile cards
- Profile photos cached at thumbnail resolution (≤ 100KB)
- "Last synced: [time]" label shown when offline
- Auto-sync on reconnection (background sync via React Query)
- Cache limit: max 200 profiles (evict oldest on overflow)

**Acceptance Criteria:**
- [ ] Shortlisted tab loads in < 300ms with no internet
- [ ] Synced photos render without internet
- [ ] Cache clears correctly on logout

---

### F-13 · Admin Panel (Mobile-Accessible Subset)

**Requirements:**
- Admin accounts (role = 'admin') see an "Admin" tab after login
- Verification queue: list of pending verification submissions with approve/reject buttons + rejection reason text
- Reports queue: list of user reports with block/dismiss actions
- Key stats cards: New signups today | Active subscriptions | Revenue today
- Full admin console remains on web — mobile is for on-the-go moderation only

**Acceptance Criteria:**
- [ ] Admin tab only visible to admin role accounts
- [ ] Approve/reject triggers same backend logic as web admin
- [ ] Non-admin accounts cannot access admin routes (API-enforced)

---

### F-14 · Marriage Bureau Console (Mobile)

**Requirements:**
- Bureau accounts (role = 'bureau') see a "Bureau" tab after login
- Client roster: list of bureau's registered clients with profile summary
- Add new client: form to create a profile on behalf of client
- Match proposals: browse platform search, tap "Propose to Client" → select client from roster
- Proposal status: Pending / Viewed / Accepted / Declined
- Earnings dashboard: total commission earned, pending payouts

**Acceptance Criteria:**
- [ ] Bureau tab only visible to bureau role accounts
- [ ] Proposal creation triggers notification to both client and proposed match
- [ ] Earnings reflect backend-calculated commission data

---

### F-15 · Success Stories & Support

**Success Story Submission:**
- Form: Couple names, wedding date, city, story text (max 300 chars), optional photo
- Submitted to admin queue for approval
- Approved stories displayed in Home screen carousel

**In-App Support:**
- "Help & Support" in Settings
- FAQ section (webview loading help docs URL)
- "Contact Support" → opens WhatsApp Business chat or in-app support ticket form
- Ticket form: category dropdown + description + optional screenshot attach

---

## 7. Out of Scope for v1.0

These are confirmed v2+ backlog items:
- Horoscope auto-match score (Vedic algorithm)
- "Why this match" AI explainer card
- Voice note profile intros
- Compatibility quiz
- Video profile verification (selfie liveness check)
- Background / marital-status third-party check
- Family group chat thread
- Guardian co-pilot mode (read-only guardian account linked to candidate)
- In-chat translation
- Scheduled video meeting requests (calendar integration)
- Astrologer consult marketplace
- Paid "Super Interest" highlight
- WhatsApp-based onboarding
- Regional language voice search
- Dark mode
- Web/desktop screen reader full support

---

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| App cold start | < 3 seconds |
| API p95 response time | < 800ms |
| Chat message delivery latency | < 500ms |
| Profile photo load (4G) | < 1.5 seconds |
| Offline shortlist load | < 300ms (from cache) |
| Crash-free session rate | ≥ 99.2% |
| Accessibility standard | WCAG 2.1 AA |
| Low-data mode | Thumbnails ≤ 50KB on detection of < 2G network |
| App download size (Android) | < 50MB APK / < 30MB on-device (AAB with splits) |
| App download size (iOS) | < 50MB IPA |
| Supported iOS versions | iOS 15+ |
| Supported Android versions | Android 8.0+ (API 26+) |

---

## 9. Dependency Map

| Feature | Depends On |
|---------|-----------|
| In-app chat | Mutual interest / accepted interest |
| Voice/Video calls | Premium+ subscription + Agora token API |
| Contact unlock | Plus+ subscription + quota > 0 |
| Who liked me | Plus+ subscription |
| Profile boost | VIP/Elite subscription |
| Advanced filters | Plus+ subscription |
| Saved search alerts | Plus+ subscription + Push notification opt-in |
| Biometric login | Successful first login |
| Offline shortlist | Shortlist populated + cache sync complete |
| Admin panel | Role = admin |
| Bureau console | Role = bureau |

---

*Document owner: Product / Globoniks Studio*  
*Next review: After Phase 1 build completion*
