import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Segmented OTP input — auto-advance, backspace-to-previous, arrow nav, and
 * full paste support. Controlled via `value` (string) + `onChange`. Fires
 * `onComplete(code)` when all boxes are filled. Brand-styled (burgundy focus
 * ring, gold-free) and dark-mode aware.
 */
const OtpBoxes = ({
  length = 6,
  value = '',
  onChange = () => {},
  onComplete = () => {},
  disabled = false,
  error = false,
  autoFocus = false,
  ariaLabel,
}) => {
  const { t } = useTranslation();
  const refs = useRef([]);
  const chars = value.split('').slice(0, length);
  while (chars.length < length) chars.push('');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const emit = (next) => {
    const code = next.join('');
    onChange(code);
    if (code.length === length && next.every((c) => c !== '')) onComplete(code);
  };

  // Spread several digits over the boxes from `start`; a whole code always
  // starts at the first box, wherever it was dropped.
  const fill = (start, digits) => {
    const from = digits.length >= length ? 0 : start;
    const next = [...chars];
    digits.slice(0, length - from).split('').forEach((c, idx) => { next[from + idx] = c; });
    emit(next);
    refs.current[Math.min(from + digits.length, length - 1)]?.focus();
  };

  const handleChange = (i, raw) => {
    if (disabled) return;
    const digits = raw.replace(/\D/g, '');
    // The OS one-time-code autofill (and a keyboard's "paste code" chip) puts
    // the whole code into one box in a single change. Two digits in a box that
    // already held one is plain typing over it, handled below.
    if (digits.length > 2 || (digits.length === 2 && !chars[i])) {
      fill(i, digits);
      return;
    }
    const digit = digits.slice(-1);
    const next = [...chars];
    next[i] = digit;
    emit(next);
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (disabled) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...chars];
      if (chars[i]) {
        next[i] = '';
        emit(next);
      } else if (i > 0) {
        next[i - 1] = '';
        emit(next);
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    if (disabled) return;
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    const next = new Array(length).fill('');
    pasted.split('').forEach((c, idx) => { next[idx] = c; });
    emit(next);
    const focusIdx = Math.min(pasted.length, length - 1);
    refs.current[focusIdx]?.focus();
  };

  return (
    // Boxes share the row and cap at 3rem, so six of them fit a 320px phone
    // instead of pushing the page sideways (fixed widths did).
    <div className="flex w-full gap-2 sm:gap-2.5" onPaste={handlePaste} role="group" aria-label={ariaLabel ?? t('signup.otpAria')}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          /* Room for a whole code, so an autofilled code is not cut to its
             first digit; handleChange spreads it over the boxes. */
          maxLength={length}
          value={c}
          disabled={disabled}
          aria-label={t('signup.otpDigit', { n: i + 1 })}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={`flex-1 min-w-0 max-w-[3rem] h-12 sm:h-14 text-center text-xl font-semibold rounded-xl border-2 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 transition-[border-color,box-shadow] duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
            error
              ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
              : c
              ? 'border-primary-500 focus:border-primary-600 focus:ring-2 focus:ring-primary-200'
              : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 focus:border-primary-500 focus:ring-2 focus:ring-primary-200'
          }`}
        />
      ))}
    </div>
  );
};

export default OtpBoxes;
