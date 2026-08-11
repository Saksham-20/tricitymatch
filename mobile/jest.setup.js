/**
 * Jest setup for the RN app.
 *
 * Everything mocked here is a NATIVE module. In the real app they are behind
 * dynamic requires so the JS bundle still runs in Expo Go; under jest there is
 * no native side at all, so an unmocked one throws at import time and the
 * failure looks like a broken test rather than a missing binding.
 */

/* eslint-env jest */

jest.mock('react-native-mmkv', () => {
  // In-memory stand-in for MMKV v2's class API. Keeps the typed accessors the
  // cache layer uses (getString/setString/getNumber/...) behaving like storage.
  class MMKV {
    constructor() {
      this.store = new Map();
    }
    set(k, v) { this.store.set(k, v); }
    getString(k) { const v = this.store.get(k); return typeof v === 'string' ? v : undefined; }
    getNumber(k) { const v = this.store.get(k); return typeof v === 'number' ? v : undefined; }
    getBoolean(k) { const v = this.store.get(k); return typeof v === 'boolean' ? v : undefined; }
    contains(k) { return this.store.has(k); }
    delete(k) { this.store.delete(k); }
    getAllKeys() { return [...this.store.keys()]; }
    clearAll() { this.store.clear(); }
  }
  return { MMKV };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  authenticateAsync: jest.fn(async () => ({ success: false })),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', regionCode: 'IN', currencyCode: 'INR' }],
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

// Reanimated ships its own jest mock; the extra stub silences the frame-callback
// warning that otherwise floods every run.
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Silence the RN Animated deprecation notice — it is noise, not signal, and it
// obscures real warnings in test output.
jest.spyOn(console, 'warn').mockImplementation((msg, ...rest) => {
  if (typeof msg === 'string' && /useNativeDriver|Animated:/.test(msg)) return;
  // eslint-disable-next-line no-console
  console.info(msg, ...rest);
});
