# Working in `mobile/`

## Versions that actually apply

This app is **Expo SDK 52** / **React Native 0.76.9** / **React 18.3.1**, old
architecture, bare workflow (`android/` and `ios/` are committed, so
`expo prebuild` is a deliberate step, not something EAS silently redoes).

Read the versioned docs at **https://docs.expo.dev/versions/v52.0.0/**.

> This file previously pointed at SDK **41** docs — three years and eleven SDKs
> stale. Anything written against it was wrong on arrival. If you find yourself
> reading docs whose API doesn't match the code in front of you, check this
> header first.

## Commands

Run these from `mobile/`, never from the repo root:

```bash
node_modules/.bin/tsc --noEmit -p tsconfig.json   # `tsc` on PATH is v4 — do not use it
npm test                                          # jest 29 (root hoists jest 30 for backend)
npx expo start --clear
```

## Gotchas that cost time

- **`tsc` on PATH is v4.** Always use the repo-local binary above.
- **jest is version-split.** Backend runs jest 30 hoisted at the root; `mobile`
  pins jest 29 locally because `jest-expo` requires it. Running `npx jest` from
  the root inside `mobile/` finds the wrong one.
- **`@shared/*`** must stay aliased in BOTH `tsconfig.json` and `metro.config.js`.
- **Native modules** (Agora, Razorpay, react-native-iap, Firebase messaging,
  expo-camera/av/local-authentication) are dynamically required so the bundle
  still runs in Expo Go, where they throw. They only work in a dev/production
  build.
- **Play product IDs** (`tricitymatch_*`) are permanent once created in Play
  Console. `backend/constants/plans.js` and `mobile/src/utils/iap.ts` must agree.
- **The mobile workspace is inside the root `lint`/`test` gate.** A change to
  `shared/` that breaks RN typechecking fails CI now; it used to pass silently.
