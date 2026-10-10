import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCamera, FiX, FiLock, FiShield } from 'react-icons/fi';

/**
 * The one thing this member should do next.
 *
 * Measured on 25 Aug 2026: six of fifteen live profiles had a photo. A
 * photoless profile is the first thing a family skips, and — because search
 * now sorts them last — it is also close to invisible. The setup checklist
 * only appears for members under 60% complete, so a fully-filled profile with
 * no picture had nothing telling it what was wrong.
 *
 * Exactly ONE prompt shows, in priority order — a photo first, then the
 * verified badge. Two stacked banners read as nagging and get ignored as a set,
 * and the second one is worthless until the first is done.
 *
 * Verification is prompted, never enforced: gating messages on a badge that
 * three members in fifteen hold would shut down the conversations the product
 * exists to start.
 *
 * Dismissal is per browser session, not permanent. The privacy line is not
 * decoration — "who will see it" is the actual reason people hold a photo back.
 */

// Copy lives in the `dashboard.nudge.<key>.*` strings, read at render.
// `noteTo`: the photo note names Settings → Privacy, so it opens that tab.
const PROMPTS = {
  photo: { icon: FiCamera, to: '/profile/edit?section=photos', noteTo: '/settings?tab=privacy' },
  verify: { icon: FiShield, to: '/verification' },
};

export default function PhotoNudge({ hasPhoto, isVerified = true, allow = ['photo', 'verify'] }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('profileNudgeDismissed') === '1';
    } catch {
      return false;
    }
  });

  // Priority order, one at a time — and only prompts the caller allows. The
  // dashboard already carries its own verification card further down the page,
  // so it opts out of that one rather than saying the same thing twice.
  const key = (!hasPhoto && allow.includes('photo'))
    ? 'photo'
    : ((!isVerified && allow.includes('verify')) ? 'verify' : null);
  if (!key || dismissed) return null;
  const prompt = PROMPTS[key];

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('profileNudgeDismissed', '1');
    } catch {
      /* private mode — the banner simply returns next navigation */
    }
  };

  return (
    <div className="relative rounded-2xl border border-primary-100 bg-primary-50/60 dark:bg-primary-900/10 dark:border-primary-900/40 p-5 pr-12">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dashboard.nudge.hide')}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-white/70 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <FiX className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
          <prompt.icon className="w-5 h-5 text-primary-700 dark:text-primary-300" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-bold text-neutral-900 dark:text-neutral-100">
            {t(`dashboard.nudge.${key}.title`)}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {t(`dashboard.nudge.${key}.body`)}
          </p>
          {prompt.noteTo ? (
            <p className="mt-0.5">
              <Link
                to={prompt.noteTo}
                className="min-h-[2.75rem] inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 underline underline-offset-2 hover:text-primary-700 dark:hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                <FiLock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                {t(`dashboard.nudge.${key}.note`)}
              </Link>
            </p>
          ) : (
            <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2 flex items-center gap-1.5">
              <FiLock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              {t(`dashboard.nudge.${key}.note`)}
            </p>
          )}
          <Link
            to={prompt.to}
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-primary-700 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
          >
            <prompt.icon className="w-4 h-4" aria-hidden="true" /> {t(`dashboard.nudge.${key}.cta`)}
          </Link>
        </div>
      </div>
    </div>
  );
}
