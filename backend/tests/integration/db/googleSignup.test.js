/**
 * Google sign-in creates accounts on the same terms as email/phone signup:
 * explicit Terms consent (with a code the client can act on), the same partner
 * / member / hand-added-lead credit, no invented gender or date of birth, and
 * a full user in the response. Real routes and database; only Google's token
 * check is stubbed.
 */

const PRIOR_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';

const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({ verifyIdToken: (...a) => mockVerifyIdToken(...a) })),
}));
jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendSecurityAlert: jest.fn(async () => true),
}));
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => true) }));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

const rand = () => Math.random().toString(36).slice(2, 10);

describeDb('Google sign-in / sign-up', (t) => {
  const ids = [];
  let app; let models; let sequelize;

  beforeAll(() => {
    sequelize = require('../../../config/database');
    models = require('../../../models');
    const { sanitizeRequest, extractIp } = require('../../../middlewares/security');
    const { errorHandler } = require('../../../middlewares/errorHandler');
    app = express();
    app.set('trust proxy', true);
    app.use(extractIp);
    app.use(cookieParser('test-cookie-secret-for-testing'));
    app.use(express.json());
    app.use(sanitizeRequest);
    app.use('/api/auth', require('../../../routes/authRoutes'));
    app.use(errorHandler);
  });

  afterAll(async () => {
    const rows = await models.User.findAll({ where: { email: { [require('sequelize').Op.like]: 'gs-%@example.test' } }, attributes: ['id'] });
    const all = [...ids, ...rows.map((r) => r.id)];
    if (all.length) {
      await sequelize.query('DELETE FROM "MarketingLeads" WHERE "convertedUserId" IN (:all) OR "assignedToMarketingUserId" IN (:all)', { replacements: { all } }).catch(() => {});
      await sequelize.query('DELETE FROM "ReferralCodes" WHERE "marketingUserId" IN (:all)', { replacements: { all } }).catch(() => {});
      await sequelize.query('DELETE FROM "RefreshTokens" WHERE "userId" IN (:all)', { replacements: { all } }).catch(() => {});
    }
    await removeMembers(all);
    if (PRIOR_CLIENT_ID === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = PRIOR_CLIENT_ID;
  });

  const googleAs = (email, extra = {}) => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: `g-${rand()}`, email, email_verified: true, given_name: 'Gita', family_name: 'Sandhu', ...extra }),
    });
  };
  const post = (body) => request(app).post('/api/auth/google')
    .set('X-Forwarded-For', `203.0.113.${Math.floor(Math.random() * 250) + 1}`)
    .send({ credential: 'google-id-token', ...body });

  t('a new Google account needs Terms consent, and says so with a code', async () => {
    const email = `gs-${rand()}@example.test`;
    googleAs(email);
    const res = await post({});
    expect(res.status).toBe(400);
    expect(res.body.error?.code || res.body.code).toBe('GOOGLE_CONSENT_REQUIRED');
    expect(await models.User.count({ where: { email } })).toBe(0);
  });

  t('creates the account with no invented gender or date of birth, and returns the full user', async () => {
    const email = `gs-${rand()}@example.test`;
    googleAs(email);
    const res = await post({ termsAccepted: true });
    expect(res.status).toBe(201);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.user.onboardingComplete).toBe(false);
    expect(res.body.user.Profile).toMatchObject({ firstName: 'Gita', lastName: 'Sandhu', gender: null, dateOfBirth: null });
    const user = await models.User.findOne({ where: { email } });
    ids.push(user.id);
    expect(user.emailVerified).toBe(true);
    expect(user.password).toBeNull();
  });

  t('a partner referral code credits the partner exactly as email signup does', async () => {
    const rep = await makeMember({ user: { role: 'marketing' } }); ids.push(rep.user.id);
    const code = `GS${rand().toUpperCase()}`.slice(0, 12);
    await models.ReferralCode.create({ code, marketingUserId: rep.user.id, campaign: 'google test' });
    const email = `gs-${rand()}@example.test`;
    googleAs(email);
    const res = await post({ termsAccepted: true, referralCode: code.toLowerCase() });
    expect(res.status).toBe(201);
    const user = await models.User.findOne({ where: { email } }); ids.push(user.id);
    expect(user.referredByMarketingUserId).toBe(rep.user.id);
    expect(user.referralCodeUsed).toBe(code);
    expect(user.isBoosted).toBe(true);
    const lead = await models.MarketingLead.findOne({ where: { convertedUserId: user.id } });
    expect(lead).toMatchObject({ assignedToMarketingUserId: rep.user.id, referralCode: code, email });
    expect((await models.ReferralCode.findOne({ where: { code } })).usageCount).toBe(1);
  });

  t("a partner's hand-added lead with this email is converted", async () => {
    const rep = await makeMember({ user: { role: 'marketing' } }); ids.push(rep.user.id);
    const email = `gs-${rand()}@example.test`;
    const { createManualLead } = require('../../../utils/manualLeads');
    const lead = await createManualLead({ marketingUserId: rep.user.id, name: 'Lead Person', phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`, email });
    googleAs(email);
    const res = await post({ termsAccepted: true });
    expect(res.status).toBe(201);
    const user = await models.User.findOne({ where: { email } }); ids.push(user.id);
    expect(user.referredByMarketingUserId).toBe(rep.user.id);
    expect(user.isBoosted).toBe(false);
    const fresh = await models.MarketingLead.findByPk(lead.id);
    expect(fresh.convertedUserId).toBe(user.id);
  });

  t("a member's referral code sets invitedBy", async () => {
    const referrer = await makeMember(); ids.push(referrer.user.id);
    const { getOrCreateMemberCode } = require('../../../utils/referral');
    const memberCode = await getOrCreateMemberCode(referrer.user.id);
    const email = `gs-${rand()}@example.test`;
    googleAs(email);
    const res = await post({ termsAccepted: true, referralCode: memberCode });
    expect(res.status).toBe(201);
    const user = await models.User.findOne({ where: { email } }); ids.push(user.id);
    expect(user.invitedBy).toBe(referrer.user.id);
  });

  t('an existing member signs in without consent being asked again', async () => {
    const existing = await makeMember(); ids.push(existing.user.id);
    await existing.user.update({ emailVerified: true });
    googleAs(existing.user.email);
    const res = await post({});
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
    expect(res.body.user.id).toBe(existing.user.id);
    expect(res.body.user.onboardingComplete).toBeDefined();
  });
});
