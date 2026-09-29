/**
 * STAFF_MFA_REQUIRED gate (audit P0 MFA / P1-13). Config is deep-frozen at load,
 * so the flag is set in the environment before anything is required.
 */

process.env.STAFF_MFA_REQUIRED = 'true';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

describeDb('staff two-step gate', (t) => {
  const ids = [];
  afterAll(async () => { await removeMembers(ids); });

  t('staff without an enrolled second factor are held out of admin and marketing', async () => {
    const config = require('../../../config/env');
    expect(config.features.staffMfaRequired).toBe(true);
    const mw = require('../../../middlewares/auth');
    const { errorHandler } = require('../../../middlewares/errorHandler');
    const app = express();
    const ok = (req, res) => res.json({ ok: true });
    app.get('/admin', mw.auth, mw.adminAuth, ok);
    app.get('/marketing', mw.auth, mw.marketingAuth, ok);
    app.use(errorHandler);

    const mk = async (user) => { const m = await makeMember({ user }); ids.push(m.user.id); return m.user; };
    const tok = (u) => `Bearer ${jwt.sign({ userId: u.id, type: 'access' }, config.auth.jwtSecret, { expiresIn: '5m' })}`;
    const bare = await mk({ role: 'admin' });
    const enrolled = await mk({ role: 'admin', mfaEnabledAt: new Date() });
    const rep = await mk({ role: 'marketing' });

    const denied = await request(app).get('/admin').set('Authorization', tok(bare));
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.body)).toContain('MFA_ENROLLMENT_REQUIRED');
    expect((await request(app).get('/admin').set('Authorization', tok(enrolled))).status).toBe(200);
    expect((await request(app).get('/marketing').set('Authorization', tok(rep))).status).toBe(403);
  });
});
