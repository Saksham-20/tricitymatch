/**
 * Admin tools for running the partner programme and the launch-day fixes found
 * in the admin audit: duplicate phones are a 409 (not a 500 from the unique
 * index), a partner's email/name/phone can be corrected, a locked-out partner
 * can be given a new password, and the dashboard's plan chart counts the same
 * live subscriptions as the tile beside it.
 */

jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
jest.mock('../../../utils/email', () => ({
  ...jest.requireActual('../../../utils/email'),
  sendEmail: jest.fn(async () => ({ success: true })),
  sendPartnerWelcome: jest.fn(async () => ({ success: true })),
}));
jest.mock('../../../middlewares/logger', () => {
  const actual = jest.requireActual('../../../middlewares/logger');
  return { ...actual, logAudit: jest.fn() };
});

const { describeDb, makeMember, removeMembers, call, uniq } = require('../../helpers/db');

const DAY = 86400000;
const PW = 'Str0ng!Passw0rd-xx';

describeDb('admin partner care', (t) => {
  const ids = [];
  let models; let sequelize; let admin; let email; let audit;

  const user = async (over = {}) => { const m = await makeMember({ user: over }); ids.push(m.user.id); return m.user; };
  const partner = async (over = {}) => {
    const u = await user({ role: 'marketing', phone: null, ...over });
    return u;
  };
  const phone10 = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const adminCtl = () => require('../../../controllers/adminController');

  beforeAll(async () => {
    models = require('../../../models');
    sequelize = require('../../../config/database');
    email = require('../../../utils/email');
    audit = require('../../../middlewares/logger').logAudit;
    admin = await user({ role: 'admin' });
  });

  afterAll(async () => {
    if (ids.length) {
      const q = (sql) => sequelize.query(sql, { replacements: { ids } }).catch(() => {});
      await q('DELETE FROM "RefreshTokens" WHERE "userId" IN (:ids)');
      await removeMembers(ids);
    }
  });

  describe('phone numbers on admin create', () => {
    const create = (fn, body) => call(adminCtl()[fn], { user: admin, body: { password: PW, firstName: 'Neha', lastName: 'Sood', gender: 'female', dateOfBirth: '1996-04-12', ...body } });
    const made = [];
    afterAll(async () => {
      if (made.length) {
        await sequelize.query('DELETE FROM "Profiles" WHERE "userId" IN (:made)', { replacements: { made } }).catch(() => {});
        await sequelize.query('DELETE FROM "Users" WHERE id IN (:made)', { replacements: { made } }).catch(() => {});
      }
    });
    const track = (res) => { if (res.body?.user?.id) made.push(res.body.user.id); return res; };

    t('stores the bare 10-digit number and answers 409, not 500, for a duplicate', async () => {
      const p = phone10();
      const first = track(await create('createMarketingUser', { email: `p1-${uniq()}@example.test`, phone: p }));
      expect(first.statusCode).toBe(201);
      expect((await models.User.findByPk(first.body.user.id)).phone).toBe(p);

      // Same number typed three ways, across all three admin create routes.
      for (const [fn, typed] of [['createMarketingUser', `+91 ${p.slice(0, 5)} ${p.slice(5)}`], ['createUser', p], ['createAdmin', `0${p}`]]) {
        const res = await create(fn, { email: `dup-${uniq()}@example.test`, phone: typed });
        expect(res.statusCode).toBe(409);
        expect(res.body.error.message).toMatch(/already used by another account/i);
      }
    });

    t('rejects a number that cannot be a mobile number', async () => {
      const res = await create('createMarketingUser', { email: `bad-${uniq()}@example.test`, phone: '12345' });
      expect(res.statusCode).toBe(400);
    });

    t('an assisted member signup keeps the gender and date of birth the admin entered', async () => {
      const res = track(await create('createUser', { email: `assist-${uniq()}@example.test` }));
      expect(res.statusCode).toBe(201);
      const profile = await models.Profile.findOne({ where: { userId: res.body.user.id } });
      expect(profile.gender).toBe('female');
      expect(new Date(profile.dateOfBirth).toISOString().slice(0, 10)).toBe('1996-04-12');
    });

    t('an assisted member signup refuses a missing gender or an under-age date of birth', async () => {
      const noGender = await create('createUser', { email: `ng-${uniq()}@example.test`, gender: undefined });
      expect(noGender.statusCode).toBe(400);
      const young = new Date(Date.now() - 19 * 365.25 * 86400000).toISOString().slice(0, 10);
      const underage = await create('createUser', { email: `ua-${uniq()}@example.test`, gender: 'male', dateOfBirth: young });
      expect(underage.statusCode).toBe(400);
      expect(underage.body.error.message).toMatch(/at least 21/);
    });

    t('still allows no phone at all', async () => {
      const res = track(await create('createMarketingUser', { email: `none-${uniq()}@example.test` }));
      expect(res.statusCode).toBe(201);
      expect(res.body.user.phone).toBeNull();
    });
  });

  describe('editing a partner', () => {
    t('corrects email, name and phone and audits the field names, not the values', async () => {
      const p = await partner();
      audit.mockClear();
      const newEmail = `fixed-${uniq()}@example.test`;
      const newPhone = phone10();
      const res = await call(adminCtl().updateMarketingUser, {
        user: admin, params: { userId: p.id },
        body: { firstName: 'Priya', lastName: 'Field', email: newEmail.toUpperCase(), phone: newPhone },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.user.email).toBe(newEmail);
      expect(res.body.user.phone).toBe(newPhone);
      expect(res.body.user.Profile.firstName).toBe('Priya');

      const [, , meta] = audit.mock.calls.find((c) => c[0] === 'marketing_user_updated');
      expect(meta.fields.sort()).toEqual(['email', 'name', 'phone']);
      expect(JSON.stringify(meta)).not.toContain(newEmail);
    });

    t('refuses an email or phone another account already has', async () => {
      const a = await partner({ phone: phone10() });
      const b = await partner();
      const clashEmail = await call(adminCtl().updateMarketingUser, { user: admin, params: { userId: b.id }, body: { email: a.email } });
      expect(clashEmail.statusCode).toBe(409);
      const clashPhone = await call(adminCtl().updateMarketingUser, { user: admin, params: { userId: b.id }, body: { phone: a.phone } });
      expect(clashPhone.statusCode).toBe(409);
    });

    t('can clear a phone, and reports when nothing changed', async () => {
      const p = await partner({ phone: phone10() });
      const cleared = await call(adminCtl().updateMarketingUser, { user: admin, params: { userId: p.id }, body: { phone: '' } });
      expect(cleared.statusCode).toBe(200);
      expect(cleared.body.user.phone).toBeNull();
      const same = await call(adminCtl().updateMarketingUser, { user: admin, params: { userId: p.id }, body: { phone: '' } });
      expect(same.body.message).toBe('Nothing to change');
    });

    t('only works on partners', async () => {
      const member = await user();
      const res = await call(adminCtl().updateMarketingUser, { user: admin, params: { userId: member.id }, body: { firstName: 'X' } });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('resetting a partner password', () => {
    t('sets it, signs the partner out everywhere, and audits without the password', async () => {
      const p = await partner();
      await models.RefreshToken.create({
        userId: p.id, tokenHash: `h-${uniq()}`, family: `f-${uniq()}`, expiresAt: new Date(Date.now() + DAY),
      }).catch(() => null);
      audit.mockClear();

      const res = await call(adminCtl().resetMarketingUserPassword, { user: admin, params: { userId: p.id }, body: { password: PW } });
      expect(res.statusCode).toBe(200);

      const fresh = await models.User.findByPk(p.id);
      expect(await fresh.comparePassword(PW)).toBe(true);
      const live = await models.RefreshToken.count({ where: { userId: p.id, isRevoked: false } });
      expect(live).toBe(0);

      const [, , meta] = audit.mock.calls.find((c) => c[0] === 'marketing_user_password_reset');
      expect(JSON.stringify(meta)).not.toContain(PW);
    });

    t('holds staff to the 12-character floor and the complexity rule', async () => {
      const p = await partner();
      for (const weak of ['Short1!', 'alllowercase1234!', 'NoDigitsHere!!!!', undefined]) {
        const res = await call(adminCtl().resetMarketingUserPassword, { user: admin, params: { userId: p.id }, body: { password: weak } });
        expect(res.statusCode).toBe(400);
      }
    });

    t('refuses to touch an ordinary member', async () => {
      const member = await user();
      const res = await call(adminCtl().resetMarketingUserPassword, { user: admin, params: { userId: member.id }, body: { password: PW } });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('resending the welcome email', () => {
    t('sends it to the partner by first name and reports delivery', async () => {
      const p = await partner();
      email.sendPartnerWelcome.mockClear();
      const res = await call(adminCtl().resendPartnerWelcome, { user: admin, params: { userId: p.id } });
      expect(res.body).toEqual({ success: true, welcomeEmailSent: true });
      expect(email.sendPartnerWelcome).toHaveBeenCalledWith(p.email, 'It');
    });

    t('says so when the email could not be sent', async () => {
      const p = await partner();
      email.sendPartnerWelcome.mockRejectedValueOnce(new Error('resend down'));
      const res = await call(adminCtl().resendPartnerWelcome, { user: admin, params: { userId: p.id } });
      expect(res.body.welcomeEmailSent).toBe(false);
    });
  });

  describe('dashboard plan chart', () => {
    const sub = (userId, over = {}) => models.Subscription.create({
      userId, planType: 'premium_plus', amount: 1099, status: 'active',
      startDate: new Date(Date.now() - 10 * DAY), endDate: new Date(Date.now() + 80 * DAY),
      contactUnlocksAllowed: null, razorpayPaymentId: `pay_${uniq()}`, razorpayOrderId: `order_${uniq()}`, ...over,
    });
    const stats = async () => (await call(adminCtl().getAnalytics, { user: admin })).body;
    const premium = (d) => d.planDistribution.find((p) => p.plan === 'premium_plus')?.count || 0;

    t('counts only live plans of current members, matching the subscribers tile', async () => {
      const before = await stats();
      const live = await user();
      const lapsed = await user();
      const erased = await user({ status: 'deleted' });
      await sub(live.id);
      await sub(lapsed.id, { endDate: new Date(Date.now() - 2 * DAY) });
      await sub(erased.id);

      const after = await stats();
      // Only the live member's row is new to the chart and to the tile.
      expect(premium(after) - premium(before)).toBe(1);
      expect(after.stats.activeSubscribers - before.stats.activeSubscribers).toBe(1);
    });
  });
});
