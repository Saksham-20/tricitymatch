/**
 * utils/searchRankCache: what makes two ranked searches "the same list", and
 * that the cache can never turn into an error for the member.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(), logSecurity: jest.fn(),
}));

const cache = require('../../utils/cache');
const rc = require('../../utils/searchRankCache');

const viewerProfile = { updatedAt: new Date('2026-10-10T08:00:00.000Z') };
const ranking = { weights: { plans: { vip: 20 }, boosted: 8, verified: 8, noPhoto: -40 }, variant: 'control', experiment: null };
const viewerCtx = { blockedIds: ['b2', 'b1'], mutualIds: new Set(['m1']) };
const base = { filters: { city: 'Mohali', ageMin: 25 }, mustHavesOff: false, showPassed: false, ranking, viewerProfile, viewerCtx };
const sigOf = (over = {}) => rc.rankSignature({ ...base, ...over });

describe('normalizeFilters', () => {
  it('drops only what the search builder treats as absent, and sorts keys and arrays', () => {
    expect(rc.normalizeFilters({ b: '', a: undefined, c: null, d: 0, e: false, f: [], g: ['y', 'x'] }))
      .toEqual({ d: 0, e: false, f: [], g: ['x', 'y'] });
    expect(Object.keys(rc.normalizeFilters({ z: 1, a: 2 }))).toEqual(['a', 'z']);
    expect(rc.normalizeFilters(null)).toEqual({});
  });
});

describe('rankSignature', () => {
  it('is null when the member profile has no version (nothing is cached then)', () => {
    expect(sigOf({ viewerProfile: {} })).toBeNull();
    expect(sigOf({ viewerProfile: { updatedAt: 'not a date' } })).toBeNull();
    expect(sigOf({ viewerProfile: null })).toBeNull();
  });

  it('ignores key order, array order and absent values', () => {
    const a = sigOf({ filters: { city: ['Mohali', 'Panchkula'], ageMin: 25, religion: '' } });
    const b = sigOf({ filters: { ageMin: 25, city: ['Panchkula', 'Mohali'] } });
    expect(a).toBe(b);
    expect(sigOf({ viewerCtx: { blockedIds: ['b1', 'b2'], mutualIds: new Set(['m1']) } })).toBe(sigOf());
  });

  it('changes with everything that shapes the ranking or the pool', () => {
    const base0 = sigOf();
    const changed = [
      sigOf({ filters: { city: 'Mohali', ageMin: 26 } }),
      sigOf({ filters: { city: 'Mohali', ageMin: 25, religion: 'Sikh' } }),
      sigOf({ filters: { city: 'Mohali', ageMin: 25, interestTags: [] } }),
      sigOf({ mustHavesOff: true }),
      sigOf({ showPassed: true }),
      sigOf({ ranking: { ...ranking, weights: { ...ranking.weights, boosted: 9 } } }),
      sigOf({ ranking: { ...ranking, variant: 'variant', experiment: 'exp1' } }),
      sigOf({ viewerProfile: { updatedAt: new Date('2026-10-10T08:00:00.001Z') } }),
      sigOf({ viewerCtx: { ...viewerCtx, blockedIds: ['b1'] } }),
      sigOf({ viewerCtx: { ...viewerCtx, mutualIds: new Set(['m1', 'm2']) } }),
    ];
    for (const s of changed) expect(s).not.toBe(base0);
    expect(new Set(changed).size).toBe(changed.length);
  });

  it('suggestions have their own signature: limit, paid access, weights and profile version', () => {
    const sb = { limit: 10, viewerPaid: false, ranking, viewerProfile };
    const s0 = rc.suggestionsSignature(sb);
    expect(s0).toBe(rc.suggestionsSignature({ ...sb }));
    expect(rc.suggestionsSignature({ ...sb, limit: 20 })).not.toBe(s0);
    expect(rc.suggestionsSignature({ ...sb, viewerPaid: true })).not.toBe(s0);
    expect(rc.suggestionsSignature({ ...sb, ranking: { ...ranking, variant: 'variant' } })).not.toBe(s0);
    expect(rc.suggestionsSignature({ ...sb, viewerProfile: { updatedAt: new Date() } })).not.toBe(s0);
    expect(rc.suggestionsSignature({ ...sb, viewerProfile: {} })).toBeNull();
    expect(s0).not.toBe(sigOf());
  });
});

describe('read / write', () => {
  const userId = 'u-cache-1';
  afterEach(() => rc.clearMember(userId));

  it('serves a list only for the signature it was written under', async () => {
    const sig = sigOf();
    expect(await rc.writeRanked(userId, { sig, ids: ['a', 'b'], total: 2 })).toBe(true);
    expect(await rc.readRanked(userId, sig)).toEqual({ sig, ids: ['a', 'b'], total: 2 });
    expect(await rc.readRanked(userId, sigOf({ showPassed: true }))).toBeNull();
    expect(await rc.readRanked(userId, null)).toBeNull();
    expect(await rc.readRanked('someone-else', sig)).toBeNull();
  });

  it('one slot per member: a new signature replaces the old list', async () => {
    const s1 = sigOf();
    const s2 = sigOf({ mustHavesOff: true });
    await rc.writeRanked(userId, { sig: s1, ids: ['a'], total: 1 });
    await rc.writeRanked(userId, { sig: s2, ids: ['b'], total: 1 });
    expect(await rc.readRanked(userId, s1)).toBeNull();
    expect((await rc.readRanked(userId, s2)).ids).toEqual(['b']);
  });

  it('rejects malformed entries instead of serving them', async () => {
    const sig = sigOf();
    await cache.set(rc.RANK_PREFIX + userId, { sig, ids: 'a,b', total: 2 });
    expect(await rc.readRanked(userId, sig)).toBeNull();
    await cache.set(rc.RANK_PREFIX + userId, { sig, ids: ['a', 3], total: 2 });
    expect(await rc.readRanked(userId, sig)).toBeNull();
    await cache.set(rc.RANK_PREFIX + userId, { sig, ids: ['a'] });
    expect(await rc.readRanked(userId, sig)).toBeNull();
  });

  it('never writes without a signature', async () => {
    const set = jest.spyOn(cache, 'set');
    expect(await rc.writeRanked(userId, { sig: null, ids: [], total: 0 })).toBe(false);
    expect(await rc.writeSuggestions(userId, { ids: [] })).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it('a cache that throws or rejects reads as a miss and a failed write, never an error', async () => {
    const sig = sigOf();
    jest.spyOn(cache, 'get').mockRejectedValue(new Error('down'));
    jest.spyOn(cache, 'set').mockImplementation(() => { throw new Error('down'); });
    jest.spyOn(cache, 'del').mockRejectedValue(new Error('down'));
    await expect(rc.readRanked(userId, sig)).resolves.toBeNull();
    await expect(rc.readSuggestions(userId, sig)).resolves.toBeNull();
    await expect(rc.writeRanked(userId, { sig, ids: [], total: 0 })).resolves.toBe(false);
    await expect(rc.writeSuggestions(userId, { sig, ids: [] })).resolves.toBe(false);
    await expect(rc.clearMember(userId)).resolves.toBeUndefined();
  });

  it('uses the documented TTLs and keeps search and suggestions apart', async () => {
    const set = jest.spyOn(cache, 'set');
    const sig = sigOf();
    await rc.writeRanked(userId, { sig, ids: [], total: 0 });
    await rc.writeSuggestions(userId, { sig, ids: [] });
    expect(set).toHaveBeenNthCalledWith(1, `search:rank:v1:${userId}`, expect.any(Object), 300);
    expect(set).toHaveBeenNthCalledWith(2, `search:sugg:v1:${userId}`, expect.any(Object), 600);
    expect(await rc.readSuggestions(userId, sig)).toEqual({ sig, ids: [] });
  });
});
