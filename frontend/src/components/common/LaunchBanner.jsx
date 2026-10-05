import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { launchPhase, launchDateLabel } from '../../utils/launchDate';

/**
 * Public-launch announcement, shown on the pages a first-time visitor lands on.
 *
 * Sits in normal flow directly under the fixed Navbar (which brings its own
 * spacer), so nothing needs to know its height and it scrolls away with the page
 * instead of costing permanent viewport on a phone.
 *
 * It retires itself: from the day after launch `launchPhase` reports `after` and
 * the component renders nothing, with no deploy and no flag to remember. The
 * copy tracks the countdown, so a banner that says "launches on 11 October" is
 * never still on screen on the 12th.
 *
 * Dismissal is remembered per phase, so someone who closed it last week still
 * sees "launches today" on the day itself.
 */

const STORAGE_KEY = 'tm_launch_banner_dismissed';

const wasDismissed = (phase) => {
  try { return window.localStorage.getItem(STORAGE_KEY) === phase; } catch { return false; }
};
const rememberDismissed = (phase) => {
  try { window.localStorage.setItem(STORAGE_KEY, phase); } catch { /* private mode: dismissal lasts for this view only */ }
};

const messageFor = ({ phase, days }, label) => {
  if (phase === 'today') {
    return { lead: 'TricityMatch launches today.', rest: 'Start meeting families across the Tricity.' };
  }
  if (days === 1) {
    return { lead: `TricityMatch launches tomorrow, ${label}.`, rest: 'Be ready on day one.' };
  }
  return { lead: `TricityMatch launches on ${label}.`, rest: 'Be ready on day one.' };
};

export default function LaunchBanner({ authenticated = false, now }) {
  const state = launchPhase(now);
  const [hidden, setHidden] = useState(() => wasDismissed(state.phase));

  if (state.phase === 'after' || hidden) return null;

  const { lead, rest } = messageFor(state, launchDateLabel());
  // A member is already in; the nudge to get ready is for visitors.
  const showRest = !authenticated;

  const dismiss = () => {
    rememberDismissed(state.phase);
    setHidden(true);
  };

  return (
    <div
      role="region"
      aria-label="Launch announcement"
      className="launch-banner relative bg-primary-600 text-white"
    >
      {/* Right padding reserves the dismiss target so wrapped text never runs under it. */}
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pl-4 pr-14 sm:px-14 py-2.5 text-sm text-center">
        <p className="leading-snug">
          <span className="font-semibold">{lead}</span>{' '}
          {showRest && <span className="text-white/90">{rest}</span>}
        </p>
        {!authenticated && (
          <Link
            to="/onboarding"
            className="font-semibold underline underline-offset-2 hover:text-white/80 whitespace-nowrap rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
          >
            Create your profile
          </Link>
        )}
      </div>
      {/* The glyph is small; the 44px (48px in elder mode) button is the target. */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss launch announcement"
        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] [html.elder_&]:min-h-[48px] [html.elder_&]:min-w-[48px] rounded text-white/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <FiX size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
