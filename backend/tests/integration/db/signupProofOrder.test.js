/**
 * Signup answers existence only to someone who proved the contact (AUTH-01),
 * and stores only contacts that were proved (AUTH-03); referral leads never get
 * a literal "undefined undefined" name (AUTH-24). Real routes and database.
 */

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

const PASSWORD = 'Str0ng!Pass-2026';
const rand = () => Math.random().toString(36).slice(2, 10);
const mobile = () => `9${Math.floor(Math.random() * 1e9).toString().padStart(9, '0')}`;

describeDb('signup proof ordering', (t) => {
  const ids = [];
  let app; let sequelize; let email;
  beforeAll(() => {
    sequelize = require('../../../config/database');
    email = require('../../../utils/email');
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
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    const { User } = require('../../../models');
    const rows = await User.findAll({ where: { email: { [require('sequelize').Op.like]: 'sp-%@example.test' } }, attributes: ['id'] });
    const all = [...ids, ...rows.map((r) => r.id)];
    if (all.length) {
      await sequelize.query('DELETE FROM "MarketingLeads" WHERE "convertedUserId" IN (:all)', { replacements: { all } }).catch(() => {});
      await sequelize.query('DELETE FROM "RefreshTokens" WHERE "userId" IN (:all)', { replacements: { all } }).catch(() => {});
    }
    await removeMembers(all);
  });

  const signup = (body, ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`) =>
    request(app).post('/api/auth/signup').set('X-Forwarded-For', ip).send({ password: PASSWORD, termsAccepted: true, firstName: 'Sam', lastName: 'Test', ...body });

  t('an unproved caller gets the SAME generic 400 for a taken and a free contact (no 409 oracle)', async () => {
    const taken = await makeMember({ user: { phone: mobile(), phoneVerified: true } });
    ids.push(taken.user.id);
    const free = `sp-${rand()}@example.test`;

    const a = await signup({ email: taken.user.email });
    const b = await signup({ email: free });
    const c = await signup({ phone: taken.user.phone });

    expect([a.status, b.status, c.status]).toEqual([400, 400, 400]);
    const msg = (r) => r.body.message || r.body.error?.message;
    expect(msg(a)).toBe(msg(b));
    expect(msg(c)).toBe(msg(b));
    expect(msg(a)).not.toMatch(/already exists/i);
  });

  t('a caller who proved the contact is told it already exists (a race the gate missed)', async () => {
    const taken = await makeMember({ user: { password: PASSWORD } });
    ids.push(taken.user.id);
    const { issueProof } = require('../../../utils/otpProof');
    const proof = await issueProof('email', taken.user.email.toLowerCase());
    const res = await signup({ email: taken.user.email, emailProof: proof });
    expect(res.status).toBe(409);
  });

  t('an email typed beside a proved phone is NOT stored, mailed, or usable for reset', async () => {
    const { issueProof } = require('../../../utils/otpProof');
    const smsService = require('../../../utils/smsService');
    const phone = mobile();
    const victim = `sp-${rand()}@example.test`;
    const phoneProof = await issueProof('phone', smsService.normalizePhone(phone));

    const res = await signup({ email: victim, phone, phoneProof });
    expect(res.status).toBe(201);
    ids.push(res.body.user.id);
    expect(res.body.user.email).toBeNull();
    expect(res.body.user.phone).toBe(phone);
    await new Promise((r) => setImmediate(r));
    expect(email.sendWelcomeEmail).not.toHaveBeenCalled();

    const { User } = require('../../../models');
    expect(await User.count({ where: { email: victim } })).toBe(0);
  });

  t('a proved email still gets its account, the welcome mail, and emailVerified', async () => {
    const { issueProof } = require('../../../utils/otpProof');
    const addr = `sp-${rand()}@example.test`;
    const proof = await issueProof('email', addr);
    const res = await signup({ email: addr, emailProof: proof });
    expect(res.status).toBe(201);
    ids.push(res.body.user.id);
    expect(res.body.user.email).toBe(addr);
    expect(res.body.user.emailVerified).toBe(true);
    await new Promise((r) => setImmediate(r));
    expect(email.sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  t('a referral signup with no names records the lead as "New member", never "undefined undefined"', async () => {
    const { ReferralCode, MarketingLead } = require('../../../models');
    const rep = (await makeMember({ user: { role: 'marketing' } })).user;
    ids.push(rep.id);
    const code = `SP${rand().toUpperCase()}`.slice(0, 10);
    await ReferralCode.create({ code, marketingUserId: rep.id, isActive: true, campaignName: 'test' });
    const { issueProof } = require('../../../utils/otpProof');
    const addr = `sp-${rand()}@example.test`;
    const proof = await issueProof('email', addr);
    const res = await request(app).post('/api/auth/signup').set('X-Forwarded-For', '198.51.100.77')
      .send({ email: addr, emailProof: proof, password: PASSWORD, termsAccepted: true, referralCode: code });
    expect(res.status).toBe(201);
    ids.push(res.body.user.id);
    const lead = await MarketingLead.findOne({ where: { convertedUserId: res.body.user.id } });
    expect(lead.name).toBe('New member');
    await MarketingLead.destroy({ where: { convertedUserId: res.body.user.id } });
    await ReferralCode.destroy({ where: { code } });
  });
});
