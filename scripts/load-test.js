/**
 * k6 load test — TricityShadi critical API endpoints
 *
 * Install: brew install k6
 * Run:     k6 run scripts/load-test.js --env BASE_URL=https://tricityshadi.com
 *          k6 run scripts/load-test.js --env BASE_URL=http://localhost:5001
 *
 * Thresholds (all must pass for green):
 *   - 95th pct response < 500ms
 *   - error rate < 1%
 *   - health check 100% success
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';

const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration', true);
const searchDuration = new Trend('search_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up
    { duration: '1m',  target: 50 },   // steady load
    { duration: '30s', target: 100 },  // peak
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed:   ['rate<0.01'],
    errors:            ['rate<0.01'],
  },
};

const ADMIN_EMAIL    = __ENV.ADMIN_EMAIL    || 'admin@tricitymatch.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Pass@1234';

function getAuthToken() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 200) return null;
  // Backend uses httpOnly cookies — k6 jar handles automatically
  return res.cookies;
}

export default function () {
  // ── Health ──────────────────────────────────────────────────────────────────
  group('health', () => {
    const r = http.get(`${BASE_URL}/health`);
    const ok = check(r, {
      'health 200':   (res) => res.status === 200,
      'health fast':  (res) => res.timings.duration < 200,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Auth: login ─────────────────────────────────────────────────────────────
  group('auth/login', () => {
    const start = Date.now();
    const r = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    loginDuration.add(Date.now() - start);
    const ok = check(r, {
      'login 200':      (res) => res.status === 200,
      'login has user': (res) => {
        try { return !!JSON.parse(res.body).user; } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(1);

  // ── Auth: /me (requires cookie from jar) ────────────────────────────────────
  group('auth/me', () => {
    const r = http.get(`${BASE_URL}/api/v1/auth/me`);
    const ok = check(r, {
      'me 200 or 401': (res) => [200, 401].includes(res.status),
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Search (unauthenticated — returns 401, but should not 500) ───────────────
  group('search', () => {
    const start = Date.now();
    const r = http.get(`${BASE_URL}/api/v1/search?page=1&limit=10`);
    searchDuration.add(Date.now() - start);
    const ok = check(r, {
      'search not 500': (res) => res.status !== 500,
      'search fast':    (res) => res.timings.duration < 500,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Monitoring metrics endpoint ──────────────────────────────────────────────
  group('monitoring/health', () => {
    const r = http.get(`${BASE_URL}/monitoring/health`);
    const ok = check(r, {
      'monitoring 200 or 401': (res) => [200, 401].includes(res.status),
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

export function handleSummary(data) {
  const passed = data.metrics.http_req_failed.values.rate < 0.01
    && data.metrics.http_req_duration.values['p(95)'] < 500;

  return {
    stdout: JSON.stringify({
      passed,
      p95_ms:     Math.round(data.metrics.http_req_duration.values['p(95)']),
      error_rate: (data.metrics.http_req_failed.values.rate * 100).toFixed(2) + '%',
      total_reqs: data.metrics.http_reqs.values.count,
    }, null, 2),
    'scripts/load-test-results.json': JSON.stringify(data, null, 2),
  };
}
