/**
 * Jest config for the RN app.
 *
 * Why this file exists at all: the app had exactly one test file and it could
 * not run — `npx jest` from anywhere in the repo resolved the root-hoisted
 * jest 30 (backend's), while `jest-expo` requires jest 29, producing
 * `TypeError: this._moduleMocker.clearMocksOnScope is not a function`.
 * `mobile` now pins jest 29 in its own devDependencies so npm nests it here,
 * and `npm test --workspace=mobile` resolves the right binary.
 */

module.exports = {
  preset: 'jest-expo',

  // Expo and React Navigation ship untranspiled ESM. Without this, any test that
  // imports a screen dies on `SyntaxError: Cannot use import statement outside a
  // module` — which reads like a broken test and is actually a transform gap.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@gorhom/.*|react-native-reanimated|@shopify/.*|zustand)',
  ],

  // Mirrors the `@shared/*` alias in tsconfig.json AND metro.config.js. All three
  // must agree; a test-only mismatch is how you get "works in the app, fails in
  // CI" for shared constants.
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/../shared/src/$1',
  },

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}', '<rootDir>/__tests__/**/*.test.{ts,tsx,js}'],

  // Native modules are dynamically required so the bundle runs in Expo Go; under
  // jest they are absent too, so tests must never reach them.
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
