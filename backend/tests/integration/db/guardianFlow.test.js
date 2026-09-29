/**
 * Guardian invites and profile hand-over on a real database (audit P1-14).
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

const DAY = 86400000;
const PASSWORD = 'Str0ng!Pass-2026';

describeDb('guardian invites and hand-over', (t) => {
  const ids = [];
  let app; let config; let email; let GuardianLink; let RefreshToken;

  const member = async (user = {}) => {
    const m = await makeMember({ user: { password: PASSWORD, emailVerified: true, ...user } });
    ids.push(m.user.id);
    return m.user;
  };
  const as = (u) => ({ Authorization: `Bearer ${jwt.sign({ userId: u.id, type: 'access' }, config.auth.jwtSecret, { expiresIn: '5m' })}` });
  const inviteBody = (address) => ({ email: address });

  beforeAll(() => {
    config = require('../../../config/env');
    email = require('../../../utils/email');
    ({ GuardianLink, RefreshToken } = require('../../../models'));
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
      await sequelize.query('DELETE FROM "RefreshTokens" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    }
    await removeMembers(ids);
  });

  t('inviting a member creates a PENDING link: the guardian sees nothing until they accept', async () => {
    const candidate = await member(); const guardian = await member();
    const res = await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(guardian.email));
    expect(res.status).toBe(200);
    expect(res.body.method).toBe('pending');

    const link = await GuardianLink.findByPk(res.body.linkId);
    expect(link.status).toBe('pending');
    expect(link.guardianId).toBe(guardian.id);

    expect((await request(app).get('/guardian/my-candidates').set(as(guardian))).body.candidates).toEqual([]);
    expect((await request(app).get(`/guardian/candidate/${candidate.id}/matches`).set(as(guardian))).status).toBe(403);

    const pending = await request(app).get('/guardian/pending-invites').set(as(guardian));
    expect(pending.body.invites).toHaveLength(1);

    const accepted = await request(app).post(`/guardian/${link.id}/accept`).set(as(guardian));
    expect(accepted.status).toBe(200);
    expect((await request(app).get('/guardian/my-candidates').set(as(guardian))).body.candidates).toHaveLength(1);
    expect((await request(app).get(`/guardian/candidate/${candidate.id}/matches`).set(as(guardian))).status).toBe(200);
  });

  t('the reply does not reveal whether the address belongs to a member', async () => {
    const candidate = await member(); const guardian = await member();
    const known = await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(guardian.email));
    const unknown = await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(`nobody-${uniq()}@example.test`));
    const { linkId: _a, ...k } = known.body; const { linkId: _b, ...u } = unknown.body;
    expect(k).toEqual(u);
  });

  t('a member address matches regardless of letter case', async () => {
    const candidate = await member(); const guardian = await member();
    const res = await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(guardian.email.toUpperCase()));
    expect(res.status).toBe(200);
    expect((await GuardianLink.findByPk(res.body.linkId)).guardianId).toBe(guardian.id);
  });

  t('an invite to a non-member is emailed with a token link, and only the hash is stored', async () => {
    const candidate = await member();
    const address = `newcomer-${uniq()}@example.test`;
    const res = await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(address));
    expect(res.status).toBe(200);

    expect(email.sendGuardianInvite).toHaveBeenCalledTimes(1);
    const [to, , , link] = email.sendGuardianInvite.mock.calls[0];
    expect(to).toBe(address);
    const token = new URL(link).searchParams.get('invite');
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const row = await GuardianLink.findByPk(res.body.linkId);
    expect(row.inviteToken).not.toBe(token);
    expect(row.inviteToken).toMatch(/^[0-9a-f]{64}$/);

    // The invited person joins, follows the emailed link, and it works once.
    const newcomer = await member({ email: address });
    const ok = await request(app).post(`/guardian/resolve-invite/${token}`).set(as(newcomer));
    expect(ok.status).toBe(200);
    expect((await GuardianLink.findByPk(row.id)).status).toBe('active');
    const again = await request(app).post(`/guardian/resolve-invite/${token}`).set(as(newcomer));
    expect(again.status).toBe(404);
  });

  t('a new member with the invited (verified) address can accept without the token; an unverified one cannot', async () => {
    const candidate = await member();
    const address = `later-${uniq()}@example.test`;
    const inv = await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(address));

    const claimant = await member({ email: address, emailVerified: false });
    expect((await request(app).get('/guardian/pending-invites').set(as(claimant))).body.invites).toEqual([]);
    expect((await request(app).post(`/guardian/${inv.body.linkId}/accept`).set(as(claimant))).status).toBe(404);
    await claimant.update({ emailVerified: true });
    expect((await request(app).get('/guardian/pending-invites').set(as(claimant))).body.invites).toHaveLength(1);
    expect((await request(app).post(`/guardian/${inv.body.linkId}/accept`).set(as(claimant))).status).toBe(200);
  });

  t('someone the invite is not for cannot accept or decline it', async () => {
    const candidate = await member(); const guardian = await member(); const stranger = await member();
    const inv = await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(guardian.email));
    expect((await request(app).post(`/guardian/${inv.body.linkId}/accept`).set(as(stranger))).status).toBe(404);
    expect((await request(app).post(`/guardian/${inv.body.linkId}/decline`).set(as(stranger))).status).toBe(404);
    expect((await GuardianLink.findByPk(inv.body.linkId)).status).toBe('pending');
  });

  t('declining closes the invite', async () => {
    const candidate = await member(); const guardian = await member();
    const inv = await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(guardian.email));
    expect((await request(app).post(`/guardian/${inv.body.linkId}/decline`).set(as(guardian))).status).toBe(200);
    expect((await GuardianLink.findByPk(inv.body.linkId)).status).toBe('revoked');
    expect((await request(app).post(`/guardian/${inv.body.linkId}/accept`).set(as(guardian))).status).toBe(404);
  });

  t('expired invites do not hold a slot, cannot be accepted, and are closed by the sweeper', async () => {
    const candidate = await member(); const guardian = await member();
    const past = new Date(Date.now() - DAY);
    for (let i = 0; i < 3; i += 1) {
      await GuardianLink.create({
        candidateId: candidate.id, guardianId: null, inviteEmail: `old-${i}-${uniq()}@example.test`,
        inviteToken: `${uniq()}${uniq()}`, inviteExpiresAt: past, status: 'pending',
      });
    }
    const listed = await request(app).get('/guardian/my-guardians').set(as(candidate));
    expect(listed.body.guardians).toEqual([]);

    // Cap is 3; three stale pendings must not block a fresh invite.
    const fresh = await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(guardian.email));
    expect(fresh.status).toBe(200);

    const stale = await GuardianLink.create({
      candidateId: candidate.id, guardianId: guardian.id, inviteEmail: guardian.email,
      inviteToken: null, inviteExpiresAt: past, status: 'pending',
    });
    expect((await request(app).post(`/guardian/${stale.id}/accept`).set(as(guardian))).status).toBe(404);

    const { expireStaleInvites } = require('../../../utils/guardianInvites');
    expect(await expireStaleInvites()).toBeGreaterThanOrEqual(1);
    expect((await GuardianLink.findByPk(stale.id)).status).toBe('revoked');
  });

  t('the guardian cap still applies to live links, and duplicates are refused', async () => {
    const candidate = await member();
    const addresses = [1, 2, 3].map(() => `g-${uniq()}@example.test`);
    for (const a of addresses) expect((await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(a))).status).toBe(200);
    expect((await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(`g4-${uniq()}@example.test`))).status).toBe(400);
  });

  t('inviting the same address twice is refused while the first is live', async () => {
    const candidate = await member();
    const address = `dup-${uniq()}@example.test`;
    expect((await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(address))).status).toBe(200);
    expect((await request(app).post('/guardian/invite').set(as(candidate)).send(inviteBody(address.toUpperCase()))).status).toBe(409);
  });

  t('you cannot invite yourself', async () => {
    const me = await member();
    const res = await request(app).post('/guardian/invite').set(as(me)).send(inviteBody(me.email));
    expect(res.status).toBe(400);
  });

  // ── hand-over ───────────────────────────────────────────────────────────────

  t('hand-over needs the current password', async () => {
    const manager = await member();
    const res = await request(app).post('/guardian/handover').set(as(manager)).send({ email: `owner-${uniq()}@example.test`, password: 'wrong-Password-1!' });
    expect(res.status).toBe(401);
    expect(email.sendAccountHandover).not.toHaveBeenCalled();
  });

  t('hand-over to an address that already has an account is refused', async () => {
    const manager = await member(); const other = await member();
    const res = await request(app).post('/guardian/handover').set(as(manager)).send({ email: other.email, password: PASSWORD });
    expect(res.status).toBe(409);
    expect(email.sendAccountHandover).not.toHaveBeenCalled();
  });

  t('hand-over: the owner takes the account, the manager is locked out, the link works once', async () => {
    const { User } = require('../../../models');
    const manager = await member({ phone: `98${String(Date.now()).slice(-8)}`, phoneVerified: true });
    await RefreshToken.create({
      userId: manager.id, tokenHash: `h${uniq()}${uniq()}${uniq()}${uniq()}`.padEnd(64, '0').slice(0, 64),
      family: '00000000-0000-4000-8000-000000000001', expiresAt: new Date(Date.now() + DAY),
    });
    const ownerEmail = `Owner-${uniq()}@Example.test`;
    const start = await request(app).post('/guardian/handover').set(as(manager)).send({ email: ownerEmail, password: PASSWORD, ownerName: 'Asha' });
    expect(start.status).toBe(200);
    const [to, , , link] = email.sendAccountHandover.mock.calls[0];
    expect(to).toBe(ownerEmail.toLowerCase());
    const token = new URL(link).searchParams.get('token');

    const weak = await request(app).post('/guardian/handover/complete').send({ token, password: 'weak' });
    expect(weak.status).toBe(400);

    const newPassword = 'Own3r!Pass-2026';
    const done = await request(app).post('/guardian/handover/complete').send({ token, password: newPassword });
    expect(done.status).toBe(200);

    const fresh = await User.findByPk(manager.id);
    expect(fresh.email).toBe(ownerEmail.toLowerCase());
    expect(fresh.emailVerified).toBe(true);
    expect(fresh.phone).toBeNull();
    expect(fresh.phoneVerified).toBe(false);
    expect(await fresh.comparePassword(newPassword)).toBe(true);
    expect(await fresh.comparePassword(PASSWORD)).toBe(false);
    expect(await RefreshToken.count({ where: { userId: manager.id, isRevoked: false } })).toBe(0);
    expect(email.sendSecurityAlert).toHaveBeenCalledTimes(1);

    const replay = await request(app).post('/guardian/handover/complete').send({ token, password: newPassword });
    expect(replay.status).toBe(400);
  });

  t('a made-up hand-over token does nothing', async () => {
    const res = await request(app).post('/guardian/handover/complete').send({ token: 'a'.repeat(64), password: 'Own3r!Pass-2026' });
    expect(res.status).toBe(400);
  });
});
