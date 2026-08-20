import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import './index.css'
import './i18n'

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
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A failed registration must never break the app; the SPA works without it.
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
)

