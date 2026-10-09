import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import CheckBox from '../ui/CheckBox';

/**
 * What a new member agrees to, shared by every way of creating an account
 * (email or phone signup, Google), so the record means the same thing however
 * the account was made. DPDP notice itemised in plain text with the request
 * (Legal Review B-1); Terms required; promotional email optional and unticked.
 */
export const ConsentNotice = () => {
  const { t } = useTranslation();
  return (
  <div className="rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 p-4 sm:p-5">
    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
      <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">{t('signup.consentTitle')}</span>
      {t('signup.consentBody')}
    </p>
  </div>
  );
};

export const TermsCheckbox = ({ checked, onChange, error }) => (
  <div>
    <CheckBox
      checked={!!checked}
      onChange={onChange}
      size="md"
      label={
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          <Trans
            i18nKey="signup.termsAgree"
            components={{
              terms: <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-300 underline hover:text-primary-700" />,
              privacy: <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-300 underline hover:text-primary-700" />,
            }}
          />
        </span>
      }
    />
    {error && <p className="text-sm text-destructive dark:text-red-300 mt-1.5">{error}</p>}
  </div>
);

export const MarketingCheckbox = ({ checked, onChange }) => (
  <CheckBox
    checked={!!checked}
    onChange={onChange}
    size="md"
    label={<span className="text-sm text-neutral-600 dark:text-neutral-300"><Trans i18nKey="signup.marketingOptIn" /></span>}
  />
);
