import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { google as googleConfig } from '../../config';
import { loadGoogleIdentity } from '../../utils/googleIdentity';
import { ConsentNotice, TermsCheckbox, MarketingCheckbox } from './SignupConsent';

const errorCode = (err) => err?.response?.data?.error?.code || err?.response?.data?.code;
const errorText = (err, fallback) =>
  err?.response?.data?.error?.message || err?.response?.data?.message || fallback;

/**
 * "Sign in with Google" for the login page and the signup page.
 *
 * An existing member is signed straight in. Someone new is NOT given an account
 * on an implied "by continuing you agree": the server answers
 * GOOGLE_CONSENT_REQUIRED and this shows the same consent email and phone
 * signup ask for (Terms with the marriage-intent statement, the data notice,
 * optional promotional email), then sends the same Google credential again.
 *
 * Renders nothing unless VITE_GOOGLE_CLIENT_ID is a real client ID.
 *
 * @param {object} props
 * @param {'signin_with'|'signup_with'|'continue_with'} [props.text]
 * @param {string} [props.referralCode]  partner or member code to credit
 * @param {string} [props.invite]        member invite token
 * @param {(user: object, isNewUser: boolean) => void} props.onSuccess
 */
const GoogleSignIn = ({ text = 'continue_with', referralCode, invite, onSuccess }) => {
  const { setUser } = useAuth();
  const buttonRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null); // { credential, email } awaiting consent
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [agreeError, setAgreeError] = useState('');

  // Latest values for the GIS callback, which is registered once per mount.
  const latest = useRef({});
  latest.current = { referralCode, invite, onSuccess };

  const finish = useCallback((data) => {
    if (data?.user) {
      setUser(data.user);
      try { localStorage.setItem('tricitymatch-auth-hint', '1'); } catch { /* storage blocked */ }
    }
    latest.current.onSuccess?.(data?.user, !!data?.isNewUser);
  }, [setUser]);

  const submit = useCallback(async (credential, consent) => {
    setBusy(true);
    setError('');
    try {
      const { referralCode: code, invite: token } = latest.current;
      const res = await api.post('/auth/google', {
        credential,
        ...(code ? { referralCode: code } : {}),
        ...(token ? { invite: token } : {}),
        ...(consent ? { termsAccepted: true, marketingConsent: !!consent.marketing } : {}),
      });
      setPending(null);
      finish(res.data);
    } catch (err) {
      if (errorCode(err) === 'GOOGLE_CONSENT_REQUIRED') {
        setPending({ credential });
      } else if (err?.response?.status === 401 && consent) {
        // Google's token lasts about an hour; a long pause on the consent step
        // outlives it.
        setPending(null);
        setError('That Google sign-in has expired. Please choose your Google account again.');
      } else {
        setError(errorText(err, 'Google sign-in failed. Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  }, [finish]);

  useEffect(() => {
    if (!googleConfig.isConfigured) return undefined;
    let cancelled = false;
    loadGoogleIdentity()
      .then((g) => {
        if (cancelled || !buttonRef.current || !g?.accounts?.id) return;
        g.accounts.id.initialize({
          client_id: googleConfig.clientId,
          callback: (response) => submit(response.credential, null),
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        const width = Math.min(400, Math.max(200, buttonRef.current.offsetWidth || 320));
        g.accounts.id.renderButton(buttonRef.current, {
          theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          width,
          logo_alignment: 'center',
        });
      })
      .catch(() => { if (!cancelled) setError('Google sign-in could not load. Use your email or mobile number instead.'); });
    return () => { cancelled = true; };
  }, [submit, text]);

  if (!googleConfig.isConfigured) return null;

  const createAccount = () => {
    if (!agree) {
      setAgreeError('Please accept the Terms and Privacy Policy to create your account');
      return;
    }
    submit(pending.credential, { marketing });
  };

  return (
    <div className="space-y-3">
      <div
        ref={buttonRef}
        className={`flex justify-center min-h-[44px] ${busy || pending ? 'opacity-60 pointer-events-none' : ''}`}
        aria-busy={busy || undefined}
      />

      {pending && (
        <div className="space-y-4 rounded-2xl border-2 border-primary-200 dark:border-primary-900 p-4 sm:p-5" role="group" aria-labelledby="google-consent-title">
          <div>
            <p id="google-consent-title" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Create your account with Google</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">There is no TricityMatch account for this Google account yet. Please read and agree before we create one.</p>
          </div>
          <ConsentNotice />
          <TermsCheckbox checked={agree} onChange={(v) => { setAgree(v); if (v) setAgreeError(''); }} error={agreeError} />
          <MarketingCheckbox checked={marketing} onChange={setMarketing} />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button type="button" onClick={() => { setPending(null); setAgree(false); setAgreeError(''); }} className="btn-secondary text-sm" disabled={busy}>
              Cancel
            </button>
            <button type="button" onClick={createAccount} className="btn-primary text-sm" disabled={busy}>
              {busy ? 'Creating your account…' : 'Create my account'}
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive dark:text-red-300">{error}</p>}
    </div>
  );
};

export default GoogleSignIn;
