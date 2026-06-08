import { create } from 'zustand';
import type { SubscriptionPlanType } from '../types';
import { cache, CACHE_KEYS } from '../utils/cache';

type Language = 'en' | 'hi' | 'pa';

interface UIState {
  language: Language;
  elderMode: boolean;
  // null = follow system; true = force dark; false = force light
  darkModeOverride: boolean | null;
  upgradeModalVisible: boolean;
  upgradeModalRequiredPlan: SubscriptionPlanType | null;

  setLanguage: (lang: Language) => void;
  setElderMode: (enabled: boolean) => void;
  setDarkModeOverride: (value: boolean | null) => void;
  showUpgradeModal: (plan: SubscriptionPlanType) => void;
  hideUpgradeModal: () => void;
  initFromCache: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  language: 'en',
  elderMode: false,
  darkModeOverride: null,
  upgradeModalVisible: false,
  upgradeModalRequiredPlan: null,

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

  showUpgradeModal: (upgradeModalRequiredPlan) => {
    set({ upgradeModalVisible: true, upgradeModalRequiredPlan });
  },

  hideUpgradeModal: () => {
    set({ upgradeModalVisible: false, upgradeModalRequiredPlan: null });
  },

  initFromCache: () => {
    const lang = cache.getString(CACHE_KEYS.LANGUAGE) as Language | undefined;
    const elder = cache.getBoolean(CACHE_KEYS.ELDER_MODE);
    const darkRaw = cache.getString(CACHE_KEYS.DARK_MODE);
    const darkModeOverride: boolean | null =
      darkRaw === 'true' ? true : darkRaw === 'false' ? false : null;
    set({
      language: lang ?? 'en',
      elderMode: elder ?? false,
      darkModeOverride,
    });
  },
}));
