import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import ContactNumberVerify from './ContactNumberVerify';

// Signing up/in and the pages a member must always be able to read stay usable.
// /settings too: a member whose number already belongs to another account
// (a second account made with Google, or a parent's number on a sibling's
// account) could otherwise only sign out, never delete the duplicate. /welcome
// verifies the number itself as step 2.
const EXEMPT = [
  '/onboarding', '/login', '/signup', '/forgot-password', '/reset-password', '/welcome', '/settings',
  '/terms', '/privacy', '/refund-policy', '/delete-account', '/contact', '/help', '/safety', '/about',
];

/**
 * A verified mobile number is compulsory for every member: other members call
 * it after they unlock a profile. Until one is saved this covers the app and
 * cannot be dismissed; signing out is the only other way through.
 */
export default function ContactNumberPrompt() {
  const { user, isAuthenticated, updateUser, logout } = useAuth();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [phone, setPhone] = useState(user?.phone || '');

  useEffect(() => { setPhone(user?.phone || ''); }, [user?.phone]);

  const required =
    isAuthenticated &&
    user?.role === 'user' &&
    user?.status !== 'deleted' &&
    user?.onboardingComplete !== false &&
    user?.phoneVerified === false &&
    !EXEMPT.includes(pathname) &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/marketing');

  if (!required) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="contact-prompt-title">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl">
        <h2 id="contact-prompt-title" className="font-display text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {t('contactNumber.promptTitle')}
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {t('contactNumber.promptBody')}
        </p>
        <div className="mt-5">
          <ContactNumberVerify
            flow="account"
            value={phone}
            verified={false}
            onChange={setPhone}
            onVerified={(d) => {
              updateUser({ phone: d, phoneVerified: true });
              toast.success(t('contactNumber.numberVerified'));
            }}
          />
        </div>
        <div className="mt-5 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 p-3 text-sm text-neutral-600 dark:text-neutral-400">
          <Trans
            i18nKey="contactNumber.alreadyJoined"
            components={{ anchor: <Link to="/settings" className="font-medium text-primary-600 dark:text-primary-300 underline underline-offset-2" /> }}
          />
        </div>
        <button type="button" onClick={() => logout()} className="mt-4 text-sm text-neutral-600 dark:text-neutral-300 hover:underline py-2">
          {t('auth.signOut')}
        </button>
      </div>
    </div>
  );
}
