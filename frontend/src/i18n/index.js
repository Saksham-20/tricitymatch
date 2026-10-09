import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';
import pa from './locales/pa.json';

// Page/area strings live in one file per area and language:
//   locales/<lng>/<area>.json  →  t('<area>.<key>')
// One file per area keeps parallel work from colliding in a single huge JSON.
// English is bundled (it is also the fallback); Hindi and Punjabi are fetched
// only when chosen, so English visitors never download them.
const EN_AREAS = import.meta.glob('./locales/en/*.json', { eager: true, import: 'default' });
const LAZY_AREAS = import.meta.glob(['./locales/hi/*.json', './locales/pa/*.json'], { import: 'default' });

const areaOf = (path) => path.split('/').pop().replace(/\.json$/, '');
const withAreas = (base, modules) => {
  const out = { ...base };
  for (const [path, strings] of Object.entries(modules)) {
    const area = areaOf(path);
    out[area] = { ...(out[area] || {}), ...strings };
  }
  return out;
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: withAreas(en, EN_AREAS) },
      hi: { translation: hi },
      pa: { translation: pa },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      // Persist choice; survives reload
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'tcs_lang',
      caches: ['localStorage'],
    },
  });

// Keep <html lang> in sync so screen readers use the right pronunciation rules
// for hi/pa content (WCAG 3.1.1 / 3.1.2). LanguageDetector only sets the i18n
// language, never the document attribute.
const syncHtmlLang = (lng) => {
  if (typeof document !== 'undefined' && lng) {
    document.documentElement.setAttribute('lang', lng);
  }
};
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

const loaded = new Set(['en']);

/** Fetch and register a language's area files (no-op for English or a repeat). */
export const loadLanguage = async (lng) => {
  if (!lng || loaded.has(lng)) return;
  const entries = Object.entries(LAZY_AREAS).filter(([path]) => path.startsWith(`./locales/${lng}/`));
  const modules = await Promise.all(entries.map(async ([path, load]) => [path, await load()]));
  i18n.addResourceBundle(lng, 'translation', withAreas({}, Object.fromEntries(modules)), true, true);
  loaded.add(lng);
};

/** Switch language after its strings are in, so the page never flashes keys. */
export const setLanguage = async (lng) => {
  await loadLanguage(lng).catch(() => {});
  return i18n.changeLanguage(lng);
};

// Resolves once the saved/detected language is usable; main.jsx renders after it.
export const i18nReady = loadLanguage(i18n.resolvedLanguage || i18n.language).catch(() => {});

export default i18n;
