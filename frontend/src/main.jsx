import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import './index.css'
import { i18nReady } from './i18n'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  }).catch(() => {
    // Ignore errors while cleaning up stale dev service workers.
  });
}

// Service worker registration. Moved here from an inline <script> in
// index.html so the production CSP can keep script-src at 'self' — an inline
// script would force 'unsafe-inline'. Behaviour is unchanged: still skipped on
// localhost, still deferred until after load.
//
// The URL carries a version on purpose. Cloudflare's edge kept serving the
// first worker (cached under plain `/sw.js` with a year-long immutable header)
// long after the origin shipped its replacement, and browsers never saw the
// new one. That old worker re-fetched every Cloudinary photo from inside the
// worker, where the CSP's connect-src does not allow Cloudinary, and answered
// "503 Offline" — so photos were broken across the whole site. A new script
// URL is a new edge-cache key, and registering it in the same scope replaces
// the old worker, whose activate step then deletes its caches.
// Bump SW_VERSION whenever public/sw.js changes.
const SW_VERSION = '2';
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}`, { updateViaCache: 'none' }).catch(() => {
      // A failed registration must never break the app; the SPA works without it.
    });
  });
}

// Hindi/Punjabi strings are fetched on demand; wait for the chosen language so
// the first paint is never a mix of keys and English. English resolves at once.
i18nReady.finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </React.StrictMode>,
  );
});

