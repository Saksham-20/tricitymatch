# Store readiness posture — 2026-08-10 (RN-B)

Branch `mobile/launch-prep`. Written after RN-A: the app builds and boots on iOS
(iPhone 17 Pro simulator) and Android (API 34 and API 35 emulators).

Status key: **CLOSED** = verified on a device or in the artifact · **OPEN (owner)** =
needs a decision or credential only the owner can supply · **OPEN (code)** = engineering
work remaining.

---

## 1. Android — Google Play

### 1.1 targetSdk 35 — **CLOSED**
Google Play rejects new apps below targetSdk 35.

Verified at the artifact level, not just in config:
```
adb shell dumpsys package com.tricityshadi.app
  versionCode=1 minSdk=24 targetSdk=35
```
Set declaratively via `expo-build-properties` in `app.json`, so `expo prebuild --clean`
regenerates it rather than losing it. The earlier commit that claimed to have cleared
this blocker never touched `android/build.gradle`, which still read 34 — the claim was in
the commit message only.

### 1.2 Android 15 edge-to-edge — **PARTIALLY CLOSED**
targetSdk 35 on Android 15 **forces** edge-to-edge: the app draws under the status and
navigation bars whether or not it was designed to.

Verified on a real API 35 emulator (`qa_api35`, google_apis arm64):
- **Welcome** — clean. Content clears the status bar and the gesture pill.
- **Login** — clean, including with the IME raised.

**Not verified, and the likely breakage:** every screen behind authentication. The design
review found hardcoded insets rather than `useSafeAreaInsets` in exactly the places that
edge-to-edge punishes — `HomeScreen.tsx:270` (`paddingTop: 56`) and
`ProfileDetailScreen.tsx:625` (`top: 48`). Reaching them needs a logged-in session
against a running backend, which this pass did not stand up.

→ Carry into RN-C/RN-F: drive the authed screens on API 35 and replace hardcoded insets.

### 1.3 Closed-testing requirement — **OPEN (owner)**
A Google Play **personal** developer account created after November 2023 must run a
closed test with **12 testers for 14 consecutive days** before it can be promoted to
production.

This is a calendar dependency, not code. Nobody has checked which account type this is.
**If it is a personal account, the 14-day clock should start the day RN-B produces an
installable build** — otherwise it is added to the end of the schedule rather than run in
parallel with RN-C..RN-G.

**Owner action:** confirm the Play Console account type.

### 1.4 Permissions — **CLOSED**
`READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` removed during the RN-A merge. Both
are dead since API 33, and Play actively flags `WRITE_EXTERNAL_STORAGE`. Remaining set:
CAMERA, RECORD_AUDIO, USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE, RECEIVE_BOOT_COMPLETED,
`com.android.vending.BILLING`.

---

## 2. iOS — App Store

### 2.1 Guideline 4.8 (Sign in with Apple) — **CLOSED, does not apply**
4.8 obliges Sign in with Apple only when the app offers a *third-party* social login.
`LoginScreen` hides Google sign-in on iOS entirely (`Platform.OS !== 'ios'`, with a
comment naming the rejection risk), so iOS ships email/password only and the requirement
never attaches.

**This is load-bearing.** Adding Google sign-in to iOS later silently acquires the Sign in
with Apple obligation. Do not add it without also implementing Apple sign-in.

### 2.2 Guideline 3.1.1 — in-app purchase — **OPEN (owner), the largest open item**
Current approach on this branch (`1b249be`): iOS sends buyers to the website
(`Linking.openURL('https://tricitymatch.com/subscription')`) to avoid Apple's commission.
Android keeps in-app billing (Razorpay + Google Play user-choice).

The risk is real. 3.1.1 requires digital subscriptions consumed in the app to be sold
through IAP, and anti-steering rules have historically forbidden exactly this link-out.
Comparable products (matchmaking subscriptions) ship IAP.

**If review forces IAP, this is plausibly the single largest work item in the whole plan** —
and it is not a memo:
- App Store Connect subscription products for the full ladder, including founding pricing
- `react-native-iap` purchase flow (the dependency is already present and now correctly
  flavour-resolved on Android)
- server-side receipt validation and a `Subscription` writer for a non-Razorpay source —
  the Google Play leg (`POST /subscription/google-verify`) is the template, and it already
  supersedes prior active subs correctly
- restore-purchases, plus Apple-mandated subscription-management links

**Owner action:** decide whether to submit on the web-redirect and accept rejection risk,
or build IAP first. **RN-C's subscription, founding and unlock-bundle screens should not be
built or polished until this is settled** — that is the entire reason RN-B precedes RN-C.

### 2.3 Toolchain — **CLOSED, with two vendored patches**
Expo SDK 52 predates Xcode 26; two third-party sources do not compile against it. Both are
patched idempotently and re-applied automatically, and both should be deleted when
upstream catches up:
- `fmt` 9.x consteval failure → patched in `ios/Podfile` `post_install`
- `expo-localization` non-exhaustive `Calendar.Identifier` switch →
  `scripts/patch-native-modules.cjs`, run on postinstall

---

## 3. Both stores

### 3.1 Non-functional UI — **CLOSED**
Store reviewers treat dead UI as a rejection reason, and it erodes user trust regardless.
Fixed in RN-B:
- Google sign-in on Android was a live button whose handler read
  *"Configure EXPO_PUBLIC_GOOGLE_CLIENT_ID to enable"* — developer text shown to users.
  Now hidden unless real credentials exist. Verified gone on the API 35 device.
- Voice/video call buttons navigated into Agora screens that cannot connect without
  credentials. Now hidden, matching the web app.
- The `IS_*_CONFIGURED` flags that should have prevented both had **zero consumers**, and
  `IS_GOOGLE_CONFIGURED` could never be correct anyway — it tested
  `.endsWith('.apps.googleusercontent.com')`, which both placeholder values satisfy.

### 3.2 Legal + grievance surfaces — **CLOSED**
In-app Terms, Privacy, About, Safety and Contact screens exist. During RN-A their
statutory contacts were corrected from `tricityshadi.com` to `tricitymatch.com`, including
the Grievance Officer address required under Indian law. They had been missed by the
2026-07-29 rebrand because they are *new files on this branch*, so neither the rename nor
the merge touched them.

### 3.3 Dark mode — **CLOSED for review, OPEN (code) for quality**
Light-locked by owner decision. `useTheme` previously followed the system scheme, so any
reviewer running a dark phone hit illegible screens on first launch — 84 of 88 files bake
the light palette into module-scope `StyleSheet.create`, which evaluates once at import
and cannot respond to a theme change. An explicit user choice still wins; only the absence
of one is locked. RN-G retrofits and restores system-following.

### 3.4 Crash reporting — **CLOSED (code), OPEN (owner: DSN)**
`@sentry/react-native` installed and wired at `App.tsx` entry via
`src/utils/crashReporting.ts`, verified booting on device with the native module linked.

Config-gated on `EXPO_PUBLIC_SENTRY_DSN`: with no DSN nothing initialises, nothing is
sent, and no network call is attempted. A crash reporter that threw on startup because it
was unconfigured would be worse than none.

Deliberately not captured, and this is a data-safety commitment as much as an engineering
one: no request/response bodies (profiles here carry caste, religion, income and
photographs), no email or phone. The user id is attached on login and cleared on logout —
enough to correlate a report with an account, not enough to identify a person.

The Sentry Expo build plugin was removed. It exists only to upload source maps and fails
the build without an org and auth token; the runtime SDK does not need it. Re-add it when
the owner supplies Sentry credentials, and stack traces become readable.

**Owner action:** create the Sentry project, supply `EXPO_PUBLIC_SENTRY_DSN`.

### 3.5 OTA updates — **CLOSED (code)**
`app.json` now carries `runtimeVersion: { policy: 'fingerprint' }` and an `updates` block,
and `eas.json` binds each profile to a channel (development / preview / production).

The fingerprint policy is the part that matters. It derives the runtime version from the
NATIVE surface, so a JS bundle can only land on a binary whose native modules actually
match it. Without it, an OTA update that assumes a module the installed binary does not
have crashes every user who receives it — turning the mechanism meant to avoid a review
cycle into the thing that requires one.

### 3.6 Store collateral — **OPEN (owner + code)**
Review demo account, screenshots, data-safety / privacy-nutrition declarations (note:
selfie verification means face imagery must be declared), phased rollout plan.

### 3.7 Supply gate — **OPEN (owner), and it is a judgement call not a task**
Production currently has very few live profiles. An app launched into a near-empty
marketplace earns permanent 1-star "no matches here" reviews, and store ratings do not
reset. **Submission should be gated on supply, not only on code being ready.**

---

## Summary — what actually blocks submission

| # | Item | Type |
|---|------|------|
| 1 | iOS payment posture: web-redirect vs IAP | **OWNER — decide before RN-C builds those screens** |
| 2 | Play Console account type → 12-tester / 14-day clock | **OWNER — start the clock now if personal** |
| 3 | Razorpay live keys (KYC) | OWNER — the product cannot take money on any platform today |
| 4 | Sentry DSN (reporter is wired and dark) | OWNER |
| 5 | Edge-to-edge on authed screens | CODE |
| 6 | Store collateral + data-safety declarations | OWNER + CODE |
| 7 | Supply gate | OWNER judgement |

Items 1 and 2 are the two that cost calendar time rather than engineering time, which is
why they are first.
