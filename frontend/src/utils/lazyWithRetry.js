import { lazy } from 'react';

// Wrap React.lazy so a failed dynamic import recovers gracefully.
//
// Why: routes are code-split into hashed chunks. Every frontend deploy renames
// those chunks, so a user who had a tab open before the deploy will, on their
// next navigation, request a chunk filename that no longer exists on the server
// → ChunkLoadError. Without handling, that crashes into the ErrorBoundary and
// the user is stuck on a static error screen. The fix is to reload the page
// once so the browser fetches the fresh index.html + chunk manifest.
//
// A sessionStorage flag guards against an infinite reload loop: if the import
// still fails after one reload (genuinely offline, or the chunk is really gone),
// we stop retrying and let the error propagate to the ErrorBoundary.
export default function lazyWithRetry(importer) {
  return lazy(async () => {
    const KEY = 'chunk-reload-attempted';
    try {
      const mod = await importer();
      sessionStorage.removeItem(KEY); // success → clear the guard for next time
      return mod;
    } catch (err) {
      const isChunkError =
        err?.name === 'ChunkLoadError' ||
        /Loading chunk|dynamically imported module|Failed to fetch dynamically/i.test(
          err?.message || ''
        );
      if (isChunkError && !sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
        // Suspend forever — the reload replaces this page before this resolves.
        return new Promise(() => {});
      }
      throw err;
    }
  });
}
