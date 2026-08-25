import api from '../api/axios';

/**
 * Traffic-stage beacon.
 *
 * The account half of the funnel is emitted server-side; these four stages
 * happen in the browser, before or around an account existing, and are the
 * only way to answer "how many people reached the site, and where did they
 * stop". Deliberately first-party: no third-party account to set up, no
 * consent banner to write, nothing identifying leaves the page — the request
 * body is one allowlisted stage name.
 *
 * Every call is fire-and-forget and swallows its own failure. An ad blocker,
 * an offline tab or a 429 must never surface to the person browsing.
 */

// Stages the server accepts from a browser. Anything else is ignored there,
// so keep this list in step with CLIENT_EVENT_TYPES in backend/utils/trackEvent.js.
export const STAGES = {
  LANDING: 'landing_view',
  SIGNUP_STARTED: 'signup_started',
  PLANS_VIEWED: 'plans_viewed',
  CHECKOUT_STARTED: 'checkout_started',
};

// One stage fires at most once per tab. Without this, a React StrictMode
// double-mount or a member flipping between tabs would inflate exactly the
// numbers the funnel exists to measure.
const fired = new Set();

export function track(stage, { once = true } = {}) {
  if (!stage) return;
  if (once) {
    if (fired.has(stage)) return;
    fired.add(stage);
  }
  try {
    api.post('/events', { name: stage }).catch(() => {});
  } catch {
    /* analytics must never break a page */
  }
}

export default track;
