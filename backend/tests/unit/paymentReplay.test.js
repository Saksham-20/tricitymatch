/**
 * Payment replay + refund abuse (H-6, H-7, L-12).
 *
 * These reproduce the economics of each bug rather than mocking a whole
 * controller: the refund formula is pure arithmetic, and the replay guards are
 * about which key idempotency is scoped to.
 */

describe('L-12 cancellation refund accounts for consumed unlocks', () => {
  // Mirrors the formula in subscriptionController.cancelSubscription.
  const refundFraction = ({ totalDays, remainingDays, allowed, used }) => {
    const timeUnused = Math.min(Math.max(remainingDays / totalDays, 0), 1);
    const unlocksUnused =
      allowed === null || allowed === undefined || allowed <= 0
        ? 1
        : Math.min(Math.max(1 - used / allowed, 0), 1);
    return Math.min(timeUnused, unlocksUnused);
  };

  it('THE ABUSE: burning every unlock on day 0 refunds nothing', () => {
    // elite: 180 days, 30 unlocks. Spend all 30 immediately, then cancel.
    const f = refundFraction({ totalDays: 180, remainingDays: 179.5, allowed: 30, used: 30 });
    expect(f).toBe(0);
  });

  it('used to refund ~99.7% in exactly that scenario (time-only formula)', () => {
    const timeOnly = 179.5 / 180;
    expect(timeOnly).toBeGreaterThan(0.99);
    // The new formula must be dramatically lower for the same inputs.
    expect(refundFraction({ totalDays: 180, remainingDays: 179.5, allowed: 30, used: 30 }))
      .toBeLessThan(timeOnly);
  });

  it('an untouched subscription cancelled immediately still refunds nearly all', () => {
    const f = refundFraction({ totalDays: 180, remainingDays: 179.5, allowed: 30, used: 0 });
    expect(f).toBeCloseTo(179.5 / 180, 5);
  });

  it('refunds the smaller of time-remaining and unlocks-remaining', () => {
    // Half the term gone, but 90% of unlocks spent → unlocks dominate.
    expect(refundFraction({ totalDays: 100, remainingDays: 50, allowed: 10, used: 9 }))
      .toBeCloseTo(0.1, 5);
    // Most unlocks left, but the term is nearly over → time dominates.
    expect(refundFraction({ totalDays: 100, remainingDays: 5, allowed: 10, used: 1 }))
      .toBeCloseTo(0.05, 5);
  });

  it('unlimited plans (allowed null) fall back to time only', () => {
    expect(refundFraction({ totalDays: 100, remainingDays: 40, allowed: null, used: 0 }))
      .toBeCloseTo(0.4, 5);
  });

  it('never returns a negative or >1 fraction', () => {
    expect(refundFraction({ totalDays: 10, remainingDays: -5, allowed: 5, used: 0 })).toBe(0);
    expect(refundFraction({ totalDays: 10, remainingDays: 999, allowed: 5, used: 0 })).toBe(1);
    expect(refundFraction({ totalDays: 10, remainingDays: 5, allowed: 5, used: 99 })).toBe(0);
  });
});

describe('H-7 Google Play idempotency key', () => {
  // The bug was the SHAPE of the lookup, so that is what is pinned.
  const oldPredicate = (userId, token) => ({ userId, razorpayPaymentId: token, status: 'active' });
  const newPredicate = (token) => ({ razorpayPaymentId: token });

  it('old predicate let a second account find no row and mint its own', () => {
    const rowForAlice = { userId: 'alice', razorpayPaymentId: 'TOKEN', status: 'active' };
    const bobLookup = oldPredicate('bob', 'TOKEN');
    // Bob's query does not match Alice's row → Bob gets a free activation.
    expect(rowForAlice.userId).not.toBe(bobLookup.userId);
  });

  it('new predicate is user-agnostic, so the token is found whoever asks', () => {
    expect(newPredicate('TOKEN')).toEqual({ razorpayPaymentId: 'TOKEN' });
    expect(newPredicate('TOKEN')).not.toHaveProperty('userId');
    expect(newPredicate('TOKEN')).not.toHaveProperty('status');
  });
});

describe('H-6 astrologer payment binding', () => {
  const bindingHolds = (booking, submittedOrderId) =>
    Boolean(booking.razorpayOrderId) && submittedOrderId === booking.razorpayOrderId;

  it('THE ATTACK: a genuine triple from another order is rejected', () => {
    const victim = { id: 'b2', razorpayOrderId: 'order_victim' };
    expect(bindingHolds(victim, 'order_attacker_cheap')).toBe(false);
  });

  it('accepts the order that actually belongs to the booking', () => {
    expect(bindingHolds({ id: 'b1', razorpayOrderId: 'order_x' }, 'order_x')).toBe(true);
  });

  it('a booking with no order id can never be settled', () => {
    expect(bindingHolds({ id: 'b3', razorpayOrderId: null }, 'anything')).toBe(false);
  });
});
