jest.mock('../../middlewares/logger', () => ({ log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const mockStore = new Map();
jest.mock('../../models', () => ({
  AppSetting: {
    findByPk: jest.fn(async (k) => (mockStore.has(k) ? { value: mockStore.get(k) } : null)),
    upsert: jest.fn(async ({ key, value }) => { mockStore.set(key, value); }),
  },
}));

const rw = require('../../utils/rankingWeights');

describe('rankBreakdown', () => {
  const base = { compatibilityScore: 60, premiumPlan: null, isBoosted: false, isVerified: false, hasPhoto: true };

  it('lists only the factors that moved the score and sums to the total', () => {
    const r = rw.rankBreakdown({ ...base, premiumPlan: 'premium_plus', isVerified: true }, rw.DEFAULT_WEIGHTS);
    expect(r.factors.map((f) => f.key)).toEqual(['compatibility', 'plan', 'verified']);
    expect(r.total).toBe(60 + 10 + 8);
    expect(r.factors.reduce((n, f) => n + f.points, 0)).toBe(r.total);
  });

  it('a missing photo out-weighs every positive nudge combined', () => {
    const w = rw.DEFAULT_WEIGHTS;
    const best = w.plans.vip + w.boosted + w.verified;
    expect(Math.abs(w.noPhoto)).toBeGreaterThan(best);
  });

  it('unknown plan adds nothing', () => {
    expect(rw.rankBreakdown({ ...base, premiumPlan: 'made_up' }, rw.DEFAULT_WEIGHTS).total).toBe(60);
  });
});

describe('validate / save', () => {
  it('rejects out-of-range and unknown keys', () => {
    expect(rw.validate({ boosted: 999 }).ok).toBe(false);
    expect(rw.validate({ noPhoto: 5 }).ok).toBe(false);
    expect(rw.validate({ plans: { gold: 5 } }).ok).toBe(false);
    expect(rw.validate({ plans: { vip: 'high' } }).ok).toBe(false);
    expect(rw.validate(null).ok).toBe(false);
  });

  it('fills unspecified weights from the defaults', () => {
    const r = rw.validate({ boosted: 12 });
    expect(r.ok).toBe(true);
    expect(r.weights.boosted).toBe(12);
    expect(r.weights.verified).toBe(rw.DEFAULT_WEIGHTS.verified);
    expect(r.weights.plans).toEqual(rw.DEFAULT_WEIGHTS.plans);
  });

  it('saveWeights persists, takes effect immediately, and reset restores defaults', async () => {
    await rw.saveWeights({ verified: 20 }, 'admin-1');
    expect(rw.getWeights().verified).toBe(20);
    expect(mockStore.get('ranking_weights').verified).toBe(20);
    await rw.resetWeights('admin-1');
    expect(rw.getWeights().verified).toBe(rw.DEFAULT_WEIGHTS.verified);
  });

  it('saveWeights throws a 400 for bad input and stores nothing', async () => {
    mockStore.clear();
    await expect(rw.saveWeights({ verified: -3 }, 'a')).rejects.toMatchObject({ statusCode: 400 });
    expect(mockStore.size).toBe(0);
  });

  it('a malformed stored blob falls back to defaults', async () => {
    mockStore.set('ranking_weights', { boosted: 'lots' });
    await rw.initRankingWeights();
    expect(rw.getWeights()).toEqual(rw.DEFAULT_WEIGHTS);
  });
});
