# TricityMatch — App Store & Google Play Launch Checklist

Step-by-step to get the RN app (`mobile/`) live on both stores. Items marked
**[you]** need your accounts/credentials; **[code]** is already done on `main`; **[build]** happens during EAS build/submit.

Bundle ID (both platforms): `com.tricityshadi.app`.

---

## 0. Accounts & tooling (one-time) **[you]**

- [ ] **Apple Developer Program** — enroll ($99/yr): https://developer.apple.com
- [ ] **Google Play Console** — register ($25 one-time): https://play.google.com/console
- [ ] **Expo/EAS account** — `npm i -g eas-cli && eas login`
- [ ] From `mobile/`: `eas init` → writes the real `extra.eas.projectId` (current value `tricityshadi-app` is a placeholder and must be replaced).
- [ ] ~~Install the new native deps~~ **[code] ✅** `react-native-iap`, `react-native-razorpay`,
      `expo-localization` and `@sentry/react-native` are installed and podded. Regenerate
      native projects with `npx expo prebuild --clean` after any `app.json` change.

## 1. Pre-build blockers

- [x] **Google targetSdk 35 — DONE**, and verified in the *installed artifact*
      (`adb shell dumpsys package com.tricityshadi.app` → `targetSdk=35`), not in config.
      An earlier revision of this file marked this done on the strength of a commit
      message alone; that commit changed zero native files and had never compiled.
      Assert native facts against a built APK.
- [x] **Native folders regenerated** for SDK 52 / RN 0.76.9 and building on both platforms
      (`expo run:android`, `expo run:ios`). Re-run `npx expo prebuild --clean` after any
      `app.json` change (iOS pods need `LANG/LC_ALL=en_US.UTF-8`). Keep **new arch OFF**
      (MMKV v2 / razorpay / fast-image are old-arch only).
- [x] **Sensitive permissions stripped** from the release APK via `android.blockedPermissions`
      — SYSTEM_ALERT_WINDOW, WRITE_EXTERNAL_STORAGE, and READ_PHONE_STATE (merged in by
      `com.razorpay:core`, and a Play *restricted* permission). Verified with
      `aapt dump permissions app-release.apk`. Re-check READ_PHONE_STATE against a real
      Razorpay checkout once live keys exist.
- [ ] **[decision] Sign in with Apple** — Google login is hidden on iOS (Guideline 4.8). Either keep it hidden (email/password only on iOS, already done **[code]**) or add `expo-apple-authentication` to re-enable social login on iOS.
- [ ] **[code] ✅** iOS export-compliance (`ITSAppUsesNonExemptEncryption=false`), Android `BILLING` permission, legal screens, payment routing.

## 2. Backend / server config **[you]**

- [ ] `EXPO_PUBLIC_RAZORPAY_KEY_ID` (build env) + live Razorpay keys server-side.
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — service account JSON (androidpublisher access) so `/subscription/google-verify` can validate purchases. `GOOGLE_PLAY_PACKAGE_NAME` defaults to `com.tricityshadi.app`.
- [ ] Deploy the branch's backend changes (google-verify route/controller/env) to prod.
- [ ] (Optional) FCM creds + Agora creds for push + calls.

---

## 3. Google Play

### 3a. Create & configure app **[you]**
- [ ] Play Console → Create app → name **TricityMatch**, app (not game), free.
- [ ] **Store listing**: short desc (≤80), full desc, app icon 512×512, feature graphic 1024×500, ≥2 phone screenshots (add 7"/10" tablet if you keep tablet support), promo assets.
- [ ] **Data safety** form — declare collected data: name, email, phone, photos, approximate location, messages, device IDs; encrypted in transit; deletable on account deletion (link Privacy Policy).
- [ ] **Content rating** questionnaire (matrimonial/social → likely Teen/Mature; answer honestly re: user communication).
- [ ] **Target audience** = 18+. **Ads** = No ads.
- [ ] **Privacy Policy URL** = https://tricitymatch.com/privacy

### 3b. Subscriptions (Google Play Billing) **[you]**
- [ ] Monetize → Subscriptions → create one product **per paid tier**, product IDs EXACTLY matching `backend/constants/plans.js → GOOGLE_PLAY_PRODUCTS`:
      `tricitymatch_basic_premium`, `tricitymatch_premium_plus`, `tricitymatch_elite`, `tricitymatch_vip`, `tricitymatch_nri`.
      > ⚠️ **Play product IDs are permanent once created.** This list previously
      > read `tricityshadi_*`, which no longer matches either
      > `backend/constants/plans.js` or `mobile/src/utils/iap.ts` — creating those
      > would have produced SKUs the app never requests, unfixably. Copy the IDs
      > from `plans.js` at the moment you create them; do not trust this file.
      > `founding_premium` is a **grant, not a purchasable SKU** — it must have no
      > Play product (pinned by `mobile/src/features/subscription/planMaps.test.ts`).
- [ ] Add a base plan + price for each (INR).
- [ ] (India) You may offer **user-choice billing** (Razorpay + Play) — enroll if desired; the app already presents both.
- [ ] Grant the service account "View financial data / Manage orders" so token verification works.

### 3c. Build, sign, test, ship **[build]**
- [ ] `eas build -p android --profile production` (app-bundle).
- [ ] Play App Signing: let Google manage the signing key.
- [ ] Upload to **Internal testing** → verify: signup/login, browse, chat, **Razorpay purchase**, **Google Play purchase → plan activates**, selfie verification, push.
- [ ] `eas submit -p android` (fill `eas.json → submit.production.android.serviceAccountKeyPath`).
- [ ] Promote to Production with a **staged rollout** (e.g. 20%).

---

## 4. Apple App Store

### 4a. Create & configure app **[you]**
- [ ] App Store Connect → Apps → New App → bundle `com.tricityshadi.app`, SKU, primary language.
- [ ] **App info**: name, subtitle, category (Lifestyle / Social Networking), Privacy Policy URL.
- [ ] **Screenshots**: 6.7" and 6.5" iPhone required (5.5" optional). App is iPhone-only (`supportsTablet:false`) → no iPad shots.
- [ ] App icon 1024×1024 (already in assets).
- [ ] **App Privacy** nutrition labels — mirror the Data-safety declarations above.
- [ ] **Age rating** questionnaire → 17+ likely.

### 4b. Payments (external — no IAP) **[you]**
- [ ] Do **not** configure any In-App Purchase — iOS routes subscriptions to the website by design.
- [ ] **App Review Notes** (paste): _"Subscriptions are optional and sold on our website (tricitymatch.com); the iOS app does not sell digital goods in-app and contains no IAP. All core matrimonial features are usable free. This follows the external-purchase allowance."_
- [ ] Provide a **reviewer demo account** (a real member login — use the prod QA member; do not commit the password to the repo, paste it into App Review Notes).
- [ ] Export compliance: encryption exempt (already declared).

### 4c. Build, test, ship **[build]**
- [ ] Fill `eas.json → submit.production.ios` (`appleId`, `ascAppId`, `appleTeamId`).
- [ ] `eas build -p ios --profile production` → `eas submit -p ios`.
- [ ] **TestFlight**: verify all flows; confirm iOS subscribe button opens Safari to the site.
- [ ] Submit for review. If rejected on the external-payment link, fall back to read-only plans with the "manage on website" note (no tappable link).

---

## 5. Post-launch
- [ ] Monitor crash-free rate — Sentry is wired already (`mobile/src/utils/crashReporting.ts`); it is a total no-op until `EXPO_PUBLIC_SENTRY_DSN` is set in `eas.json`.
- [ ] Watch Play pre-launch report + App Store Connect metrics.
- [ ] Bump `version` + `ios.buildNumber` / `android.versionCode` in `app.json` for each update.

## Quick reference
- Legal (live): https://tricitymatch.com/privacy · /terms
- Product IDs: `backend/constants/plans.js → GOOGLE_PLAY_PRODUCTS`
- Server verify: `POST /subscription/google-verify`
- Readiness/scoring: `mobile/READINESS.md`
