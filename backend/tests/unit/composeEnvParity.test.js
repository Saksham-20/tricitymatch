/**
 * SITE-15: docker-compose passes ONLY the variables listed in the backend
 * `environment:` map. Anything config/env.js reads that is not listed there can
 * be set in .env and never reach the container (this already silently disabled
 * CORS_ORIGIN and FREE_REPLY_WINDOW once each). This fails when a new key is
 * added to config/env.js without being plumbed, or consciously excluded below.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');
const envSrc = fs.readFileSync(path.join(root, 'backend', 'config', 'env.js'), 'utf8');
const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');

// Read by config/env.js but deliberately NOT passed to the production container.
const INTENTIONALLY_UNPLUMBED = new Set([
  'NODE_ENV', // set explicitly above
  'ALLOW_INSECURE_PROD', 'OTP_BYPASS_CODES', // refused at boot in production; must never be plumbed
  'DISABLE_RATE_LIMITS', // test/dev switch
  'ADMIN_EMAIL', // seeder-only
  'UPLOAD_DIR', // fixed by the backend_uploads volume
  'REDIS_URL', 'QUEUE_REDIS_URL', 'REDIS_MAX_RETRIES', // host/port/password are passed instead
]);

const envKeys = () => {
  const keys = new Set();
  for (const m of envSrc.matchAll(/\(\s*'([A-Z][A-Z0-9_]{2,})'/g)) keys.add(m[1]);
  for (const m of envSrc.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) keys.add(m[1]);
  for (const m of envSrc.matchAll(/process\.env\[\s*'([A-Z][A-Z0-9_]{2,})'\s*\]/g)) keys.add(m[1]);
  return keys;
};

const composeBackendKeys = () => {
  const start = compose.indexOf('\n  backend:');
  const after = compose.indexOf('\n    environment:', start);
  const end = compose.indexOf('\n    ports:', after);
  const block = compose.slice(after, end);
  return new Set([...block.matchAll(/^ {6}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]));
};

describe('docker-compose backend environment parity', () => {
  it('passes every variable config/env.js reads (or lists it as intentionally unplumbed)', () => {
    const plumbed = composeBackendKeys();
    const missing = [...envKeys()].filter((k) => !plumbed.has(k) && !INTENTIONALLY_UNPLUMBED.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('never plumbs the pre-launch escape hatches', () => {
    const plumbed = composeBackendKeys();
    expect(plumbed.has('OTP_BYPASS_CODES')).toBe(false);
    expect(plumbed.has('ALLOW_INSECURE_PROD')).toBe(false);
  });

  it('gives the backend longer than the in-process forced-exit timer to stop', () => {
    const m = compose.match(/stop_grace_period:\s*(\d+)s/);
    expect(m).not.toBeNull();
    const { DEFAULT_FORCE_EXIT_MS } = require('../../utils/shutdown');
    expect(Number(m[1]) * 1000).toBeGreaterThan(DEFAULT_FORCE_EXIT_MS);
  });
});
