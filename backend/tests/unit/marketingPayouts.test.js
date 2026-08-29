const { computeBalance } = require('../../utils/marketingPayouts');

describe('marketing payout balances', () => {
  it('owes the full commission when nothing has been paid', () => {
    expect(computeBalance(220, [])).toMatchObject({
      earned: 220, paidOut: 0, pending: 0, outstanding: 220, overpaid: 0,
    });
  });

  it('counts queued payouts against the balance, not just sent ones', () => {
    // Otherwise an admin queues a transfer, sees the same amount still
    // outstanding, and queues it a second time.
    const b = computeBalance(1100, [
      { amount: '400.00', status: 'paid' },
      { amount: 200, status: 'pending' },
    ]);
    expect(b).toMatchObject({ paidOut: 400, pending: 200, outstanding: 500, overpaid: 0 });
  });

  it('floors outstanding at zero and reports the surplus separately', () => {
    // A rate cut can leave earned below what was already handed over. A
    // negative "outstanding" would read to the rep as a debt they owe.
    const b = computeBalance(300, [{ amount: 500, status: 'paid' }]);
    expect(b.outstanding).toBe(0);
    expect(b.overpaid).toBe(200);
  });

  it('handles decimal amounts without float drift', () => {
    const b = computeBalance(100.1, [
      { amount: 0.1, status: 'paid' },
      { amount: 0.2, status: 'paid' },
    ]);
    expect(b.paidOut).toBe(0.3);
    expect(b.outstanding).toBe(99.8);
  });

  it('treats missing and non-numeric inputs as zero rather than NaN', () => {
    expect(computeBalance(undefined, undefined)).toMatchObject({ earned: 0, outstanding: 0 });
    expect(computeBalance(100, [{ amount: null, status: 'paid' }])).toMatchObject({
      paidOut: 0, outstanding: 100,
    });
  });
});
