/**
 * Appeals from members who joined by phone. Signup stores only a contact the
 * member proved, so a phone signup has no email, and an appeal form keyed by
 * email alone answered "received" and quietly dropped their appeal. The form
 * now takes the account's mobile number as well, with the same answer for a
 * hit and a miss, and a miss is logged with the number hashed.
 */

// Set before anything loads the (frozen) config.
process.env.ALERT_EMAILS = ' Safety@Example.com , support@tricitymatch.com,safety@example.com,,not-an-address';

jest.mock('../../../utils/email', () => ({ sendEmail: jest.fn(async () => ({ success: true })) }));
jest.mock('../../../middlewares/logger', () => {
  const actual = jest.requireActual('../../../middlewares/logger');
  return {
    ...actual,
    log: { ...actual.log, info: jest.fn(), warn: jest.fn() },
    logAudit: jest.fn(),
  };
});

const express = require('express');
const request = require('supertest');
const { describeDb, makeMember, removeMembers, call, uniq } = require('../../helpers/db');

const STATEMENT = 'I believe this suspension was a mistake. Please look at my account again.';
const STAFF = ['support@tricitymatch.com', 'safety@example.com'];

// A number no other test row can hold: 9 then nine digits from a random tag.
const freshPhone = () => `9${String(parseInt(uniq(), 16)).padStart(9, '0').slice(-9)}`;
const spaced = (p) => `+91 ${p.slice(0, 5)} ${p.slice(5)}`;

describeDb('appeals by mobile number', (t) => {
  const ids = [];
  let ctl; let Appeal; let sendEmail; let log; let redactValue;

  beforeAll(() => {
    ctl = require('../../../controllers/appealController');
    ({ Appeal } = require('../../../models'));
    ({ sendEmail } = require('../../../utils/email'));
    ({ log, redactValue } = require('../../../middlewares/logger'));
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "Appeals" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });

  const mk = async (user) => { const m = await makeMember({ user }); ids.push(m.user.id); return m.user; };
  const appeal = (body) => call(ctl.submitAppeal, { body: { statement: STATEMENT, ...body } });
  const appealsFor = (userId) => Appeal.findAll({ where: { userId } });

  t('a member who joined by phone appeals with the number typed as +91 and spaces; the appeal is stored and staff are told how to reach them', async () => {
    const phone = freshPhone();
    const member = await mk({ email: null, phone, phoneVerified: true, emailVerified: false, status: 'banned' });

    const res = await appeal({ phone: spaced(phone) });

    expect(res.statusCode).toBe(202);
    const rows = await appealsFor(member.id);
    expect(rows).toHaveLength(1);
    // No email on the account, so the reviewer sees the number to reply on.
    expect(rows[0].email).toBe(`+91${phone}`);
    expect(rows[0].statement).toBe(STATEMENT);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toEqual(STAFF);
    expect(mail.replyTo).toBeUndefined();
    expect(mail.text).toContain(`+91${phone}`);
    expect(mail.text).toMatch(/no confirmed email/i);
  });

  t('an unknown number gets the very same answer, stores nothing, and is logged only as a hash', async () => {
    const hitPhone = freshPhone();
    await mk({ email: null, phone: hitPhone, phoneVerified: true, status: 'banned' });
    const hit = await appeal({ phone: hitPhone });

    const missPhone = freshPhone();
    const before = await Appeal.count();
    const miss = await appeal({ phone: spaced(missPhone) });

    expect(miss.statusCode).toBe(202);
    expect(miss.body).toEqual(hit.body);
    expect(await Appeal.count()).toBe(before);

    const [message, meta] = log.info.mock.calls.find(([m]) => /did not match/.test(m));
    expect(message).toMatch(/Appeal did not match a suspended member/);
    const written = JSON.stringify(redactValue(meta));
    expect(written).not.toContain(missPhone);
    expect(written).toMatch(/#[0-9a-f]{8}/);
  });

  t('a number on an account that is not suspended stores nothing', async () => {
    const phone = freshPhone();
    const active = await mk({ email: null, phone, phoneVerified: true, status: 'active' });
    const res = await appeal({ phone });
    expect(res.statusCode).toBe(202);
    expect(await appealsFor(active.id)).toHaveLength(0);
  });

  t('the separate contact number on an account finds it too', async () => {
    const loginPhone = freshPhone();
    const contactPhone = freshPhone();
    const member = await mk({ email: null, phone: loginPhone, phoneVerified: true, contactPhone, status: 'inactive' });
    await appeal({ phone: `0${contactPhone}` });
    const rows = await appealsFor(member.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(`+91${contactPhone}`);
  });

  t('an appeal by mobile on an account with a proven email is answered at that email', async () => {
    const phone = freshPhone();
    const address = `it-${uniq()}@example.test`;
    const member = await mk({ email: address, emailVerified: true, phone, phoneVerified: true, status: 'banned' });
    await appeal({ phone });
    const rows = await appealsFor(member.id);
    expect(rows[0].email).toBe(address);
    expect(sendEmail.mock.calls[0][0].replyTo).toBe(address);
  });

  t('an appeal by email still works as before', async () => {
    const member = await mk({ status: 'banned', emailVerified: true });
    const res = await appeal({ email: member.email.toUpperCase() });
    expect(res.statusCode).toBe(202);
    const rows = await appealsFor(member.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(member.email);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toEqual(STAFF);
    expect(mail.replyTo).toBe(member.email);
  });

  t('a second appeal while one is open is not stacked', async () => {
    const phone = freshPhone();
    const member = await mk({ email: null, phone, phoneVerified: true, status: 'banned' });
    await appeal({ phone });
    await appeal({ phone: spaced(phone) });
    expect(await appealsFor(member.id)).toHaveLength(1);
  });

  t('staff accounts cannot appeal by number either', async () => {
    const phone = freshPhone();
    const staff = await mk({ email: null, phone, role: 'marketing', status: 'banned' });
    await appeal({ phone });
    expect(await appealsFor(staff.id)).toHaveLength(0);
  });

  t('the route validator takes an email or a mobile number, and nothing else', async () => {
    const { appealValidation } = require('../../../validators');
    const { handleValidationErrors } = require('../../../middlewares/errorHandler');
    const app = express();
    app.use(express.json());
    app.post('/appeals', appealValidation, handleValidationErrors, (req, res) => res.status(202).json({ ok: true }));

    const post = (body) => request(app).post('/appeals').send({ statement: STATEMENT, ...body });
    expect((await post({ phone: '+91 98765 43210' })).status).toBe(202);
    expect((await post({ phone: '09876543210' })).status).toBe(202);
    expect((await post({ email: 'someone@example.com' })).status).toBe(202);
    expect((await post({})).status).toBe(400);
    expect((await post({ phone: '12345' })).status).toBe(400);
    expect((await post({ phone: '5876543210' })).status).toBe(400);
    expect((await post({ email: 'not-an-email' })).status).toBe(400);
    expect((await post({ phone: '9876543210', statement: 'too short' })).status).toBe(400);
  });

  t('the public /appeals route uses that validator (an email-only check would refuse a number)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'routes', 'index.js'), 'utf8');
    expect(src).toMatch(/router\.post\('\/appeals',\s*contactLimiter,\s*appealValidation,\s*handleValidationErrors,/);
  });
});
