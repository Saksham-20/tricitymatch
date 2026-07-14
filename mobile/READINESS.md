# TricityShadi Mobile — Launch Readiness

_Last updated: 2026-07-14 · branch `mobile/launch-prep`_

## Scores

| Dimension | Score | Notes |
|---|---|---|
| **Member-app feature/data parity with website** | **9.0 / 10** | All member pages, forms, fields, and live data present. Legal pages added. Remaining: full hi/pa i18n on 6 screens. |
| **Payments (code)** | **9.0 / 10** | iOS→web redirect, Android Razorpay + Google Play chooser, unlock bundles, NRI currency — all code-complete. Not yet exercised on a real store build. |
| **Store-submission readiness** | **7.0 / 10** | targetSdk 35 done (SDK 52). Gated on: `expo prebuild --clean` native regen, real EAS/store accounts, IAP product setup, live payment test. See Blockers. |
| **Overall code completeness** | **8.5 / 10** | The app is code-complete for launch; the gap to "in the stores" is configuration + accounts + one platform upgrade, not features. |

**Bottom line:** the member app is functionally done and store-configured. It is **not one click from the stores** — three things stand between here and a live listing: (1) an **Expo SDK 51→52+ upgrade** for Google's targetSdk-35 rule, (2) **your Apple + Google accounts** to create the apps / IAP products / signing, and (3) a **native build** to test real payments, camera, and push. All are documented in `docs/STORE_LAUNCH_CHECKLIST.md`.

---

## ✅ Complete

- **All member screens + navigation** (auth, onboarding, home, search, matches, chat, profile/edit, subscription, verification, guardian, astrologers, notifications, settings, success stories).
- **In-app legal & info**: Terms, Privacy, About, Safety, Contact (native, ported from web) — reachable from Settings → About & Legal and from Signup. _Required by both stores._
- **Payments rework**
  - iOS: subscribe CTA opens `tricityshadi.com/subscription` (no Apple IAP / 30% cut).
  - Android: payment-method chooser — Card/UPI (Razorpay) **or** Google Play.
  - Unlock-bundle top-ups on the Subscription screen.
  - NRI indicative local-currency display (charged in ₹).
  - Backend `POST /subscription/google-verify` (Play Developer API token validation + acknowledge + supersede prior sub; config-gated).
- **Fixed a latent payment bug**: mobile sent snake_case `razorpay_*` keys; backend/web use camelCase → verify would have 400'd every real Razorpay/bundle purchase.
- **Store config**: iOS encryption declaration, Android `BILLING` permission, `expo-localization` plugin, Apple-4.8 Google-login gate, verified 1024² icons + splash.
- **Regression**: mobile `tsc` 0 errors · backend unit **171/171** green.

## 🟡 Config-gated (code done, needs credentials / native build)

| Item | What's needed |
|---|---|
| Google Play Billing | Create subscription products in Play Console with the exact IDs in `backend/constants/plans.js → GOOGLE_PLAY_PRODUCTS` (`tricityshadi_basic_premium`, …); set `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` on the server; native build. |
| Razorpay (Android) | `EXPO_PUBLIC_RAZORPAY_KEY_ID` + live server keys; `react-native-razorpay` linked in a native build. |
| `react-native-iap`, `expo-localization` | Declared in `package.json` but not installed. Run `npx expo install react-native-iap expo-localization` then prebuild/EAS build. (App runs fine without them in Expo Go — they degrade gracefully.) |
| Push (FCM) | Firebase creds + native build. |
| In-app calls (Agora) | `EXPO_PUBLIC_AGORA_APP_ID` + server certificate. |

## 🔴 Blockers / decisions

1. **Google Play targetSdk 35 — ✅ RESOLVED.** Upgraded to **Expo SDK 52 / React Native 0.76.9** (targetSdk 35). All native deps aligned: react 18.3.1, react-native-screens 4.4.0, reanimated 3.16.7, gesture-handler 2.20.2, safe-area-context 4.12.0, @gorhom/bottom-sheet 5.2.14, MMKV 2.12.2 (old arch). Verified: mobile `tsc` 0, **Metro production bundle succeeds** (5.5 MB Hermes), expo-doctor clean of blockers, backend 171/171, frontend build ✓.
   - **⚠️ One native step remains:** the committed `mobile/android` + `mobile/ios` folders were generated for SDK 51 and are now stale. Run **`npx expo prebuild --clean`** to regenerate them for SDK 52 before a local native build (EAS Build does this automatically). New arch stays **off** (MMKV v2, react-native-razorpay, react-native-fast-image are old-arch only).
2. **Apple Sign in with Apple (Guideline 4.8)** — Google login is currently **hidden on iOS** to avoid rejection. To offer social login on iOS, add `expo-apple-authentication` (Sign in with Apple). Otherwise iOS ships email/password only (fine).
3. **iOS external-payment link (3.1.1/3.1.3)** — the website redirect is now permissible but a review-risk area. Include the App Review note in the checklist; fallback is read-only plans with no link.

## ⚪ Out of scope / known gaps (non-blocking)

- **i18n residual**: 6 member screens still English-only (Notifications, Astrologer ×2, HoroscopeMatch, Support, SuccessStory). Language switch works elsewhere. ~½ day.
- **Admin/Bureau stacks**: deferred. Admin `VerificationQueueScreen` still document-based (web admin is selfie photo-comparison) — needs a rework when admin is in scope.
- **Astrologer marketplace**: stub data (backend table unseeded).
- **Saved searches / sent-interests**: no backend; UI intentionally hidden.

## Not live-tested (needs a native build / hardware)

Real Google Play + Razorpay purchase, live-camera selfie verification, voice/video calls, FCM push. All are code-complete and config-gated; verify on the first internal (TestFlight / Play internal-testing) build.
