import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import ContactNumberVerify from './ContactNumberVerify';

const DISMISS_KEY = 'tm-contact-prompt-dismissed';
const HIDDEN_ON = ['/onboarding', '/login', '/signup', '/forgot-password', '/reset-password', '/verification'];

const wasDismissed = () => {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

/**
 * Asks members who have no verified mobile number to add one. Other members
 * call this number after unlocking a profile, so an unverified or missing one
 * means the unlock has nothing to reveal. Shows once per browser session and
 * never blocks the page behind it.
 */
export default function ContactNumberPrompt() {
  const { user, isAuthenticated, updateUser } = useAuth();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [phone, setPhone] = useState(user?.phone || '');

  useEffect(() => { setPhone(user?.phone || ''); }, [user?.phone]);

  const eligible =
    isAuthenticated &&
    user?.role === 'user' &&
    user?.status !== 'deleted' &&
    user?.onboardingComplete !== false &&
    user?.phoneVerified === false &&
    !HIDDEN_ON.includes(pathname) &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/marketing');

  useEffect(() => {
    if (!eligible || dismissed) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, dismissed]);

  if (!eligible || dismissed) return null;

  function close() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* prompt returns next visit */ }
    setDismissed(true);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="contact-prompt-title">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl">
        <h2 id="contact-prompt-title" className="font-display text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Add your mobile number
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          When someone unlocks your contact, this is the number they call. We verify it once so nobody reaches a wrong number.
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
        <button type="button" onClick={close} className="mt-5 text-sm text-neutral-500 hover:underline">
          Not now
        </button>
      </div>
    </div>
  );
}
