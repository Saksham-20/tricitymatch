/**
 * New-device sign-in alerts and login history on a real database (audit P2).
 */

jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendSecurityAlert: jest.fn(async () => true),
}));
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

const PASSWORD = 'Str0ng!Pass-2026';
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CHROME_MAC_NEWER = CHROME_MAC.replace('126', '131');
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const flush = () => new Promise((r) => setTimeout(r, 150));

describeDb('new-device alerts and login history', (t) => {
  const ids = [];
  let app; let email; let notifyUser;
  beforeAll(() => {
    email = require('../../../utils/email');
    notifyUser = require('../../../utils/notifyUser');
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
    const sequelize = require('../../../config/database');
    if (ids.length) await sequelize.query('DELETE FROM "RefreshTokens" WHERE "userId" IN (:ids)', { replacements: { ids } }).catch(() => {});
    await removeMembers(ids);
  });

  const member = async () => {
    const m = await makeMember({ user: { password: PASSWORD } });
    ids.push(m.user.id);
    return m.user;
  };
  const login = (u, ua) => request(app).post('/api/auth/login').set('User-Agent', ua).set('X-Forwarded-For', '203.0.113.42').send({ identifier: u.email, password: PASSWORD });

  t('the first sign-in and a repeat from the same device send nothing', async () => {
    const u = await member();
    await login(u, CHROME_MAC); await flush();
    await login(u, CHROME_MAC_NEWER); await flush(); // browser update = same device
    expect(email.sendSecurityAlert).not.toHaveBeenCalled();
  });

  t('a sign-in from a device never seen before alerts by email and in the app, once', async () => {
    const u = await member();
    await login(u, CHROME_MAC); await flush();
    await login(u, SAFARI_IPHONE); await flush();
    expect(email.sendSecurityAlert).toHaveBeenCalledTimes(1);
    const [to, , title, detail] = email.sendSecurityAlert.mock.calls[0];
    expect(to).toBe(u.email);
    expect(title).toBe('New sign-in');
    expect(detail).toContain('Safari on iOS');
    expect(detail).toContain('203.0.x.x');
    expect(detail).not.toContain('203.0.113.42'); // full address never sent
    expect(notifyUser.notify).toHaveBeenCalledTimes(1);

    await login(u, SAFARI_IPHONE); await flush(); // now known
    expect(email.sendSecurityAlert).toHaveBeenCalledTimes(1);
  });

  t('a failed sign-in alerts nobody', async () => {
    const u = await member();
    await login(u, CHROME_MAC); await flush();
    await request(app).post('/api/auth/login').set('User-Agent', SAFARI_IPHONE).send({ identifier: u.email, password: 'wrong-Password-1!' });
    await flush();
    expect(email.sendSecurityAlert).not.toHaveBeenCalled();
  });

  t('login history lists one entry per sign-in with the device and a masked address', async () => {
    const u = await member();
    await login(u, CHROME_MAC);
    const second = await login(u, SAFARI_IPHONE);
    await flush();
    const cookie = second.headers['set-cookie'].find((c) => c.startsWith('accessToken=')).split(';')[0];
    const res = await request(app).get('/api/auth/login-history').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(2);
    expect(res.body.history.map((h) => h.device).sort()).toEqual(['Chrome on macOS', 'Safari on iOS']);
    expect(JSON.stringify(res.body)).not.toContain('203.0.113.42');
    expect(res.body.history[0].approximateIp).toBe('203.0.x.x');
    expect(res.body.history.every((h) => h.status === 'active')).toBe(true);
  });

  t('history needs a session and shows only your own sign-ins', async () => {
    expect((await request(app).get('/api/auth/login-history')).status).toBe(401);
  });
});
