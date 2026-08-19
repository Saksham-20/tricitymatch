/**
 * ReplyMeter — DS3: muted inline strip under the composer showing free-reply
 * budget. Neutral until ≤2 remaining, then warning tone (the ONLY place gold
 * may appear in the meter). Announces changes politely for screen readers.
 */

const ReplyMeter = ({ replyWindow }) => {
  if (!replyWindow) return null;
  const { messagesRemaining, expiresAt, active } = replyWindow;
  if (!active) return null;

  const low = messagesRemaining <= 2;
  const expiry = expiresAt
    ? new Date(expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div
      aria-live="polite"
      className={`mt-2 flex items-center gap-2 text-xs px-1 ${
        low ? 'text-gold-700 dark:text-gold-400 font-medium' : 'text-neutral-400'
      }`}
    >
      <span className="tabular-nums">
        {messagesRemaining} free {messagesRemaining === 1 ? 'reply' : 'replies'} left
      </span>
      {expiry && <span aria-hidden="true">·</span>}
      {expiry && <span>window closes {expiry}</span>}
    </div>
  );
};

export default ReplyMeter;
