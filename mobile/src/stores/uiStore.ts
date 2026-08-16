import { create } from 'zustand';
import { cache, CACHE_KEYS } from '../utils/cache';

type Language = 'en' | 'hi' | 'pa';

interface UIState {
  language: Language;
  elderMode: boolean;
  // null = follow system; true = force dark; false = force light.
  //
  // DEFAULTS TO false (light-lock), NOT null. Dark mode is not shippable yet:
  // 84 of 88 screen files bake the light palette into module-scope
  // StyleSheet.create, which is evaluated once at import and therefore cannot
  // respond to a theme change. Following the system scheme meant every user with
  // a dark phone — including App Store reviewers, who commonly run dark — hit
  // illegible screens on first launch (near-black text on a near-black ground in
  // the shared EmptyState primitive, the whole Subscription chrome, both Search
  // sheets). Owner decision 2026-08-10: ship light-locked, retrofit in RN-G, then
  // restore `null` here so the system preference is honoured again.
  darkModeOverride: boolean | null;

  setLanguage: (lang: Language) => void;
  setElderMode: (enabled: boolean) => void;
  setDarkModeOverride: (value: boolean | null) => void;
  initFromCache: () => void;
}

/** See the note on `darkModeOverride` above. RN-G sets this back to `null`. */
export const DEFAULT_DARK_MODE_OVERRIDE: boolean | null = false;

export const useUIStore = create<UIState>((set) => ({
  language: 'en',
  elderMode: false,
  darkModeOverride: DEFAULT_DARK_MODE_OVERRIDE,

  setLanguage: (language) => {
    cache.setString(CACHE_KEYS.LANGUAGE, language);
    set({ language });
  },

  setElderMode: (elderMode) => {
    cache.setBoolean(CACHE_KEYS.ELDER_MODE, elderMode);
    set({ elderMode });
  },

  setDarkModeOverride: (value) => {
    if (value === null) {
      cache.delete(CACHE_KEYS.DARK_MODE);
    } else {
      cache.setString(CACHE_KEYS.DARK_MODE, value ? 'true' : 'false');
    }
    set({ darkModeOverride: value });
  },

  initFromCache: () => {
    const lang = cache.getString(CACHE_KEYS.LANGUAGE) as Language | undefined;
    const elder = cache.getBoolean(CACHE_KEYS.ELDER_MODE);
    const darkRaw = cache.getString(CACHE_KEYS.DARK_MODE);
    // An explicit user choice still wins; only the ABSENCE of one is light-locked.
    const darkModeOverride: boolean | null =
      darkRaw === 'true' ? true : darkRaw === 'false' ? false : DEFAULT_DARK_MODE_OVERRIDE;
    set({
      language: lang ?? 'en',
      elderMode: elder ?? false,
      darkModeOverride,
    });
  },
}));
