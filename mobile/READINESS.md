# TricityMatch Mobile — Launch Readiness

_Last updated: 2026-08-16 · `main`_

> The previous revision of this file was dated 2026-07-14 and was wrong in ways
> that mattered: it scored store-submission readiness on the strength of a commit
> that had never compiled, called `react-native-iap` and `expo-localization`
> "declared but not installed" when both are podded, and was written before the
> 2026-07-29 rebrand so it still said TricityShadi throughout. Treat scores here
> as claims that must be re-verified against a built artifact, not as state.

## Where this actually stands

| Dimension | State |
|---|---|
| Member-app parity with the website | **Good.** All member screens, forms and live data present. Gaps are listed below and are backend-shaped, not UI-shaped. |
| Builds and runs | **Verified.** Builds and boots on an API 35 Android emulator and an iPhone 17 Pro simulator; walked authed end-to-end (login → home → search + filters → matches → chat send → profile → settings → verification → subscription). |
| Android store posture | **Close.** targetSdk 35 confirmed in the installed artifact; sensitive permissions stripped from the release APK. Gated on a Play Console account and live payment keys. |
| iOS store posture | **Blocked on accounts.** No Apple Developer account, no `DEVELOPMENT_TEAM`, placeholder `submit.production.ios`. |
| UI/UX doctrine pass | **Done and device-swept (2026-09-24), followed by a design-improvement pass (2026-09-28, commit `be422dc`).** Every member screen was rebuilt against `docs/design-handoff/DOCTRINE_2026-09.md` §10 and walked on an API 35 emulator and an iPhone 17 Pro simulator (default, dark, elder, max text size, hi/pa). The follow-up pass (3 parallel reviews → 5 implementation slices) tightened type/spacing/density and motion feel and found a real cold-start logout bug (`authStore.initialize()`), fixed and re-verified live. Not run: VoiceOver/TalkBack, release builds, the iOS software keyboard, Android sheet edge-to-edge on ~14 non-PickerSheet Modal sites. Record: `docs/design-handoff/RN_REWORK_PLAN_2026-09.md` Phases 6–7. |
| Payments | **Code complete, cannot take money.** No live Razorpay keys anywhere; Google Play billing needs a Play-signed build. |
| Push and calls | **Not shipped.** See below — this is not a config gap. |

## Verified against artifacts, not config

- `targetSdk=35` read from `adb shell dumpsys package com.tricityshadi.app` on a
  running install.
- Release APK requests no `SYSTEM_ALERT_WINDOW`, no `WRITE_EXTERNAL_STORAGE` and
  no `READ_PHONE_STATE`, confirmed with `aapt dump permissions`. The last of
  those is merged in by `com.razorpay:core` and is a Play *restricted*
  permission; it is blocked, and must be re-checked against a real Razorpay
  checkout once live keys exist.
- Safe areas exercised on an API 35 emulator (edge-to-edge is forced there) and
  on a Dynamic Island simulator.
- **Edge-to-edge and the keyboard.** With targetSdk 35 on Android 15 the window no
  longer resizes for the keyboard, so `adjustResize` in the manifest does nothing
  and a form's submit button sat under the keyboard. Form screens use
  `KeyboardAvoidingView behavior="height"` on Android (`Screen`, `OnboardingLayout`,
  the group chat). Any new form screen must go through `Screen keyboard` or do the
  same. RN `Modal` windows resize by themselves.

## Not shipped — and not merely unconfigured

These read as "config-gated" in older docs. They are not: the packages are absent
from `mobile/package.json`, so no amount of environment setup turns them on.

- **Voice/video calls** — `react-native-agora` is not installed. The call screens
  are dynamic-require stubs; call buttons stay hidden behind
  `CONFIG.IS_AGORA_CONFIGURED`.
- **Push notifications** — `@react-native-firebase/messaging` is not installed,
  and there is no `google-services.json` / `GoogleService-Info.plist`, no
  notification config in `app.json`, and no `POST_NOTIFICATIONS` permission.

## Owner-blocked

1. Apple Developer Program enrolment (nothing iOS-store-shaped can proceed without it).
2. Play Console account — if it is a personal account, the 12-tester / 14-consecutive-day
   clock starts at the first installable build, so start it early.
3. Expo account + `eas init` — `extra.eas.projectId` is still the literal string
   `tricityshadi-app`, so **no EAS build can run at all** until this is replaced.
4. Live Razorpay keys (KYC).
5. Sentry DSN — the reporter is wired and deliberately dark without one.
6. Store collateral: screenshots, descriptions, data-safety / App-Privacy declarations.

## Known product gaps

- **Astrologer marketplace** is behind the server flag `ASTROLOGER_MARKETPLACE`
  (default off, the routes 404 and the app hides the entry). Before the flag is ever
  turned on: `ensureSeeded()` in `backend/routes/astrologerRoutes.js` bulk-creates
  three invented practitioners into an empty table in any environment, and
  in-app booking payment is not wired (the app hands off to the website).
- **i18n**: language switching works, but 31 member screens have no `t()` calls and
  about 97 chat keys have no hi/pa entry, so those strings show English.
- **Dark mode follows the system** (the module-scope palette retrofit landed
  2026-08-19) and was walked on both platforms in the 2026-09-24 sweep.
- **Google-sign-in accounts cannot delete their account in-app** (`password` is
  null and the delete endpoint runs bcrypt against it). Account deletion in the app
  is a Play and App Store requirement.
- **Android biodata "Share PDF"** ships only the caption (`Share.share` drops the
  file on Android; `expo-sharing` needs a native rebuild).
- Onboarding asks some questions the server has no column for (Step 11 partner
  preferences, Step 8 exercise, Step 9 family values, Step 7 has-children); the
  answers are dropped.

## Installing on a real device today

No EAS project exists, so use the local cable path:

```bash
cd mobile
npx expo prebuild --clean          # after any app.json change
npx expo run:android --device      # debug-signed; fine for testing, not for Play
npx expo run:ios --device          # select a signing team in Xcode first
```

Point the build at an environment with `mobile/.env` (`EXPO_PUBLIC_API_URL` must
include `/api/v1` — `eas.json` overrides `.env` on EAS builds, and once did not).

See `docs/STORE_LAUNCH_CHECKLIST.md` for the submission sequence.
