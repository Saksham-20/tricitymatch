/**
 * Route manifest — the server's own list of what it serves.
 *
 * Why this exists
 * ---------------
 * The recurring bug class in this repo is the RN client calling a path the
 * backend does not serve, or unwrapping a response envelope that does not
 * match. It has landed at least four times: `/match/matches` vs `/match/mutual`,
 * `/chat/:id` vs `/chat/messages/:id`, `getPlans` returning an object where the
 * screen mapped an array, and `getMe` reading the envelope instead of `.user`.
 * Every one shipped, because unit tests on the client mock axios — and when the
 * path is wrong, THE MOCK IS THE WRONG THING. A mocked test agrees with the bug.
 *
 * So the truth has to come from the server. This test walks the real Express
 * router and writes the manifest to disk; the mobile suite asserts its api layer
 * against that file. A path that no longer exists fails on the client side at
 * CI time rather than on a device at 11pm.
 *
 * Regenerating: run the backend suite. The manifest is a build artifact of this
 * test, deliberately committed so the mobile workspace can read it without
 * booting a server.
 */

const fs = require('fs');
const path = require('path');

// server.js: app.use('/api/v1', routes) and app.use('/api', routes).
const API_PREFIX = '/api/v1';
const API_ALIAS = '/api';

const MANIFEST_PATH = path.join(__dirname, '..', '..', '..', 'shared', 'src', 'constants', 'api-manifest.json');

/**
 * Express stores mounted sub-routers as layers whose `regexp` encodes the mount
 * path. There is no public API for recovering it, so decode the pattern back to
 * a literal prefix. Anything that does not decode cleanly is reported rather
 * than silently dropped — a silently dropped route is a false PASS downstream.
 */
const mountPathOf = (layer) => {
  if (layer.path) return layer.path;
  const src = layer.regexp && layer.regexp.source;
  if (!src) return '';
  if (src === '^\\/?(?=\\/|$)') return ''; // mounted at '/'
  const m = src.match(/^\^\\\/(.*?)\\\/\?\(\?=\\\/\|\$\)$/);
  if (!m) return null;
  return '/' + m[1].replace(/\\\//g, '/').replace(/\\\./g, '.');
};

const walk = (stack, prefix, out, unresolved) => {
  for (const layer of stack) {
    if (layer.route) {
      const routePath = prefix + layer.route.path;
      for (const method of Object.keys(layer.route.methods)) {
        if (method === '_all') continue;
        out.add(`${method.toUpperCase()} ${routePath}`);
      }
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      const mount = mountPathOf(layer);
      if (mount === null) {
        unresolved.push(layer.regexp && layer.regexp.source);
        continue;
      }
      walk(layer.handle.stack, prefix + mount, out, unresolved);
    }
  }
};

describe('route manifest', () => {
  let routes;
  let unresolved;

  beforeAll(() => {
    const router = require('../../routes');
    const out = new Set();
    unresolved = [];
    // server.js mounts this same router twice: at '/api/v1' (canonical) and at
    // '/api' (kept for shipped clients). The manifest records the canonical
    // prefix only — a client calling the bare '/api' alias still works, but new
    // code should not, and the conformance test tolerates either.
    walk(router.stack, API_PREFIX, out, unresolved);
    routes = [...out].sort();
  });

  it('recovers every mounted sub-router (no silently dropped mounts)', () => {
    // A mount we cannot decode would remove its whole route group from the
    // manifest, and the mobile conformance test would then happily pass against
    // an incomplete truth.
    expect(unresolved).toEqual([]);
  });

  it('finds a substantial, sane route set', () => {
    expect(routes.length).toBeGreaterThan(50);
    // Spot-check the exact paths that historically differed from what the RN
    // client called.
    expect(routes).toContain('POST /api/v1/auth/refresh');
    expect(routes).toContain('GET /api/v1/match/mutual');
    expect(routes).toContain('GET /api/v1/match/shortlist');
    expect(routes).toContain('GET /api/v1/match/likes');
    expect(routes).toContain('GET /api/v1/verification/status');
    // And that the paths the deleted shared/constants/routes.ts claimed do NOT exist.
    expect(routes).not.toContain('POST /api/v1/auth/refresh-token');
    expect(routes).not.toContain('POST /api/v1/auth/device-token');
    expect(routes).not.toContain('GET /api/v1/verification/me');
    // Phase A (2026-08-19): saved searches + sent interests + rich chat +
    // biodata are now REAL routes — pin them so a refactor can't drop them
    // while the clients ship UI against them.
    expect(routes).toContain('GET /api/v1/search/saved');
    expect(routes).toContain('GET /api/v1/match/sent');
    expect(routes).toContain('POST /api/v1/chat/messages/voice');
    expect(routes).toContain('POST /api/v1/chat/messages/:messageId/reactions');
    expect(routes).toContain('GET /api/v1/profile/me/biodata');
  });

  it('writes the manifest the mobile conformance test reads', () => {
    const payload = {
      _comment:
        'GENERATED by backend/tests/unit/routeManifest.test.js — do not edit by hand. ' +
        'Regenerate with `npm run test --workspace=backend`.',
      generatedFrom: 'backend/routes/index.js',
      prefix: API_PREFIX,
      alias: API_ALIAS,
      routes,
    };
    const next = JSON.stringify(payload, null, 2) + '\n';
    const prev = fs.existsSync(MANIFEST_PATH) ? fs.readFileSync(MANIFEST_PATH, 'utf8') : null;
    if (prev !== next) fs.writeFileSync(MANIFEST_PATH, next);

    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
    expect(JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).routes.length).toBe(routes.length);
  });
});
