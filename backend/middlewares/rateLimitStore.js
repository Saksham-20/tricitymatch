/**
 * Redis-backed store for express-rate-limit (deep audit 2026-08-21).
 *
 * Every limiter in this app used the library's default MemoryStore, which keeps
 * counters in the process heap. Two consequences:
 *
 *   1. Counters reset on every restart or deploy, so a deploy clears an
 *      in-progress brute-force budget.
 *   2. Counters are per-process, so the effective ceiling multiplies by the
 *      number of backend replicas. The account-lockout control was already
 *      moved to Redis for exactly this reason (utils/cache); the rate limiters
 *      were not.
 *
 * No new dependency: this uses the ioredis client already created in
 * utils/cache. If Redis is unavailable at any point the store transparently
 * falls back to an in-process MemoryStore, so limiting degrades rather than
 * failing open entirely or throwing.
 */

const { MemoryStore } = require('express-rate-limit');
const { getRedisClient, isRedisAvailable } = require('../utils/cache');
const { log } = require('./logger');

class RedisRateLimitStore {
  constructor({ prefix = 'rl:' } = {}) {
    this.prefix = prefix;
    this.fallback = new MemoryStore();
    this.warned = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  key(k) { return `${this.prefix}${k}`; }

  usingFallback() {
    const ok = isRedisAvailable() && getRedisClient();
    if (!ok && !this.warned) {
      this.warned = true;
      log.warn('[rate-limit] Redis unavailable — counters are per-process and reset on restart');
    }
    if (ok) this.warned = false;
    return !ok;
  }

  async increment(k) {
    if (this.usingFallback()) return this.fallback.increment(k);
    try {
      const client = getRedisClient();
      const redisKey = this.key(k);
      // INCR then read the TTL in one round trip; set the window only when the
      // key is new (pttl < 0), so the window is fixed from first hit and a
      // flood cannot keep pushing the reset time outwards.
      const res = await client.multi().incr(redisKey).pttl(redisKey).exec();
      const totalHits = res[0][1];
      let pttl = res[1][1];
      if (pttl < 0) {
        await client.pexpire(redisKey, this.windowMs);
        pttl = this.windowMs;
      }
      return { totalHits, resetTime: new Date(Date.now() + pttl) };
    } catch (err) {
      log.error('[rate-limit] Redis increment failed, falling back', { error: err.message });
      return this.fallback.increment(k);
    }
  }

  async decrement(k) {
    if (this.usingFallback()) return this.fallback.decrement(k);
    try {
      await getRedisClient().decr(this.key(k));
    } catch (err) {
      log.error('[rate-limit] Redis decrement failed', { error: err.message });
    }
  }

  async resetKey(k) {
    if (this.usingFallback()) return this.fallback.resetKey(k);
    try {
      await getRedisClient().del(this.key(k));
    } catch (err) {
      log.error('[rate-limit] Redis resetKey failed', { error: err.message });
    }
  }
}

module.exports = { RedisRateLimitStore };
