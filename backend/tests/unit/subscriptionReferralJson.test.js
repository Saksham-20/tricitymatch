/**
 * A buyer reads their own subscription; the referrer's / rep's account id on the
 * `referral` block is not theirs to read.
 */
const { Subscription } = require('../../models');

describe('Subscription JSON', () => {
  it('never exposes the referrer or rep account id', () => {
    const row = Subscription.build({
      userId: '11111111-1111-4111-8111-111111111111',
      referral: { code: 'TMABC234', kind: 'member', discountPaise: 10000, referrerUserId: 'secret-id', marketingUserId: 'rep-id', rewardedAt: 'x' },
    });
    expect(row.toJSON().referral).toEqual({ code: 'TMABC234', discountPaise: 10000 });
    expect(JSON.stringify(row)).not.toMatch(/secret-id|rep-id/);
  });
});
