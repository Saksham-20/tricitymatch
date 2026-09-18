/**
 * PaywalledComposer — DS1: the scripted end-of-window composer, NOT a generic
 * upsell. Two variants keyed on why the window ended; carries the other
 * person's name + avatar; the thread above stays readable (grant = read
 * forever). Gold on the CTA only. Never shown to the premium side.
 */

import { Link } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';

const PaywalledComposer = ({ name, avatarUrl, reason }) => {
  const headline = reason === 'expired'
    ? 'Your 48-hour reply window ended'
    : "You've used your 5 free replies";

  return (
    <div className="rounded-2xl border border-gold-200 dark:border-gold-700/40 bg-white dark:bg-surface-dark-3 px-4 py-4">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 font-semibold flex-shrink-0">
            {(name || '?')[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
            <FiLock className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
            {headline}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {name} can still write to you. Upgrade to keep the conversation going.
          </p>
        </div>
        {/* Gold CTA fill needs dark text, not white (doctrine §3.1 contrast
            floor) — white on gold-500 is ~2.4:1, primary-900 on gold-500 is
            ~7.5:1. Matches the established .btn-gold pairing (dark text on
            gold) without introducing a new hardcoded hex. rounded-xl, not
            rounded-full: this is a primary CTA (doctrine Ruling 6), not a
            chip/badge/filter token. */}
        <Link
          to="/subscription"
          className="flex-shrink-0 inline-flex items-center justify-center min-h-[2.75rem] px-5 rounded-xl bg-gold-500 hover:bg-gold-600 text-primary-900 text-sm font-semibold transition-colors"
        >
          Keep talking with {name?.split(' ')[0] || 'them'}
        </Link>
      </div>
    </div>
  );
};

export default PaywalledComposer;
