/**
 * Session identity — "which of these sessions is the device I'm holding?"
 *
 * The web answers it by hashing the refreshToken cookie. A native client has no
 * cookie, and must not put its refresh token in a URL (SEC-1), so before the
 * access token carried a `sid` claim the phone got a session list with nothing
 * marked current — and "revoke the unfamiliar one" signs you out of the phone.
 * The same gap made `change-password` revoke every session including the
 * caller's, so changing your password on the app logged you out of the app.
 *
 * These tests pin both resolutions and, more importantly, the safe default:
 * when the current session cannot be identified at all, change-password revokes
 * NOTHING rather than everything.
 */

const jwt = require('jsonwebtoken');

const mockModels = {
  User: { findByPk: jest.fn() },
  Profile: {},
  RefreshToken: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    hashToken: jest.fn((t) => `hash:${t}`),
  },
  ReferralCode: {},
  MarketingLead: {},
  Subscription: { findOne: jest.fn() },
};

jest.mock('../../models', () => mockModels);
jest.mock('../../utils/email', () => ({
  sendWelcomeEmail: jest.fn(), sendPasswordResetEmail: jest.fn(), sendEmail: jest.fn(),
  sendOtpEmail: jest.fn(), sendSecurityAlert: jest.fn(),
}));

const config = require('../../config/env');
const authController = require('../../controllers/authController');
const { auth } = require('../../middlewares/auth');

/**
 * asyncHandler wraps the handler and does NOT return its promise, so awaiting
 * the call resolves before the handler's own awaits have run — flush the
 * microtask queue, or the assertions read an empty response spy. It also routes
 * thrown errors to `next` rather than rejecting, so the error is captured there.
 */
const runHandler = async (handler, req) => {
  const res = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis(), cookie: jest.fn() };
  let error = null;
  await handler(req, res, (err) => { error = err || null; });
  await new Promise((resolve) => setImmediate(resolve));
  return Object.assign(res, { error });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockModels.RefreshToken.hashToken.mockImplementation((t) => `hash:${t}`);
});

describe('auth middleware exposes the token session', () => {
  const activeUser = { id: 'user-1', email: 'a@b.com', role: 'user', status: 'active' };

  it('attaches req.sessionId from the sid claim', async () => {
    mockModels.User.findByPk.mockResolvedValue(activeUser);
    const token = jwt.sign({ userId: 'user-1', type: 'access', sid: 'session-9' }, config.auth.jwtSecret);
    const req = { header: () => `Bearer ${token}`, cookies: {} };

    await runHandler(auth, req);

    expect(req.sessionId).toBe('session-9');
  });

  it('leaves req.sessionId null for a token minted before the claim existed', async () => {
    mockModels.User.findByPk.mockResolvedValue(activeUser);
    const token = jwt.sign({ userId: 'user-1', type: 'access' }, config.auth.jwtSecret);
    const req = { header: () => `Bearer ${token}`, cookies: {} };

    await runHandler(auth, req);

    expect(req.sessionId).toBeNull();
  });
});

describe('GET /auth/sessions marks the current device', () => {
  const rows = [
    { id: 'session-A', toJSON: () => ({ id: 'session-A' }) },
    { id: 'session-B', toJSON: () => ({ id: 'session-B' }) },
  ];

  it('uses the sid claim, without touching the cookie path', async () => {
    mockModels.RefreshToken.findAll.mockResolvedValue(rows);
    const req = { user: { id: 'user-1' }, sessionId: 'session-B', cookies: {} };

    const res = await runHandler(authController.getSessions, req);
    const body = res.json.mock.calls[0][0];

    expect(body.currentSessionId).toBe('session-B');
    expect(body.sessions.find((s) => s.id === 'session-B').isCurrent).toBe(true);
    expect(body.sessions.find((s) => s.id === 'session-A').isCurrent).toBe(false);
    expect(mockModels.RefreshToken.findOne).not.toHaveBeenCalled();
  });

  it('falls back to hashing the refreshToken cookie when there is no sid', async () => {
    mockModels.RefreshToken.findAll.mockResolvedValue(rows);
    mockModels.RefreshToken.findOne.mockResolvedValue({ id: 'session-A' });
    const req = { user: { id: 'user-1' }, sessionId: null, cookies: { refreshToken: 'raw-token' } };

    const res = await runHandler(authController.getSessions, req);

    expect(res.json.mock.calls[0][0].currentSessionId).toBe('session-A');
    expect(mockModels.RefreshToken.hashToken).toHaveBeenCalledWith('raw-token');
  });

  it('reports no current session rather than guessing', async () => {
    mockModels.RefreshToken.findAll.mockResolvedValue(rows);
    const req = { user: { id: 'user-1' }, sessionId: null, cookies: {} };

    const res = await runHandler(authController.getSessions, req);
    const body = res.json.mock.calls[0][0];

    expect(body.currentSessionId).toBeNull();
    expect(body.sessions.every((s) => s.isCurrent === false)).toBe(true);
  });
});

describe('change-password keeps the session that made the request', () => {
  const user = {
    id: 'user-1',
    comparePassword: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const body = { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' };

  beforeEach(() => {
    mockModels.User.findByPk.mockResolvedValue(user);
    user.comparePassword.mockResolvedValue(true);
  });

  const whereOf = () => mockModels.RefreshToken.update.mock.calls[0][1].where;

  it('excludes the caller by session id when the token carries one', async () => {
    await runHandler(authController.changePassword, { user, body, sessionId: 'session-B', cookies: {} });

    const where = whereOf();
    expect(where.userId).toBe('user-1');
    expect(where.id[Object.getOwnPropertySymbols(where.id)[0]]).toBe('session-B');
  });

  it('falls back to the cookie hash when there is no sid', async () => {
    await runHandler(authController.changePassword, {
      user, body, sessionId: null, cookies: { refreshToken: 'raw-token' },
    });

    const where = whereOf();
    expect(where.tokenHash[Object.getOwnPropertySymbols(where.tokenHash)[0]]).toBe('hash:raw-token');
  });

  it('revokes NOTHING when the current session cannot be identified', async () => {
    // Revoking everything here would sign the member out of the device they are
    // standing on, mid password change. A stale session is the lesser failure,
    // and "log out everywhere" still exists.
    await runHandler(authController.changePassword, { user, body, sessionId: null, cookies: {} });

    expect(mockModels.RefreshToken.update).not.toHaveBeenCalled();
  });

  it('still refuses to reuse the same password', async () => {
    const res = await runHandler(authController.changePassword, {
      user,
      body: { currentPassword: 'Same1!', newPassword: 'Same1!' },
      sessionId: 'session-B',
      cookies: {},
    });

    expect(res.error).toMatchObject({ statusCode: 400 });
    expect(mockModels.RefreshToken.update).not.toHaveBeenCalled();
  });
});
