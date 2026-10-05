/**
 * Marketing-partner onboarding on a real database: the acceptance record that
 * makes the Partner Guide an agreement, the checklist the portal and the admin
 * list both read, the gate that holds back codes and leads until the guide is
 * accepted, and the welcome mail that must never carry a password.
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

describeDb('partner onboarding', (t) => {
  const ids = [];
  let models; let sequelize; let onboarding; let email; let adminCtl; let details; let manualLeads;
  let PARTNER_GUIDE_VERSION;

  const partner = async (user = {}) => {
    const m = await makeMember({ user: { role: 'marketing', ...user } });
    ids.push(m.user.id);
    return m.user;
  };
  const consentOf = async (id) => (await models.User.findByPk(id, { attributes: ['consent'] })).consent;
  const gate = (user) => new Promise((resolve) => {
    onboarding.requirePartnerAgreement({ user }, {}, (err) => resolve(err || null));
  });

  beforeAll(() => {
    models = require('../../../models');
    sequelize = require('../../../config/database');
    onboarding = require('../../../utils/partnerOnboarding');
    email = require('../../../utils/email');
    adminCtl = require('../../../controllers/adminController');
    details = require('../../../utils/payoutDetails');
    manualLeads = require('../../../utils/manualLeads');
    ({ PARTNER_GUIDE_VERSION } = require('../../../constants/partnerProgramme'));
  });

  afterAll(async () => {
    if (ids.length) {
      const q = (sql) => sequelize.query(sql, { replacements: { ids } }).catch(() => {});
      await q('DELETE FROM "MarketingLeads" WHERE "assignedToMarketingUserId" IN (:ids)');
      await q('DELETE FROM "ReferralCodes" WHERE "marketingUserId" IN (:ids)');
      await q('DELETE FROM "MarketingPayoutDetails" WHERE "marketingUserId" IN (:ids)');
      await removeMembers(ids);
    }
  });

  t('a new partner starts with nothing done', async () => {
    const p = await partner();
    const s = await onboarding.getOnboarding(p.id);
    expect(s.steps).toEqual({ agreement: false, payout: false, code: false, outreach: false });
    expect(s).toMatchObject({ completed: 0, total: 4, complete: false, agreementAcceptedAt: null, needsReacceptance: false });
    expect(s.guideVersion).toBe(PARTNER_GUIDE_VERSION);
  });

  t('the gate holds back a partner who has not accepted, with a code the client can branch on', async () => {
    const p = await partner();
    const err = await gate({ id: p.id, role: 'marketing' });
    expect(err).toBeTruthy();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('PARTNER_AGREEMENT_REQUIRED');
    // marketing_manager is a partner too.
    const mgr = await partner({ role: 'marketing_manager' });
    expect((await gate({ id: mgr.id, role: 'marketing_manager' })).code).toBe('PARTNER_AGREEMENT_REQUIRED');
  });

  t('admins and members pass the gate untouched', async () => {
    expect(await gate({ id: '00000000-0000-4000-8000-000000000000', role: 'admin' })).toBeNull();
    expect(await gate({ id: '00000000-0000-4000-8000-000000000000', role: 'super_admin' })).toBeNull();
    expect(await gate({ id: '00000000-0000-4000-8000-000000000000', role: 'user' })).toBeNull();
    expect(await gate(undefined)).toBeNull();
  });

  t('accepting stores version, time and where from, and opens the gate', async () => {
    const p = await partner();
    const rec = await onboarding.recordAgreement(p.id, { ip: '203.0.113.7', get: () => 'JestAgent/1.0' });
    expect(rec).toMatchObject({ version: PARTNER_GUIDE_VERSION, ip: '203.0.113.7', userAgent: 'JestAgent/1.0' });

    const stored = (await consentOf(p.id)).partnerAgreement;
    expect(stored.version).toBe(PARTNER_GUIDE_VERSION);
    expect(Date.parse(stored.acceptedAt)).not.toBeNaN();

    const s = await onboarding.getOnboarding(p.id);
    expect(s.steps.agreement).toBe(true);
    expect(s.agreementAcceptedAt).toBe(stored.acceptedAt);
    expect(await gate({ id: p.id, role: 'marketing' })).toBeNull();
  });

  t('accepting never disturbs the member-terms consent already on the row', async () => {
    const p = await partner();
    await models.User.update(
      { consent: { termsVersion: '2026-08-26', acceptedAt: '2026-08-26T00:00:00.000Z', marketing: true, history: [] } },
      { where: { id: p.id }, hooks: false },
    );
    await onboarding.recordAgreement(p.id, {});
    const c = await consentOf(p.id);
    expect(c).toMatchObject({ termsVersion: '2026-08-26', marketing: true });
    expect(c.partnerAgreement.version).toBe(PARTNER_GUIDE_VERSION);
  });

  t('a changed guide asks the partner again and keeps the earlier acceptance as history', async () => {
    const p = await partner();
    await sequelize.query(
      `UPDATE "Users" SET consent = jsonb_build_object('partnerAgreement',
         jsonb_build_object('version','2020-01-01','acceptedAt','2020-01-02T00:00:00.000Z')) WHERE id = :id`,
      { replacements: { id: p.id } },
    );
    const before = await onboarding.getOnboarding(p.id);
    expect(before.steps.agreement).toBe(false);
    expect(before.needsReacceptance).toBe(true);
    expect((await gate({ id: p.id, role: 'marketing' })).code).toBe('PARTNER_AGREEMENT_REQUIRED');

    await onboarding.recordAgreement(p.id, {});
    const a = (await consentOf(p.id)).partnerAgreement;
    expect(a.version).toBe(PARTNER_GUIDE_VERSION);
    expect(a.history).toEqual([{ version: '2020-01-01', acceptedAt: '2020-01-02T00:00:00.000Z' }]);
    expect((await onboarding.getOnboarding(p.id)).needsReacceptance).toBe(false);
  });

  t('each step flips on the real thing, and the batch agrees with the single read', async () => {
    const p = await partner();
    const other = await partner();
    await onboarding.recordAgreement(p.id, {});

    await details.saveDetails(p.id, { method: 'upi', upiId: 'priya@okhdfc', accountHolder: 'Priya Sharma', pan: 'ABCDE1234F' });
    await models.ReferralCode.create({ code: `T${uniq().toUpperCase()}`, marketingUserId: p.id, isActive: true, usageCount: 0 });
    await manualLeads.createManualLead({ marketingUserId: p.id, name: 'Asha Verma', phone: '9876501234' });

    const s = await onboarding.getOnboarding(p.id);
    expect(s.steps).toEqual({ agreement: true, payout: true, code: true, outreach: true });
    expect(s).toMatchObject({ completed: 4, complete: true });

    const batch = await onboarding.getOnboardingBatch([p.id, other.id]);
    expect(batch[p.id]).toEqual(s);
    expect(batch[other.id].completed).toBe(0);
    expect(await onboarding.getOnboardingBatch([])).toEqual({});
  });

  t('an unknown account is a 404, not a blank checklist', async () => {
    await expect(onboarding.getOnboarding('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({ statusCode: 404 });
  });

  describe('creating a partner', () => {
    const created = [];
    afterAll(async () => {
      if (created.length) {
        await sequelize.query('DELETE FROM "Profiles" WHERE "userId" IN (:created)', { replacements: { created } }).catch(() => {});
        await sequelize.query('DELETE FROM "Users" WHERE id IN (:created)', { replacements: { created } }).catch(() => {});
      }
    });

    const create = async (over = {}) => {
      const admin = await partner({ role: 'admin' });
      const res = await call(adminCtl.createMarketingUser, {
        user: admin,
        body: { email: `partner-${uniq()}@example.test`, password: 'Str0ng!Passw0rd-xx', firstName: 'Priya', lastName: 'Field', ...over },
      });
      if (res.body?.user?.id) created.push(res.body.user.id);
      return res;
    };

    t('emails the welcome note, with the name and without the password', async () => {
      email.sendPartnerWelcome.mockClear();
      const res = await create();
      expect(res.statusCode).toBe(201);
      expect(res.body.welcomeEmailSent).toBe(true);
      expect(email.sendPartnerWelcome).toHaveBeenCalledTimes(1);
      const args = email.sendPartnerWelcome.mock.calls[0];
      expect(args[0]).toBe(res.body.user.email);
      expect(args[1]).toBe('Priya');
      expect(JSON.stringify(args)).not.toContain('Str0ng!Passw0rd-xx');
    });

    t('still creates the account when the mail cannot be sent, and says so', async () => {
      email.sendPartnerWelcome.mockRejectedValueOnce(new Error('resend down'));
      const res = await create();
      expect(res.statusCode).toBe(201);
      expect(res.body.welcomeEmailSent).toBe(false);
      expect(res.body.user.id).toBeTruthy();
    });

    t('lists each partner with their setup progress for the admin', async () => {
      const res = await create();
      const admin = await partner({ role: 'admin' });
      const list = await call(adminCtl.getMarketingUsers, { user: admin, query: { limit: '100' } });
      const row = list.body.users.find((u) => u.id === res.body.user.id);
      expect(row).toBeTruthy();
      expect(row.onboarding.steps).toEqual({ agreement: false, payout: false, code: false, outreach: false });
      expect(row.onboarding.total).toBe(4);
      expect(row.password).toBeUndefined();
    });
  });
});
