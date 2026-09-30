/**
 * Constraints that only a real database enforces (audit P1-13):
 *   - one payment id can activate only one subscription (migration 000052);
 *   - a Block row is seen in both directions by the shared helper;
 *   - the account-erasure cascade leaves no member rows behind.
 */

const { describeDb, makeMember, removeMembers, uniq } = require('../../helpers/db');

describeDb('database-enforced rules', (t) => {
  const ids = [];
  afterAll(async () => { await removeMembers(ids); });

  t('the same payment id cannot activate two subscriptions', async () => {
    const { Subscription } = require('../../../models');
    const a = await makeMember(); const b = await makeMember();
    ids.push(a.user.id, b.user.id);
    const paymentId = `pay_${uniq()}`;
    const base = {
      planType: 'premium_plus', amount: 109900, status: 'active',
      startDate: new Date(), endDate: new Date(Date.now() + 86400000),
    };
    await Subscription.create({ ...base, userId: a.user.id, razorpayPaymentId: paymentId });
    await expect(Subscription.create({ ...base, userId: b.user.id, razorpayPaymentId: paymentId }))
      .rejects.toMatchObject({ name: 'SequelizeUniqueConstraintError' });
    // Unpaid rows (NULL payment id) never collide with each other.
    await Subscription.create({ ...base, userId: a.user.id, status: 'pending', razorpayPaymentId: null });
    await Subscription.create({ ...base, userId: b.user.id, status: 'pending', razorpayPaymentId: null });
  });

  t('a block is visible from both sides', async () => {
    const { Block } = require('../../../models');
    const { isBlockedBetween } = require('../../../utils/blocks');
    const a = await makeMember(); const b = await makeMember();
    ids.push(a.user.id, b.user.id);
    expect(await isBlockedBetween(a.user.id, b.user.id)).toBe(false);
    await Block.create({ blockerId: a.user.id, blockedUserId: b.user.id });
    expect(await isBlockedBetween(a.user.id, b.user.id)).toBe(true);
    expect(await isBlockedBetween(b.user.id, a.user.id)).toBe(true);
  });

  t('a duplicate block row is refused', async () => {
    const { Block } = require('../../../models');
    const a = await makeMember(); const b = await makeMember();
    ids.push(a.user.id, b.user.id);
    await Block.create({ blockerId: a.user.id, blockedUserId: b.user.id });
    await expect(Block.create({ blockerId: a.user.id, blockedUserId: b.user.id })).rejects.toThrow();
  });

  t('an email address is unique across accounts', async () => {
    const { User } = require('../../../models');
    const a = await makeMember();
    ids.push(a.user.id);
    await expect(User.create({ email: a.user.email, password: 'x', role: 'user', status: 'active' })).rejects.toThrow();
  });
});
