# TricityShadi — App Store & Google Play Launch Checklist

Step-by-step to get the RN app (`mobile/`) live on both stores. Items marked
**[you]** need your accounts/credentials; **[code]** is already done on branch
`mobile/launch-prep`; **[build]** happens during EAS build/submit.

Bundle ID (both platforms): `com.tricityshadi.app`.

---

## 0. Accounts & tooling (one-time) **[you]**

- [ ] **Apple Developer Program** — enroll ($99/yr): https://developer.apple.com
- [ ] **Google Play Console** — register ($25 one-time): https://play.google.com/console
- [ ] **Expo/EAS account** — `npm i -g eas-cli && eas login`
- [ ] From `mobile/`: `eas init` → writes the real `extra.eas.projectId` (current value `tricityshadi-app` is a placeholder and must be replaced).
- [ ] Install the new native deps + regenerate native projects:
      `npx expo install react-native-iap expo-localization` then `npx expo prebuild --clean` (or just let EAS build handle it).

## 1. Pre-build blockers

- [ ] **[you/eng] Google targetSdk 35** — Play requires it for new apps. Expo SDK 51 targets 34 → **upgrade to Expo SDK 52+ (RN 0.76+)** first, then re-verify native modules (MMKV v2, reanimated, @gorhom/bottom-sheet v4, react-native-iap, react-native-razorpay, screens). This is the single biggest launch task.
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
- [ ] Play Console → Create app → name **TricityShadi**, app (not game), free.
- [ ] **Store listing**: short desc (≤80), full desc, app icon 512×512, feature graphic 1024×500, ≥2 phone screenshots (add 7"/10" tablet if you keep tablet support), promo assets.
- [ ] **Data safety** form — declare collected data: name, email, phone, photos, approximate location, messages, device IDs; encrypted in transit; deletable on account deletion (link Privacy Policy).
- [ ] **Content rating** questionnaire (matrimonial/social → likely Teen/Mature; answer honestly re: user communication).
- [ ] **Target audience** = 18+. **Ads** = No ads.
- [ ] **Privacy Policy URL** = https://tricityshadi.com/privacy

### 3b. Subscriptions (Google Play Billing) **[you]**
- [ ] Monetize → Subscriptions → create one product **per paid tier**, product IDs EXACTLY matching `backend/constants/plans.js → GOOGLE_PLAY_PRODUCTS`:
      `tricityshadi_basic_premium`, `tricityshadi_premium_plus`, `tricityshadi_elite`, `tricityshadi_vip`, `tricityshadi_nri`.
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
- [ ] **App Review Notes** (paste): _"Subscriptions are optional and sold on our website (tricityshadi.com); the iOS app does not sell digital goods in-app and contains no IAP. All core matrimonial features are usable free. This follows the external-purchase allowance."_
- [ ] Provide a **reviewer demo account** (a real member login — use the prod QA member; do not commit the password to the repo, paste it into App Review Notes).
- [ ] Export compliance: encryption exempt (already declared).

### 4c. Build, test, ship **[build]**
- [ ] Fill `eas.json → submit.production.ios` (`appleId`, `ascAppId`, `appleTeamId`).
- [ ] `eas build -p ios --profile production` → `eas submit -p ios`.
- [ ] **TestFlight**: verify all flows; confirm iOS subscribe button opens Safari to the site.
- [ ] Submit for review. If rejected on the external-payment link, fall back to read-only plans with the "manage on website" note (no tappable link).

---

## 5. Post-launch
- [ ] Monitor crash-free rate (add Sentry/Crashlytics if not present).
- [ ] Watch Play pre-launch report + App Store Connect metrics.
- [ ] Bump `version` + `ios.buildNumber` / `android.versionCode` in `app.json` for each update.

## Quick reference
- Legal (live): https://tricityshadi.com/privacy · /terms
- Product IDs: `backend/constants/plans.js → GOOGLE_PLAY_PRODUCTS`
- Server verify: `POST /subscription/google-verify`
- Readiness/scoring: `mobile/READINESS.md`
