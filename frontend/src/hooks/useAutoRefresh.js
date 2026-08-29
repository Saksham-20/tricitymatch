import { useEffect, useRef } from 'react';

/**
 * Poll a fetcher on an interval, and again whenever the tab regains focus.
 *
 * Referral figures move because of something happening elsewhere — a member
 * signing up on their phone, a payment clearing — so a dashboard left open on
 * a desk must not sit on a stale number until somebody reloads it.
 *
 * Polling pauses while the tab is hidden (no point burning requests against a
 * screen nobody is looking at) and fires once immediately on return, so the
 * first thing a returning user sees is current.
 *
 * @param {() => void|Promise<void>} fn      fetcher; kept in a ref so a new
 *                                           closure each render doesn't restart
 *                                           the interval
 * @param {number} intervalMs                default 20s
 * @param {boolean} enabled
 */
export default function useAutoRefresh(fn, intervalMs = 20000, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return undefined;

    let timer = null;
    const run = () => { if (!document.hidden) saved.current(); };
    const start = () => {
      if (timer) return;
      timer = setInterval(run, intervalMs);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) { stop(); return; }
      saved.current();
      start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [intervalMs, enabled]);
}
