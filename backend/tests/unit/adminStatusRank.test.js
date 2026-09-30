/**
 * Admin hardening (audit P0-13): the single-user status route changed ANY
 * account's status — a support sub-admin could ban an admin, and an admin could
 * deactivate themselves or the last full admin.
 */

jest.mock('../../config/env', () => ({
  razorpay: { keySecret: 'x', keyId: 'x', webhookSecret: 'x', isConfigured: () => true },
  limits: { unlimitedDailyUnlockCap: 25 },
  isProduction: false,
  isDevelopment: true,
}));
jest.mock('../../models', () => ({
  User: { findByPk: jest.fn(), count: jest.fn() },
  Profile: {}, Subscription: {}, Match: {}, Verification: {}, ProfileView: {}, Report: {},
  ReferralCode: {}, MarketingLead: {}, SuccessStory: {}, ContactMessage: {},
}));
jest.mock('../../config/database', () => ({ transaction: jest.fn(async (fn) => fn('TX')) }));
jest.mock('../../utils/invoice', () => ({ generateInvoicePDF: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendVerificationApproved: jest.fn(), sendVerificationRejected: jest.fn(), sendSupportReply: jest.fn(),
}));
jest.mock('../../utils/razorpay', () => ({ getRazorpayInstance: jest.fn() }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

const { User } = require('../../models');
const { updateUserStatus } = require('../../controllers/adminController');

const target = (over = {}) => ({ id: 't1', role: 'user', status: 'active', save: jest.fn().mockResolvedValue(undefined), ...over });
const call = async (actor, userId, status, targetRow) => {
  User.findByPk.mockResolvedValue(targetRow);
  const res = { json: jest.fn() };
  const next = jest.fn();
  updateUserStatus({ params: { userId }, body: { status }, user: actor }, res, next);
  await new Promise((r) => setImmediate(r));
  return { res, error: next.mock.calls[0]?.[0] };
};

const support = { id: 's1', role: 'sub_admin', adminPermissions: ['users', 'support'] };
const teamAdmin = { id: 's2', role: 'sub_admin', adminPermissions: ['users', 'team'] };
const admin = { id: 'a1', role: 'admin' };
const superAdmin = { id: 'sa1', role: 'super_admin' };

beforeEach(() => { jest.clearAllMocks(); User.count.mockResolvedValue(1); });

describe('single-user status route', () => {
  it('still lets a support sub-admin suspend an ordinary member', async () => {
    const t = target();
    const { error } = await call(support, 't1', 'banned', t);
    expect(error).toBeUndefined();
    expect(t.status).toBe('banned');
  });

  it('refuses a support sub-admin acting on an admin', async () => {
    const t = target({ id: 'a9', role: 'admin' });
    const { error } = await call(support, 'a9', 'banned', t);
    expect(error).toMatchObject({ statusCode: 403 });
    expect(t.save).not.toHaveBeenCalled();
  });

  it('refuses a team sub-admin acting on someone who outranks them', async () => {
    const t = target({ id: 'a9', role: 'admin' });
    const { error } = await call(teamAdmin, 'a9', 'inactive', t);
    expect(error).toMatchObject({ statusCode: 403 });
  });

  it('refuses anyone changing their own status', async () => {
    const t = target({ id: 'a1', role: 'admin' });
    const { error } = await call(admin, 'a1', 'inactive', t);
    expect(error).toMatchObject({ statusCode: 400 });
    expect(t.save).not.toHaveBeenCalled();
  });

  it('refuses an admin acting on a super_admin', async () => {
    const t = target({ id: 'sa9', role: 'super_admin' });
    const { error } = await call(admin, 'sa9', 'banned', t);
    expect(error).toMatchObject({ statusCode: 403 });
  });

  it('refuses to suspend the last full admin', async () => {
    User.count.mockResolvedValue(0);
    const t = target({ id: 'a2', role: 'admin' });
    const { error } = await call(superAdmin, 'a2', 'banned', t);
    expect(error).toMatchObject({ statusCode: 400 });
    expect(t.save).not.toHaveBeenCalled();
  });

  it('lets a super_admin suspend another admin when a full admin remains', async () => {
    const t = target({ id: 'a2', role: 'admin' });
    const { error } = await call(superAdmin, 'a2', 'inactive', t);
    expect(error).toBeUndefined();
    expect(t.status).toBe('inactive');
  });
});
