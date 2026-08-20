import React, { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiCopy, FiLink, FiShare2, FiAlertCircle } from 'react-icons/fi';
import { getMyInviteLink } from '../../api/invite';
import { useAuth } from '../../context/AuthContext';

/**
 * Member invite link — the SEND half (Phase S, F6).
 *
 * Liquidity is the binding constraint, so the invite has to be one tap from the
 * places a member already stands: the dashboard (`card`), settings (`row`) and
 * the empty states that exist precisely because supply is thin (`inline`).
 *
 * The token is minted server-side on first read, so `card`/`row` fetch on mount
 * (they display the URL) while `inline` fetches on click — an empty state should
 * not mint a token for someone who never clicks.
 *
 * Copy path: `navigator.clipboard` where available, `document.execCommand`
 * fallback for non-secure contexts, and a visible URL as the last resort so the
 * link is never unreachable. `navigator.share` is offered ONLY where it exists
 * (mobile) — a dead share button is worse than none.
 */

const SHARE_TEXT = 'I’m on TricityMatch — a verified, Tricity-only matrimonial community. Join me:';

// Reward line. Rendered only when the server reports a live reward, and worded
// for both sides because that is what actually happens (utils/inviteReward.js
// credits the inviter and the invitee equally).
const rewardLine = (n) =>
  `You both get ${n} contact unlock${n === 1 ? '' : 's'} when they join.`;

const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
};

export default function InviteLink({ variant = 'card', className = '' }) {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  // Server-owned and env-tunable (INVITE_REWARD_UNLOCKS). 0 means the reward is
  // switched off — the invite still works, it just makes no claim, rather than
  // a hardcoded line that keeps promising unlocks nobody receives. Read off the
  // auth user so the `inline` variant can state the reward WITHOUT fetching:
  // that fetch mints an invite token, and an empty state must not mint one for
  // someone who never clicks.
  const reward = Number(user?.features?.inviteRewardUnlocks) > 0
    ? Number(user.features.inviteRewardUnlocks)
    : 0;
  const [state, setState] = useState(variant === 'inline' ? 'idle' : 'loading'); // idle|loading|ready|error
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const invite = await getMyInviteLink();
      setUrl(invite.url);
      setState('ready');
      return invite.url;
    } catch {
      setState('error');
      return '';
    }
  }, []);

  useEffect(() => {
    if (variant !== 'inline') load();
  }, [variant, load]);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    const link = url || (await load());
    if (!link) return;
    if (await copyToClipboard(link)) setCopied(true);
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const handleShare = async () => {
    const link = url || (await load());
    if (!link) return;
    try {
      await navigator.share({ title: 'TricityMatch', text: SHARE_TEXT, url: link });
    } catch {
      /* user dismissed the sheet — not an error */
    }
  };

  const copyLabel = copied ? 'Link copied' : 'Copy invite link';

  // ---- inline: one button, used inside empty states -------------------------
  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleCopy}
        disabled={state === 'loading'}
        className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl border border-primary-200 text-primary-700 bg-white hover:bg-primary-50 text-sm font-medium transition-colors disabled:opacity-60 ${className}`}
      >
        {copied ? <FiCheck className="w-4 h-4" /> : <FiLink className="w-4 h-4" />}
        {state === 'loading' ? 'Getting your link…' : copied ? 'Link copied' : 'Invite someone you know'}
      </button>
    );
  }

  // ---- row: a settings line -------------------------------------------------
  if (variant === 'row') {
    return (
      <div className={`flex items-center justify-between gap-4 py-3 ${className}`}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Invite someone to TricityMatch</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {state === 'error'
              ? 'Could not load your link.'
              : reward > 0
                ? rewardLine(reward)
                : 'Share your personal link — they’ll see your first name when they join.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canShare && state === 'ready' && (
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share invite link"
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <FiShare2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={state === 'error' ? load : handleCopy}
            disabled={state === 'loading'}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {copied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
            {state === 'error' ? 'Retry' : state === 'loading' ? 'Loading…' : copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    );
  }

  // ---- card: dashboard ------------------------------------------------------
  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
          <FiLink className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h3 className="font-serif text-lg text-neutral-900 dark:text-neutral-100 leading-tight">Grow the circle</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Every good match starts with someone you already trust. Send your invite link to a family
            or friend looking for a match in the Tricity.
          </p>
          {reward > 0 && (
            <p className="text-sm font-medium text-primary-700 dark:text-primary-300 mt-2">
              {rewardLine(reward)}
            </p>
          )}
        </div>
      </div>

      {state === 'error' ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <FiAlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span>Could not load your invite link.</span>
          <button type="button" onClick={load} className="text-primary-700 underline underline-offset-2 min-h-[44px]">
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2.5">
            <input
              readOnly
              aria-label="Your invite link"
              value={state === 'loading' ? 'Loading your link…' : url}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 bg-transparent text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none truncate"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={state === 'loading'}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {copied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
              {copyLabel}
            </button>
            {canShare && (
              <button
                type="button"
                onClick={handleShare}
                disabled={state === 'loading'}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm font-medium transition-colors disabled:opacity-60"
              >
                <FiShare2 className="w-4 h-4" /> Share
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
