/**
 * ReplyMeter — DS3: muted inline strip under the composer showing free-reply
 * budget. Neutral until ≤2 remaining, then a warning chip (the semantic
 * warning token, never gold). Announces changes politely for screen readers.
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
      className={`mt-2 flex items-center gap-2 text-xs ${
        low
          ? 'rounded-lg px-2 py-1 bg-warning/10 dark:bg-warning/15 border border-warning/20 text-warning dark:text-amber-300 font-medium'
          : 'px-1 text-neutral-400'
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
