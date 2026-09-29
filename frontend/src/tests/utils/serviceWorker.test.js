/**
 * The service worker must never keep a member's data (audit P1-15).
 *
 * The real file is executed in a sandbox with a fake worker global, so this
 * exercises what ships rather than a copy of its rules.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const SRC = readFileSync(resolve(__dirname, '../../../public/sw.js'), 'utf8');
const ORIGIN = 'https://tricitymatch.com';

const makeHeaders = (init = {}) => {
  const map = new Map(Object.entries(init).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (k) => map.get(k.toLowerCase()) ?? null, has: (k) => map.has(k.toLowerCase()) };
};

const makeResponse = ({ ok = true, type = 'basic', headers = {}, body = 'x' } = {}) => ({
  ok, type, headers: makeHeaders(headers), body, clone() { return this; },
});

function boot({ fetchImpl } = {}) {
  const stores = new Map(); // cacheName -> Map(key -> response)
  const listeners = {};
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  const keyOf = (req) => (typeof req === 'string' ? req : req.url);
  const caches = {
    open: async (name) => {
      const m = store(name);
      return {
        match: async (req) => m.get(keyOf(req)),
        put: async (req, res) => { m.set(keyOf(req), res); },
        add: async () => {},
        addAll: async (list) => { list.forEach((u) => m.set(u, makeResponse())); },
        keys: async () => [...m.keys()],
        delete: async (k) => m.delete(k),
      };
    },
    match: async (req) => { for (const m of stores.values()) { const v = m.get(keyOf(req)); if (v) return v; } return undefined; },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };
  const fetched = [];
  const opened = [];
  const sandbox = {
    self: {
      addEventListener: (type, fn) => { listeners[type] = fn; },
      location: { origin: ORIGIN },
      skipWaiting: () => {},
      clients: { claim: () => {}, matchAll: async () => [], openWindow: async (u) => { opened.push(u); } },
      registration: { showNotification: () => {} },
    },
    caches,
    fetch: async (req) => { fetched.push(req.url); return (fetchImpl || (() => makeResponse()))(req); },
    Response: class { constructor(body, init = {}) { Object.assign(this, { body, ok: (init.status ?? 200) < 400, type: 'basic', status: init.status ?? 200, headers: makeHeaders(init.headers), clone: () => this }); } },
    URL, console,
  };
  sandbox.location = sandbox.self.location;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { stores, listeners, fetched, caches, opened };
}

const request = (path, { method = 'GET', mode = 'cors', headers = {}, origin = ORIGIN } = {}) => ({
  url: `${origin}${path}`, method, mode, headers: makeHeaders(headers),
});

// Run the fetch listener; returns the response promise if the worker took the request.
const dispatch = async (sw, req) => {
  let handled = null;
  sw.listeners.fetch({ request: req, respondWith: (p) => { handled = p; } });
  return handled ? { handled: true, response: await handled } : { handled: false };
};

const allCachedUrls = (sw) => [...sw.stores.values()].flatMap((m) => [...m.keys()]);

describe('service worker caching policy', () => {
  let sw;
  beforeEach(() => { sw = boot(); });

  it('does not intercept API requests, so they can never be stored', async () => {
    for (const path of ['/api/v1/profile/me', '/api/v1/chat/messages/abc', '/api/v1/profile/abc/horoscope-match/pdf', '/api/auth/me']) {
      const out = await dispatch(sw, request(path));
      expect(out.handled).toBe(false);
    }
    expect(allCachedUrls(sw).filter((u) => u.includes('/api/'))).toEqual([]);
  });

  it('does not intercept sockets, uploads or monitoring', async () => {
    for (const path of ['/socket.io/?EIO=4', '/uploads/photo.jpg', '/monitoring/health/full']) {
      expect((await dispatch(sw, request(path))).handled).toBe(false);
    }
  });

  it('does not intercept a request that carries an Authorization header, even for a static-looking path', async () => {
    const out = await dispatch(sw, request('/private.png', { headers: { Authorization: 'Bearer x' } }));
    expect(out.handled).toBe(false);
  });

  it('leaves other origins (member photos on Cloudinary) alone', async () => {
    const out = await dispatch(sw, request('/image/authenticated/s--sig--/photo.jpg', { origin: 'https://res.cloudinary.com' }));
    expect(out.handled).toBe(false);
  });

  it('ignores non-GET requests', async () => {
    expect((await dispatch(sw, request('/assets/app.js', { method: 'POST' }))).handled).toBe(false);
  });

  it('caches our own static assets, and only plain successful ones', async () => {
    const first = await dispatch(sw, request('/assets/app-abc123.js'));
    expect(first.handled).toBe(true);
    expect(allCachedUrls(sw)).toContain(`${ORIGIN}/assets/app-abc123.js`);

    const noStore = boot({ fetchImpl: () => makeResponse({ headers: { 'Cache-Control': 'private, no-store' } }) });
    await dispatch(noStore, request('/assets/secret.js'));
    expect(allCachedUrls(noStore)).not.toContain(`${ORIGIN}/assets/secret.js`);

    const failed = boot({ fetchImpl: () => makeResponse({ ok: false }) });
    await dispatch(failed, request('/assets/missing.js'));
    expect(allCachedUrls(failed)).not.toContain(`${ORIGIN}/assets/missing.js`);
  });

  it('keeps one app-shell document for navigations, not a copy per URL', async () => {
    const shell = boot({ fetchImpl: () => makeResponse({ headers: { 'Content-Type': 'text/html; charset=utf-8' } }) });
    await dispatch(shell, request('/profile/some-member-id', { mode: 'navigate' }));
    await dispatch(shell, request('/chat', { mode: 'navigate' }));
    const cached = allCachedUrls(shell);
    expect(cached.some((u) => u.includes('some-member-id'))).toBe(false);
    expect(cached).toContain('/index.html');
  });

  it('falls back to the cached shell when offline', async () => {
    const offline = boot({ fetchImpl: () => { throw new Error('offline'); } });
    await offline.listeners.install({ waitUntil: (p) => p });
    const out = await dispatch(offline, request('/dashboard', { mode: 'navigate' }));
    expect(out.response.body).toBe('x'); // the precached index.html
  });

  it('activation deletes every cache from an earlier version, including the old API cache', async () => {
    sw.stores.set('tricitymatch-runtime-v1', new Map([[`${ORIGIN}/api/v1/profile/me`, makeResponse()]]));
    sw.stores.set('tricitymatch-v1', new Map());
    sw.stores.set('tricitymatch-runtime-v2', new Map());
    let done;
    sw.listeners.activate({ waitUntil: (p) => { done = p; } });
    await done;
    const names = [...sw.stores.keys()];
    expect(names).not.toContain('tricitymatch-runtime-v1');
    expect(names).not.toContain('tricitymatch-v1');
    expect(names).toContain('tricitymatch-runtime-v2');
  });

  it('caps the runtime cache', async () => {
    for (let i = 0; i < 130; i += 1) await dispatch(sw, request(`/assets/chunk-${i}.js`));
    expect(sw.stores.get('tricitymatch-runtime-v2').size).toBeLessThanOrEqual(120);
  });

  it('a push notification click only ever opens this site', async () => {
    const click = async (url) => {
      const w = boot();
      let done;
      w.listeners.notificationclick({
        action: 'open',
        notification: { close: () => {}, data: { url } },
        waitUntil: (p) => { done = p; },
      });
      await done;
      return w.opened;
    };
    expect(await click('https://evil.example/phish')).toEqual(['/']);
    expect(await click('//evil.example/x')).toEqual(['/']);
    expect(await click('/chat?with=abc')).toEqual(['/chat?with=abc']);
    expect(await click(undefined)).toEqual(['/']);
  });
});
