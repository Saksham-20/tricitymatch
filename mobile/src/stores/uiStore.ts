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

  /**
   * A modal bottom sheet is covering a tab screen. Ephemeral — never cached.
   * The floating pill tab bar is position:absolute over the whole screen, so
   * without this it draws ON TOP of an open sheet and hides that sheet's own
   * footer CTAs — Search's filter sheet lost both "Save search" and
   * "Show N profiles" behind it, on iOS and Android alike.
   */
  bottomSheetOpen: boolean;

  setLanguage: (lang: Language) => void;
  setElderMode: (enabled: boolean) => void;
  setDarkModeOverride: (value: boolean | null) => void;
  setBottomSheetOpen: (open: boolean) => void;
  initFromCache: () => void;
}

/** null = follow the system scheme. Flipped from `false` after the Phase E+F
 * makeStyles(c) sweep converted every module-scope light palette. */
export const DEFAULT_DARK_MODE_OVERRIDE: boolean | null = null;

export const useUIStore = create<UIState>((set) => ({
  language: 'en',
  elderMode: false,
  darkModeOverride: DEFAULT_DARK_MODE_OVERRIDE,
  bottomSheetOpen: false,

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

  setBottomSheetOpen: (bottomSheetOpen) => set({ bottomSheetOpen }),

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
