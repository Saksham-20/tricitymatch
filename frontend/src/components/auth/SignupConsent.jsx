import React from 'react';
import CheckBox from '../ui/CheckBox';

/**
 * What a new member agrees to, shared by every way of creating an account
 * (email or phone signup, Google), so the record means the same thing however
 * the account was made. DPDP notice itemised in plain text with the request
 * (Legal Review B-1); Terms required; promotional email optional and unticked.
 */
export const ConsentNotice = () => (
  <div className="rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 p-4 sm:p-5">
    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
      <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">What we will do with your information</span>
      We use your profile details, including religion, caste, horoscope details and photographs where you choose to give them, to show your profile to other members and to suggest matches. We use your email and mobile number to sign you in, send one-time passcodes and security alerts, and to tell you about matches and messages. We never sell your data and never use it for advertising. You can see, correct, export or erase it at any time, and you can delete your account yourself.
    </p>
  </div>
);

export const TermsCheckbox = ({ checked, onChange, error }) => (
  <div>
    <CheckBox
      checked={!!checked}
      onChange={onChange}
      size="md"
      label={
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          This account is for finding a marriage partner, not for dating, and I agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-300 underline hover:text-primary-700">Terms &amp; Conditions</a>{' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-300 underline hover:text-primary-700">Privacy Policy</a>.
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
    label={<span className="text-sm text-neutral-600 dark:text-neutral-300">Email me reminders and suggestions about matches (optional).</span>}
  />
);
