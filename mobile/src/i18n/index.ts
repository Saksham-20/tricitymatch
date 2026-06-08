import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import pa from './pa.json';
import { cache, CACHE_KEYS } from '../utils/cache';

const savedLang = cache.getString(CACHE_KEYS.LANGUAGE) ?? 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    pa: { translation: pa },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v3', // Intl.PluralRules not available in all Hermes builds
});

export default i18n;
