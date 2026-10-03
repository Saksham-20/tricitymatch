/**
 * CHAT-23: invite -> revoke -> invite must not be a way to mail the same
 * address repeatedly; revoked and expired invites count toward the limits.
 */
jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendGuardianInvite: jest.fn(async () => true),
  sendAccountHandover: jest.fn(async () => true),
  sendSecurityAlert: jest.fn(async () => true),
}));
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const { describeDb, makeMember, removeMembers, uniq } = require('../../helpers/db');

const PASSWORD = 'Str0ng!Pass-2026';

describeDb('guardian invite abuse limits', (t) => {
  const ids = [];
  let app; let config; let email;
  const member = async () => {
    const m = await makeMember({ user: { password: PASSWORD, emailVerified: true } });
    ids.push(m.user.id);
    return m.user;
  };
  const as = (u) => ({ Authorization: `Bearer ${jwt.sign({ userId: u.id, type: 'access' }, config.auth.jwtSecret, { expiresIn: '5m' })}` });
  const invite = (u, address) => request(app).post('/guardian/invite').set(as(u)).send({ email: address });
  const addr = () => `g-${uniq()}@example.test`;

  beforeAll(() => {
    config = require('../../../config/env');
    email = require('../../../utils/email');
    const { errorHandler } = require('../../../middlewares/errorHandler');
    app = express();
    app.use(express.json());
    app.use('/guardian', require('../../../routes/guardianRoutes'));
    app.use(errorHandler);
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) {
      await sequelize.query('DELETE FROM "GuardianLinks" WHERE "candidateId" IN (:ids) OR "guardianId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    }
    await removeMembers(ids);
  });

  t('invite, revoke, invite again to the same address is refused and mails once', async () => {
    const me = await member();
    const address = addr();
    const first = await invite(me, address);
    expect(first.status).toBe(200);
    const revoke = await request(app).delete(`/guardian/${first.body.linkId}`).set(as(me));
    expect(revoke.status).toBe(200);
    const again = await invite(me, address);
    expect(again.status).toBe(429);
    expect(email.sendGuardianInvite).toHaveBeenCalledTimes(1);
  });

  t('one address cannot be invited by many different members in a day', async () => {
    const address = addr();
    const a = await member(); const b = await member(); const c = await member();
    expect((await invite(a, address)).status).toBe(200);
    expect((await invite(b, address)).status).toBe(200);
    expect((await invite(c, address)).status).toBe(429);
    expect(email.sendGuardianInvite).toHaveBeenCalledTimes(2);
  });

  t('a member cannot send unlimited invites in a day, even with revokes freeing the slots', async () => {
    const me = await member();
    let blocked = null;
    for (let i = 0; i < 8; i += 1) {
      const r = await invite(me, addr());
      if (r.status === 200) await request(app).delete(`/guardian/${r.body.linkId}`).set(as(me));
      else { blocked = i; break; }
    }
    expect(blocked).toBe(6);
  });

  t('ordinary use is unaffected: a fresh address from a fresh member still works', async () => {
    const me = await member();
    expect((await invite(me, addr())).status).toBe(200);
  });
});
