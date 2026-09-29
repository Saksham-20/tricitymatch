import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import ContactNumberVerify from './ContactNumberVerify';

// Signing up/in and the pages a member must always be able to read stay usable.
const EXEMPT = [
  '/onboarding', '/login', '/signup', '/forgot-password', '/reset-password',
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
          Add your mobile number to continue
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          When someone unlocks your contact, this is the number they call. Every member needs a verified number, so nobody reaches a wrong one.
        </p>
        <div className="mt-5">
          <ContactNumberVerify
            flow="account"
            value={phone}
            verified={false}
            onChange={setPhone}
            onVerified={(d) => {
              updateUser({ phone: d, phoneVerified: true });
              toast.success('Number verified');
            }}
          />
        </div>
        <button type="button" onClick={() => logout()} className="mt-5 text-sm text-neutral-500 hover:underline">
          Sign out
        </button>
      </div>
    </div>
  );
}
