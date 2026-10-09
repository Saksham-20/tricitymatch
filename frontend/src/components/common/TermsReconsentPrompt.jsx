import { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import CheckBox from '../ui/CheckBox';

/**
 * Shown when the Terms have changed since the version this member accepted
 * (`user.requiresReconsent`, set by the server). The server also refuses every
 * other request until they accept, so this is the only way forward besides
 * signing out. Reading the documents stays possible: the links open in a new tab.
 */
export default function TermsReconsentPrompt() {
  const { user, isAuthenticated, logout } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  if (!isAuthenticated || !user?.requiresReconsent) return null;

  // An account our team set up for the member: they have not accepted anything
  // yet, so "we have updated our Terms" would be untrue.
  const assisted = user.termsVersion === 'assisted-signup';

  const accept = async () => {
    setBusy(true);
    try {
      await api.post('/auth/accept-terms', { termsVersion: user.currentTermsVersion, accepted: true });
      toast.success(t('welcome.thankYou'));
      // Everything the page tried to load while blocked came back 403; start clean.
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('welcome.saveChoiceFailed'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="reconsent-title">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl">
        <h2 id="reconsent-title" className="font-display text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {assisted ? t('welcome.welcomeTitle') : t('welcome.updatedTitle')}
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {assisted
            ? t('welcome.assistedBody')
            : t('welcome.updatedBody')}
        </p>
        <div className="mt-4">
          <CheckBox
            checked={agreed}
            onChange={setAgreed}
            size="md"
            label={
              <span className="text-sm text-neutral-600 dark:text-neutral-300">
                <Trans
                  i18nKey={assisted ? 'welcome.agreeAssisted' : 'welcome.agreeUpdated'}
                  components={{
                    terms: <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline" />,
                    privacy: <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline" />,
                  }}
                />
              </span>
            }
          />
        </div>
        <button
          type="button"
          disabled={!agreed || busy}
          onClick={accept}
          className="mt-5 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? t('auth.saving') : t('welcome.acceptContinue')}
        </button>
        <button type="button" onClick={() => logout()} className="mt-4 text-sm text-neutral-500 hover:underline">
          {t('auth.signOut')}
        </button>
      </div>
    </div>
  );
}
