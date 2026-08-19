/**
 * FirstReplyUpsell — DS3: dismissible inline card shown in-thread after the
 * free member's FIRST reply (never a modal), once per pair (localStorage).
 */

import { Link } from 'react-router-dom';
import { FiX } from 'react-icons/fi';

export const upsellSeenKey = (pairUserId) => `tm_first_reply_upsell_${pairUserId}`;

const FirstReplyUpsell = ({ name, remaining, onDismiss }) => (
  <div className="my-3 mx-auto max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1a1f2e] px-4 py-3 flex items-start gap-3 shadow-sm">
    <div className="flex-1 min-w-0">
      <p className="text-sm text-neutral-700 dark:text-neutral-200">
        Reply sent. You have <span className="font-semibold tabular-nums">{remaining}</span> free{' '}
        {remaining === 1 ? 'reply' : 'replies'} left with {name?.split(' ')[0] || 'them'} over the next 48 hours.
      </p>
      <Link to="/subscription" className="inline-block mt-1 text-sm font-medium text-primary-700 hover:text-primary-800">
        Chat without limits →
      </Link>
    </div>
    <button onClick={onDismiss} aria-label="Dismiss" className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 flex-shrink-0">
      <FiX className="w-4 h-4" />
    </button>
  </div>
);

export default FirstReplyUpsell;
