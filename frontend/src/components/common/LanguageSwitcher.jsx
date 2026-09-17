import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';

/**
 * Language switcher for web. Persists choice to localStorage (tcs_lang) via
 * the i18next LanguageDetector. Wired into Settings + new pages.
 */
export default function LanguageSwitcher({ className = '' }) {
  const { i18n, t } = useTranslation();

  return (
    <label className={`lang-switcher inline-flex items-center gap-2 ${className}`}>
      <span className="text-sm text-neutral-500 dark:text-neutral-400">{t('common.language')}</span>
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="px-2.5 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        aria-label={t('common.language')}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </label>
  );
}
