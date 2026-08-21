/**
 * Cache pattern invalidation (deep security audit 2026-08-21, R2 DoS-1).
 *
 * delPattern used `redisClient.keys(pattern)`. KEYS is O(N) over the ENTIRE
 * keyspace and blocks Redis's single command thread while it runs — and this
 * function sits on the profile-write path (invalidateUser <- PUT /profile/me).
 * Any authenticated member could therefore stall Redis for every other user —
 * sessions, rate-limit counters, OTP state, cached profiles — simply by saving
 * their own profile in a loop. The cost scales with keyspace size, so it gets
 * worse precisely as the product grows.
 *
 * Two invariants are pinned here. The first is a source-level ban: KEYS must
 * never come back, and asserting on behaviour alone would not catch someone
 * reintroducing it behind a branch this suite does not enter. The second is the
 * memory-cache fallback's glob, which was compiled unanchored.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../utils/cache.js'), 'utf8');
const cache = require('../../utils/cache');

describe('delPattern implementation', () => {
  it('does not call the blocking KEYS command anywhere in the module', () => {
    expect(source).not.toMatch(/redisClient\.keys\s*\(/);
  });

  it('iterates with SCAN and a bounded COUNT', () => {
    expect(source).toMatch(/redisClient\.scan\s*\(/);
    expect(source).toMatch(/'MATCH'/);
    expect(source).toMatch(/'COUNT'/);
  });

  it('walks the cursor rather than assuming one page', () => {
    expect(source).toMatch(/while \(cursor !== '0'\)/);
  });

  it('prefers UNLINK, which frees memory off the command thread', () => {
    expect(source).toMatch(/redisClient\.unlink\(/);
  });
});

describe('memory-cache fallback glob', () => {
  // Without Redis configured the module uses its in-process map, which is the
  // branch these assertions exercise.
  it('anchors the pattern so a key merely CONTAINING the fragment survives', async () => {
    await cache.set('user:1:profile', 'target');
    await cache.set('xuser:1:profile', 'bystander');
    await cache.set('user:1:profile:extra', 'also-target');

    await cache.delPattern('user:1:*');

    expect(await cache.get('xuser:1:profile')).toBe('bystander');
    expect(await cache.get('user:1:profile')).toBeNull();
    expect(await cache.get('user:1:profile:extra')).toBeNull();
  });

  it('treats regex metacharacters in the pattern as literals', async () => {
    await cache.set('user:1:profile', 'literal-target');
    await cache.set('userX1Xprofile', 'must-survive');

    // '.' and ':' must not behave as regex wildcards.
    await cache.delPattern('user:1:profile');

    expect(await cache.get('userX1Xprofile')).toBe('must-survive');
    expect(await cache.get('user:1:profile')).toBeNull();
  });
});
