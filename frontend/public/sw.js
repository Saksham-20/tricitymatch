/**
 * TricityMatch Service Worker
 *
 * What it does: keeps the static app shell and the site's own hashed assets so
 * the app opens fast and shows an offline page, and delivers web push.
 *
 * What it must NEVER do (audit P1-15): cache anything that belongs to a member.
 * Until this rewrite every GET under /api/ (except /auth/) was stored in Cache
 * Storage and replayed when the network failed, so profiles, matches, chat
 * threads and contact details sat on disk after logout and were served to the
 * next person on the browser. API responses, sockets, uploads and any request
 * carrying credentials now go straight to the network, uncached, always.
 */

// Bump the version suffix whenever caching behaviour changes: `activate` deletes
// every cache whose name is not listed here, which is what purges anything an
// earlier worker stored (including the old API-response cache).
const CACHE_NAME = 'tricitymatch-shell-v2';
const RUNTIME_CACHE = 'tricitymatch-runtime-v2';
const MAX_RUNTIME_ENTRIES = 120;

// Assets to cache on install (app shell)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

const STATIC_ASSET = /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)$/i;

// Paths that are per-member, per-session or realtime. Matched by prefix on the
// pathname; the list is a deny-list on top of "only static assets are cached",
// so a mistake here fails safe.
const NEVER_CACHE_PREFIXES = ['/api/', '/socket.io/', '/uploads/', '/monitoring', '/health'];

const neverCache = (request, url) =>
  NEVER_CACHE_PREFIXES.some((p) => url.pathname === p.replace(/\/$/, '') || url.pathname.startsWith(p))
  // A request that carries credentials explicitly is a member's request.
  || request.headers.has('Authorization');

// Only responses that are safe to keep: a plain success from our own origin that
// did not ask to be kept private.
const cacheable = (response) => {
  if (!response || !response.ok || response.type !== 'basic') return false;
  const cc = (response.headers.get('Cache-Control') || '').toLowerCase();
  return !/(?:no-store|private)/.test(cc);
};

const trim = async (cache, max) => {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
};

// Cache first, network fallback. Static assets only.
const cacheFirst = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (cacheable(response)) {
      await cache.put(request, response.clone());
      await trim(cache, MAX_RUNTIME_ENTRIES);
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
};

// Navigations: network first; when offline, fall back to the app shell. The SPA
// serves one HTML document for every route, so exactly that document is what is
// kept (under one key) -- never a per-URL copy of whatever the server returned.
const navigate = async (request) => {
  try {
    const response = await fetch(request);
    const type = (response.headers.get('Content-Type') || '').toLowerCase();
    if (cacheable(response) && type.includes('text/html')) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch (error) {
    const shell = await caches.match('/index.html');
    return shell || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
};

// Install event - cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - delete every cache that is not one of the current two
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
        .map((name) => caches.delete(name))
    ))
  );
  // Take control immediately
  self.clients.claim();
});

// Fetch event - intercept requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only plain GETs are ever considered.
  if (request.method !== 'GET') return;

  // Same origin only. Cloudinary (member photos, signed and expiring) used to be
  // cached forever here; it is now left to the browser's own HTTP cache.
  if (url.origin !== self.location.origin) return;

  // Anything that is a member's data or a live connection: not ours to keep.
  if (neverCache(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }

  if (STATIC_ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
  // Everything else: not intercepted.
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'TricityMatch', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // The payload comes from the push service; only ever open a page on this site.
  let url = '/';
  try {
    const target = new URL(event.notification.data?.url || '/', self.location.origin);
    if (target.origin === self.location.origin) url = target.pathname + target.search + target.hash;
  } catch (error) {
    url = '/';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's an open window, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
