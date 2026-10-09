/**
 * FirstReplyUpsell — DS3: dismissible inline card shown in-thread after the
 * free member's FIRST reply (never a modal), once per pair (localStorage).
 */

import { Link } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { Trans, useTranslation } from 'react-i18next';

export const upsellSeenKey = (pairUserId) => `tm_first_reply_upsell_${pairUserId}`;

const FirstReplyUpsell = ({ name, remaining, onDismiss }) => {
  const { t } = useTranslation();
  const firstName = name?.split(' ')[0];
  return (
  <div className="my-3 mx-auto max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-surface-dark-3 px-4 py-3 flex items-start gap-3">
    <div className="flex-1 min-w-0">
      <p className="text-sm text-neutral-700 dark:text-neutral-200">
        <Trans
          i18nKey={firstName ? 'chat.upsell.sent' : 'chat.upsell.sentThem'}
          count={remaining}
          values={{ name: firstName }}
          components={{ b: <span className="font-semibold tabular-nums" /> }}
        />
      </p>
      <Link to="/subscription" className="inline-flex items-center min-h-[2.75rem] -my-2 mt-1 text-sm font-medium text-primary-700 hover:text-primary-800">
        {t('chat.upsell.chatWithoutLimits')}
      </Link>
    </div>
    {/* min-w/min-h in rem (doctrine §3.5): pad the invisible hit area to
        44px/48px-elder without growing the visual X mark. */}
    <button onClick={onDismiss} aria-label={t('chat.upsell.dismiss')} className="flex items-center justify-center min-w-[2.75rem] min-h-[2.75rem] -m-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 flex-shrink-0">
      <FiX className="w-4 h-4" />
    </button>
  </div>
  );
};

export default FirstReplyUpsell;
