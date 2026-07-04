import React from 'react';
import { FiMail, FiPhone } from 'react-icons/fi';

/**
 * Detect whether a raw string is meant as an email or an Indian phone number.
 * - any letter or '@'        → email
 * - otherwise mostly digits  → phone
 * Returns 'email' | 'phone' | null (empty / ambiguous).
 */
export const detectContactType = (raw = '') => {
  const v = String(raw).trim();
  if (!v) return null;
  if (/[a-zA-Z@]/.test(v)) return 'email';
  if (/[0-9]/.test(v)) return 'phone';
  return null;
};

/** Strip a phone string down to the 10 national digits (drop +91 / 0 / spaces). */
export const phoneDigits = (raw = '') => {
  let d = String(raw).replace(/\D/g, '');
  if (d.length > 10 && d.startsWith('91')) d = d.slice(-10);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(-10);
};

/**
 * One smart field that accepts EITHER an email or a 10-digit mobile and shows a
 * live "+91" pill the moment it reads as a phone number. Keeps signup to a single
 * contact box. `value` is the raw user string; `type` is the detected kind.
 * Reused on Login via `id`/`label`/`hint` overrides — pass `hint` (string, may be
 * empty) to suppress the signup OTP helper copy.
 */
const SmartContactField = ({ value, onChange, onBlur, error, disabled, autoFocus, id = 'signup-identifier', label = 'Email or mobile number', hint }) => {
  const type = detectContactType(value);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {label} <span className="text-red-500">*</span>
      </label>
      <div
        className={`flex items-center rounded-xl border-2 bg-white dark:bg-neutral-900 transition-all focus-within:ring-2 focus-within:ring-primary-200 ${
          error ? 'border-red-400' : 'border-neutral-200 dark:border-neutral-700 focus-within:border-primary-500'
        }`}
      >
        <span className="pl-3.5 pr-1 text-neutral-400 flex-shrink-0">
          {type === 'phone' ? <FiPhone className="w-4 h-4" /> : <FiMail className="w-4 h-4" />}
        </span>
        {type === 'phone' && (
          <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 pl-1 pr-0.5 flex-shrink-0 select-none">+91</span>
        )}
        <input
          id={id}
          name="identifier"
          type="text"
          inputMode="text"
          autoComplete="username"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder="you@example.com or 98765 43210"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          className="flex-1 min-w-0 bg-transparent px-2.5 py-3 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : hint !== undefined ? (
        hint ? <p className="text-xs text-neutral-400">{hint}</p> : null
      ) : (
        <p className="text-xs text-neutral-400">
          {type === 'phone'
            ? 'We’ll text a one-time code to this number.'
            : type === 'email'
            ? 'We’ll email a one-time code to this address.'
            : 'Type an email or a 10-digit mobile — we detect which automatically.'}
        </p>
      )}
    </div>
  );
};

export default SmartContactField;
