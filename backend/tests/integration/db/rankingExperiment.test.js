/**
 * Ranking experiments (audit P2): deterministic arms, fail-closed weights,
 * results that use the same bucket as the application.
 */

const { describeDb, makeMember, removeMembers } = require('../../helpers/db');
const exp = require('../../../utils/rankingExperiment');
const rankingWeights = require('../../../utils/rankingWeights');

describe('ranking experiment assignment', () => {
  it('buckets deterministically and spreads roughly evenly', () => {
    expect(exp.bucketFor('trial', 'user-1')).toBe(exp.bucketFor('trial', 'user-1'));
    let inArm = 0;
    for (let i = 0; i < 4000; i += 1) if (exp.bucketFor('spread-test', `id-${i}`) < 20) inArm += 1;
    expect(inArm).toBeGreaterThan(700);
    expect(inArm).toBeLessThan(900);
    // a different experiment reshuffles members
    const same = Array.from({ length: 200 }, (_, i) => exp.bucketFor('a-test', `u${i}`) === exp.bucketFor('b-test', `u${i}`));
    expect(same.filter(Boolean).length).toBeLessThan(20);
  });

  it('validates name, share and overrides against the weight limits', () => {
    const ok = exp.validate({ name: 'verified-boost', sharePct: 20, overrides: { verified: 15 } });
    expect(ok.ok).toBe(true);
    expect(exp.validate({ name: 'X', sharePct: 20, overrides: { verified: 15 } }).ok).toBe(false);
    expect(exp.validate({ name: 'verified-boost', sharePct: 80, overrides: { verified: 15 } }).ok).toBe(false);
    expect(exp.validate({ name: 'verified-boost', sharePct: 20, overrides: {} }).ok).toBe(false);
    expect(exp.validate({ name: 'verified-boost', sharePct: 20, overrides: { verified: 999 } }).ok).toBe(false);
    expect(exp.validate({ name: 'verified-boost', sharePct: 20, overrides: { secret: 1 } }).ok).toBe(false);
    // the variant can never lift a no-photo penalty above zero
    expect(exp.validate({ name: 'verified-boost', sharePct: 20, overrides: { noPhoto: 10 } }).ok).toBe(false);
  });

  it('merges overrides onto the live weights without touching other factors', () => {
    const live = rankingWeights.getWeights();
    const w = exp.variantWeights({ verified: 15, plans: { vip: 30 } });
    expect(w.verified).toBe(15);
    expect(w.plans.vip).toBe(30);
    expect(w.plans.elite).toBe(live.plans.elite);
    expect(w.boosted).toBe(live.boosted);
    expect(w.noPhoto).toBe(live.noPhoto);
  });
});

describeDb('ranking experiment lifecycle', (t) => {
  const ids = [];
  afterAll(async () => {
    const { AppSetting } = require('../../../models');
    await AppSetting.destroy({ where: { key: 'ranking_experiment' } }).catch(() => {});
    await exp.initRankingExperiment();
    await removeMembers(ids);
  });

  t('runs an experiment, gives arms different weights, stops it, and fails closed', async () => {
    const { AppSetting } = require('../../../models');
    const before = await AppSetting.findByPk('ranking_experiment');
    expect(before).toBeNull();

    const saved = await exp.saveExperiment({ name: 'itest-verified', sharePct: 50, overrides: { verified: 20 } }, null);
    expect(saved.enabled).toBe(true);

    const live = rankingWeights.getWeights();
    const arms = { control: 0, variant: 0 };
    for (let i = 0; i < 200; i += 1) {
      const r = exp.weightsFor(`member-${i}`);
      arms[r.variant] += 1;
      expect(r.experiment).toBe('itest-verified');
      if (r.variant === 'variant') expect(r.weights.verified).toBe(20);
      else expect(r.weights).toBe(live);
    }
    expect(arms.control).toBeGreaterThan(50);
    expect(arms.variant).toBeGreaterThan(50);
    expect(exp.weightsFor(null).variant).toBe('control');

    await exp.stopExperiment(null);
    expect(exp.weightsFor('member-1').variant).toBe('control');
    expect(exp.weightsFor('member-1').experiment).toBeNull();
    expect(await exp.readStored()).toMatchObject({ enabled: false, name: 'itest-verified' });

    await AppSetting.upsert({ key: 'ranking_experiment', value: { name: 'broken', sharePct: 500 } });
    await exp.initRankingExperiment();
    expect(exp.weightsFor('member-1')).toMatchObject({ variant: 'control', experiment: null });
  });

  t('results bucket members with the same hash the application uses', async () => {
    const { Match } = require('../../../models');
    const members = [];
    for (let i = 0; i < 6; i += 1) members.push((await makeMember()).user);
    ids.push(...members.map((m) => m.id));
    const experiment = { name: 'itest-results', sharePct: 50, overrides: { verified: 20 }, startedAt: new Date(Date.now() - 60000).toISOString() };
    const target = members[0];
    for (const m of members.slice(1)) await Match.create({ userId: m.id, matchedUserId: target.id, action: 'like' });

    const res = await exp.results(experiment);
    const expected = { control: 0, variant: 0 };
    for (const m of members.slice(1)) expected[exp.bucketFor(experiment.name, m.id) < 50 ? 'variant' : 'control'] += 1;
    const got = { control: res.control ? res.control.interestsSent : 0, variant: res.variant ? res.variant.interestsSent : 0 };
    // other members in the test DB may add likes; the ones we made must be counted in the right arm
    expect(got.control).toBeGreaterThanOrEqual(expected.control);
    expect(got.variant).toBeGreaterThanOrEqual(expected.variant);
    const sqlBucket = await require('../../../config/database').query(
      `SELECT (('x' || substr(encode(sha256(convert_to(:n || ':' || :id, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint % 100)::int AS b`,
      { replacements: { n: experiment.name, id: members[1].id }, type: 'SELECT' }
    );
    expect(sqlBucket[0].b).toBe(exp.bucketFor(experiment.name, members[1].id));

    await Match.destroy({ where: { matchedUserId: target.id } });
  });
});
