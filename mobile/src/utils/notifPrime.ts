/**
 * Push-permission priming — ask AFTER the first like ("know the moment they
 * like you back"), never on cold start. A pre-permission sheet explains the
 * value; only an accept triggers the real OS prompt, so a decline here costs
 * nothing (the OS prompt is one-shot on iOS).
 *
 * States (AsyncStorage): unset = never primed · 'accepted' · 'declined'.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const NOTIF_PRIME_KEY = 'notifPrime';

type PrimeListener = () => void;
let listener: PrimeListener | null = null;

/** The priming sheet registers itself here (one mount, in MainNavigator). */
export const onNotifPrimeRequest = (fn: PrimeListener): (() => void) => {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
};

/** Call after a successful like. No-ops once the member has answered. */
export const requestNotifPrime = async (): Promise<void> => {
  try {
    const state = await AsyncStorage.getItem(NOTIF_PRIME_KEY);
    if (state) return;
    listener?.();
  } catch { /* priming is never worth an error surface */ }
};

export const setNotifPrimeState = (state: 'accepted' | 'declined'): void => {
  AsyncStorage.setItem(NOTIF_PRIME_KEY, state).catch(() => {});
};

export const getNotifPrimeState = async (): Promise<string | null> => {
  try { return await AsyncStorage.getItem(NOTIF_PRIME_KEY); } catch { return null; }
};
