import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';

/**
 * Language switcher for web. Persists choice to localStorage (tcs_lang) via
 * the i18next LanguageDetector. Wired into Settings + new pages.
 */
export default function LanguageSwitcher({ className = '' }) {
  const { i18n, t } = useTranslation();

  return (
    <label className={`lang-switcher ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14, color: '#6b6b6b' }}>{t('common.language')}</span>
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E8E8E8', background: '#fff' }}
        aria-label={t('common.language')}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </label>
  );
}
