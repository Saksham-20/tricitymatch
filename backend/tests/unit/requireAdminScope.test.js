'use strict';

/**
 * `requireAdminScope` is the actual boundary for a sub-admin: the sidebar
 * hiding a link is cosmetic, and a hand-crafted request must still 403.
 *
 * Note `asyncHandler` is `Promise.resolve(fn()).catch(next)` — it does NOT
 * return the promise, so assertions have to let the microtask queue drain
 * before reading what happened.
 */

jest.mock('../../models', () => ({
  User: {}, Subscription: {}, ContactUnlock: {}, RefreshToken: {},
}));
jest.mock('../../utils/entitlements', () => ({
  hasChatAccess: jest.fn(), getActiveSubscription: jest.fn(),
}));

const { requireAdminScope, adminAuth } = require('../../middlewares/auth');

const settle = () => new Promise((resolve) => setImmediate(resolve));

const run = async (middleware, user) => {
  const req = { user };
  const next = jest.fn();
  middleware(req, {}, next);
  await settle();
  return next;
};

describe('requireAdminScope', () => {
  it('lets a sub_admin through for a scope it holds', async () => {
    const next = await run(requireAdminScope('support'), {
      role: 'sub_admin', adminPermissions: ['support'],
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('403s a sub_admin for a scope it does not hold', async () => {
    const next = await run(requireAdminScope('pricing'), {
      role: 'sub_admin', adminPermissions: ['support'],
    });
    const err = next.mock.calls[0][0];
    expect(err).toBeTruthy();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('ADMIN_SCOPE_REQUIRED');
  });

  it('403s a sub_admin whose permissions never loaded (fail closed)', async () => {
    const next = await run(requireAdminScope('support'), { role: 'sub_admin' });
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('lets admin and super_admin through for every scope', async () => {
    for (const role of ['admin', 'super_admin']) {
      for (const scope of ['users', 'pricing', 'team', 'revenue']) {
        const next = await run(requireAdminScope(scope), { role });
        expect(next).toHaveBeenCalledWith();
      }
    }
  });

  it('401s when there is no authenticated user', async () => {
    const next = await run(requireAdminScope('users'), undefined);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });
});

describe('adminAuth', () => {
  it('opens the door for every admin-family role', async () => {
    for (const role of ['sub_admin', 'admin', 'super_admin']) {
      const next = await run(adminAuth, { role });
      expect(next).toHaveBeenCalledWith();
    }
  });

  it('keeps members and marketing roles out of the panel', async () => {
    for (const role of ['user', 'marketing', 'marketing_manager']) {
      const next = await run(adminAuth, { role });
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    }
  });
});
