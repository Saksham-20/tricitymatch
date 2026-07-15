import { useEffect } from 'react';

/**
 * Guard against silently losing unsaved edits. This app uses a declarative
 * <BrowserRouter> (not a data router), so react-router's `useBlocker` is
 * unavailable — instead we cover the three real loss vectors:
 *   1. tab close / refresh        → beforeunload
 *   2. browser Back within the SPA → popstate (re-armed sentinel)
 *   3. clicking an internal link   → capture-phase document click
 *
 * When dirty, an internal navigation attempt is intercepted and handed to
 * `onNavigateAttempt(destination)` (a URL string, or the sentinel '__back__'
 * for the Back button) so the caller can show a confirm dialog. When clean,
 * nothing is intercepted and navigation flows normally.
 *
 * @param {boolean}  isDirty            whether there are unsaved edits
 * @param {function} onNavigateAttempt  called with the pending destination
 */
export default function useUnsavedChangesGuard(isDirty, onNavigateAttempt) {
  // 1. Native tab-close / refresh prompt (browser-controlled copy).
  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // 2. Browser Back — keep a sentinel history entry so a back press pops the
  // sentinel (leaving us on this page) and we can prompt instead of leaving.
  useEffect(() => {
    if (!isDirty) return undefined;
    window.history.pushState(null, '', window.location.href);
    const onPop = () => {
      onNavigateAttempt('__back__');
      // Re-arm so a second Back press is still caught until the user decides.
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isDirty, onNavigateAttempt]);

  // 3. Internal links (BottomNav, navbar, any <a>) — intercept in the capture
  // phase before react-router's handler runs.
  useEffect(() => {
    if (!isDirty) return undefined;
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target.closest?.('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      // Only guard same-origin, in-app navigations.
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      onNavigateAttempt(url.pathname + url.search);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isDirty, onNavigateAttempt]);
}
