/**
 * Overload guard: answer 503 fast instead of queueing without limit.
 *
 * On the 1-vCPU box an overload used to turn into unbounded queueing: requests
 * waited tens of seconds, the SPA retried, and the backlog only grew. This
 * watches event-loop delay (how late a timer fires, i.e. how long the loop is
 * busy before it gets back to new work) and, while it stays high, refuses new
 * API requests with 503 + Retry-After so the requests already running finish.
 *
 * Off unless LOAD_SHED_LAG_MS is set. It trips only after TRIP_WINDOWS
 * consecutive windows over the threshold (one slow GC or one burst of logins
 * is not an overload) and clears once a window falls below half of it.
 *
 * Never refused: health checks, payment webhooks and confirmations (money may
 * already have moved), and the session calls the SPA treats as "am I still
 * logged in" — a 503 there must not look like a sign-out.
 */

const { monitorEventLoopDelay } = require('perf_hooks');
const { log } = require('./logger');

const TRIP_WINDOWS = 2;
const RETRY_AFTER_SECONDS = 5;

const EXEMPT = [
  /^\/health/,
  /^\/(api\/)?monitoring(\/|$)/,
  /^\/api(\/v1)?\/subscription\/(webhook|verify-payment|cancel-order|google-verify|unlock-bundle\/verify-payment)(\/|$)/,
  /^\/api(\/v1)?\/astrologers\/book\/[^/]+\/verify-payment(\/|$)/,
  /^\/api(\/v1)?\/auth\/(refresh|me|logout)(\/|$)/,
];

const isSheddable = (path) => path.startsWith('/api/') && !EXEMPT.some((re) => re.test(path));

/**
 * @param {object} opts
 * @param {number} opts.thresholdMs  mean event-loop delay that counts as overloaded
 * @param {number} [opts.windowMs]   sampling window
 * @param {() => number} [opts.sampleLagMs]  injectable for tests; returns the mean
 *   delay of the window just ended, in ms
 */
const createLoadShedder = ({ thresholdMs, windowMs = 1000, sampleLagMs } = {}) => {
  let histogram = null;
  const sample = sampleLagMs || (() => {
    const meanMs = histogram.mean / 1e6;
    histogram.reset();
    return Number.isFinite(meanMs) ? meanMs : 0;
  });

  let over = 0;
  let shedding = false;
  let shedCount = 0;
  let lastLagMs = 0;

  const tick = () => {
    lastLagMs = sample();
    if (lastLagMs > thresholdMs) {
      over += 1;
      if (!shedding && over >= TRIP_WINDOWS) {
        shedding = true;
        shedCount = 0;
        log.warn('Load shedding ON', { lagMs: Math.round(lastLagMs), thresholdMs });
      }
    } else {
      over = 0;
      if (shedding && lastLagMs < thresholdMs / 2) {
        shedding = false;
        log.warn('Load shedding OFF', { lagMs: Math.round(lastLagMs), refused: shedCount });
      }
    }
  };

  let timer = null;
  const start = () => {
    if (timer) return;
    if (!sampleLagMs) {
      histogram = monitorEventLoopDelay({ resolution: 20 });
      histogram.enable();
    }
    timer = setInterval(tick, windowMs);
    timer.unref();
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    histogram?.disable();
  };

  const middleware = (req, res, next) => {
    if (!shedding || !isSheddable(req.path)) return next();
    shedCount += 1;
    res.set('Retry-After', String(RETRY_AFTER_SECONDS));
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVER_BUSY',
        message: 'We are very busy right now. Please try again in a few seconds.',
      },
    });
  };

  return {
    start,
    stop,
    tick,
    middleware,
    state: () => ({ shedding, lagMs: Math.round(lastLagMs), refused: shedCount }),
  };
};

module.exports = { createLoadShedder, isSheddable };
