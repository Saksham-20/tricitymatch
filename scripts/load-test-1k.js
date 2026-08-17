/**
 * k6 stress test — TricityMatch, 500→1000 VU staged ramp.
 *
 * SAFETY: shared VPS with co-tenant production sites. This script:
 *   - hits only PUBLIC read endpoints (no auth storm, no writes, no signup spam)
 *   - aborts early if error rate or latency blows out (abortOnFail thresholds)
 *   - staged ramp so a co-tenant impact shows before full 1000 VU
 *
 * CAVEAT: run from a single host = single source IP. Per-IP rate limiters
 * (api 200/15m) will cap sustained throughput far below 1000 distinct users.
 * This measures the public edge + nginx + DB read path under spike, and how
 * gracefully the limiter sheds load — NOT true 1000-distinct-user capacity
 * (that needs distributed load generators or a test-window limiter bump).
 *
 * Run: k6 run scripts/load-test-1k.js --env BASE_URL=https://tricitymatch.com
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://tricitymatch.com';
const errorRate = new Rate('errors');
const homeDuration = new Trend('home_duration', true);
const apiDuration = new Trend('api_duration', true);

export const options = {
  stages: [
    { duration: '1m', target: 200 },
    { duration: '2m', target: 500 },
    { duration: '2m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    // abortOnFail = pull the plug if prod (or a co-tenant) starts hurting
    http_req_failed:   [{ threshold: 'rate<0.25', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: [{ threshold: 'p(95)<3000', abortOnFail: true, delayAbortEval: '30s' }],
    errors:            ['rate<0.20'],
  },
};

export default function () {
  group('home', () => {
    const start = Date.now();
    const r = http.get(`${BASE_URL}/`);
    homeDuration.add(Date.now() - start);
    errorRate.add(!check(r, { 'home 200': (res) => res.status === 200 }));
  });
  sleep(1);

  group('public-api', () => {
    const start = Date.now();
    const r = http.get(`${BASE_URL}/api/v1/success-stories`);
    apiDuration.add(Date.now() - start);
    // 200 (data) or 429 (limiter shedding) are both "healthy" under spike; 5xx is not
    errorRate.add(!check(r, { 'api not 5xx': (res) => res.status < 500 }));
  });
  sleep(1);

  group('search-route', () => {
    const r = http.get(`${BASE_URL}/api/v1/search?page=1&limit=10`);
    errorRate.add(!check(r, { 'search not 5xx': (res) => res.status < 500 }));
  });
  sleep(2);
}

export function handleSummary(data) {
  const m = data.metrics;
  const line = (k) => (m[k] ? Math.round(m[k].values['p(95)']) : 'n/a');
  return {
    stdout: JSON.stringify({
      total_reqs: m.http_reqs.values.count,
      error_rate: (m.http_req_failed.values.rate * 100).toFixed(2) + '%',
      p95_all_ms: line('http_req_duration'),
      p95_home_ms: line('home_duration'),
      p95_api_ms: line('api_duration'),
      max_vus: m.vus_max.values.max,
    }, null, 2),
    'scripts/load-test-1k-results.json': JSON.stringify(data, null, 2),
  };
}
