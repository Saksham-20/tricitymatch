'use strict';

/**
 * Lifecycle mail jobs — the cadence rules the owner asked for after one order
 * was mailed ~24 times in a day:
 *   - no "membership is one step away" chase for a closed payment popup;
 *   - a real payment problem gets ONE plain help mail;
 *   - a closed popup gets at most one calm follow-up, next day, once a month;
 *   - nothing leaves outside 10:00–22:00 IST; nudges are spaced a week apart;
 *   - a ledger that cannot be written means no mail, never a repeat mail.
 */

jest.mock('../../models', () => ({
  Subscription: { findAll: jest.fn(), update: jest.fn(), count: jest.fn() },
  User: { findAll: jest.fn() },
  Profile: { count: jest.fn() },
}));
jest.mock('../../utils/email', () => ({
  sendPaymentFailed: jest.fn(),
  sendCheckoutFollowUp: jest.fn(),
  sendRenewalReminder: jest.fn(),
  sendMembershipExpired: jest.fn(),
  sendWinBack: jest.fn(),
  sendAddPhotoNudge: jest.fn(),
}));
jest.mock('../../utils/userLedger', () => ({ patchUserLedger: jest.fn() }));
jest.mock('../../utils/razorpay', () => ({ getPlanDetails: () => ({ name: 'Premium' }) }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

const { Subscription, User, Profile } = require('../../models');
const email = require('../../utils/email');
const { patchUserLedger } = require('../../utils/userLedger');
const { runSubscriptionLifecycle, runPhotoNudge, sweepPendingOrders } = require('../../utils/lifecycleMail');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
// 21:40 IST — inside the window and after every member's slot (slots end 21:30).
const NOW = new Date('2026-09-19T16:10:00Z');
// 03:30 IST — closed.
const NIGHT = new Date('2026-09-19T22:00:00Z');
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();

const makeUser = (over = {}) => {
  const u = { id: 'u1', email: 'aman@example.com', lifecycleMail: null, Profile: { firstName: 'Aman' }, ...over };
  u.update = jest.fn(async (v) => { Object.assign(u, v); });
  return u;
};
const makeSub = (over = {}) => {
  const { User: userOver, ...rest } = over;
  const s = {
    id: 'sub-1', userId: 'u1', planType: 'premium_plus', amount: 1099, status: 'pending',
    razorpayPaymentId: null, createdAt: new Date(NOW.getTime() - 3 * HOUR), lifecycleMail: null,
    User: makeUser(userOver), ...rest,
  };
  s.update = jest.fn(async (v) => { Object.assign(s, v); });
  return s;
};

// runSubscriptionLifecycle issues its findAll calls in a fixed order.
const stages = ({ sweep = [], failed = [], cancelled = [], ending = [], expired = [], lapsed = [] } = {}) => {
  [sweep, failed, cancelled, ending, expired, lapsed].forEach((rows) => Subscription.findAll.mockResolvedValueOnce(rows));
};

beforeEach(() => {
  jest.resetAllMocks();
  patchUserLedger.mockResolvedValue([[], 1]);
  Subscription.update.mockResolvedValue([1]);
  Subscription.count.mockResolvedValue(0);
  Profile.count.mockResolvedValue(3);
  Object.values(email).forEach((fn) => fn.mockResolvedValue({ success: true }));
});

describe('outside the 10:00–22:00 IST window', () => {
  it('mails nothing (but still tidies stale orders)', async () => {
    Subscription.findAll.mockResolvedValueOnce([]); // sweep only
    const counts = await runSubscriptionLifecycle(NIGHT);

    expect(Subscription.findAll).toHaveBeenCalledTimes(1);
    expect(Object.values(email).some((fn) => fn.mock.calls.length)).toBe(false);
    expect(counts).toMatchObject({ paymentFailed: 0, followUp: 0, renewal: 0, expired: 0, winback: 0 });
  });

  it('photo nudge sends nothing and does not even query', async () => {
    const r = await runPhotoNudge(NIGHT);
    expect(r).toMatchObject({ sent: 0, skipped: 'outside_window' });
    expect(User.findAll).not.toHaveBeenCalled();
  });
});

describe('closing the payment popup', () => {
  it('there is no "one step away" mail: an unpaid order with no failure is just closed, never mailed', async () => {
    const stale = makeSub({ createdAt: new Date(NOW.getTime() - 5 * HOUR) });
    stages({ sweep: [stale] });

    const counts = await runSubscriptionLifecycle(NOW);

    expect(Subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', lifecycleMail: expect.objectContaining({ cancelledAt: expect.any(String) }) }),
      { where: { id: 'sub-1', status: 'pending', razorpayPaymentId: null } }
    );
    expect(counts.swept).toBe(1);
    expect(email.sendPaymentFailed).not.toHaveBeenCalled();
    expect(email.sendCheckoutFollowUp).not.toHaveBeenCalled(); // not the same hour
  });

  it('sends ONE calm follow-up the next day, and records it', async () => {
    const cancelled = makeSub({ status: 'cancelled', lifecycleMail: { cancelledAt: ago(50 * HOUR) } });
    // 50h is past the longest wait (24h + 20h jitter) and inside the 72h limit.
    stages({ cancelled: [cancelled] });

    const counts = await runSubscriptionLifecycle(NOW);

    expect(email.sendCheckoutFollowUp).toHaveBeenCalledTimes(1);
    expect(email.sendCheckoutFollowUp).toHaveBeenCalledWith(
      'aman@example.com', 'Aman', 'Premium',
      { pageUrl: expect.stringMatching(/\/unsubscribe\?u=u1&t=[0-9a-f]{32}$/), oneClickUrl: expect.stringContaining('/api/v1/email/unsubscribe?u=u1&t=') }
    );
    expect(cancelled.lifecycleMail.checkoutFollowUp).toEqual(expect.any(String));
    expect(patchUserLedger).toHaveBeenCalledWith('u1', { lastSentAt: expect.any(String), checkoutFollowUpAt: expect.any(String) });
    expect(counts.followUp).toBe(1);
  });

  it.each([
    ['too soon (under 24h)', { cancelledAt: ago(10 * HOUR) }, {}],
    ['too late (over 72h)', { cancelledAt: ago(80 * HOUR) }, {}],
    ['already followed up on this order', { cancelledAt: ago(50 * HOUR), checkoutFollowUp: ago(HOUR) }, {}],
    ['a superseded order the member never cancelled (no cancelledAt)', {}, {}],
    ['followed up within the last 30 days', { cancelledAt: ago(50 * HOUR) }, { lifecycleMail: { checkoutFollowUpAt: ago(10 * DAY) } }],
    ['any lifecycle mail in the last 7 days', { cancelledAt: ago(50 * HOUR) }, { lifecycleMail: { lastSentAt: ago(2 * DAY) } }],
    ['the member unsubscribed from reminder mail', { cancelledAt: ago(50 * HOUR) }, { lifecycleMail: { emailOptOut: ago(5 * DAY) } }],
  ])('sends nothing when %s', async (_label, ledger, userOver) => {
    stages({ cancelled: [makeSub({ status: 'cancelled', lifecycleMail: ledger, User: userOver })] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendCheckoutFollowUp).not.toHaveBeenCalled();
  });

  it('sends nothing if they have since bought', async () => {
    Subscription.count.mockResolvedValueOnce(1); // holdsPaidPlan
    stages({ cancelled: [makeSub({ status: 'cancelled', lifecycleMail: { cancelledAt: ago(50 * HOUR) } })] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendCheckoutFollowUp).not.toHaveBeenCalled();
  });

  it('sends nothing if they are visibly trying again (a newer pending order)', async () => {
    Subscription.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1); // holdsPaidPlan, retrying
    stages({ cancelled: [makeSub({ status: 'cancelled', lifecycleMail: { cancelledAt: ago(50 * HOUR) } })] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendCheckoutFollowUp).not.toHaveBeenCalled();
  });

  it('two cancelled orders from one member get ONE mail, not two', async () => {
    const a = makeSub({ id: 'a', status: 'cancelled', lifecycleMail: { cancelledAt: ago(50 * HOUR) } });
    const b = makeSub({ id: 'b', status: 'cancelled', lifecycleMail: { cancelledAt: ago(49 * HOUR) } });
    stages({ cancelled: [a, b] });

    await runSubscriptionLifecycle(NOW);

    expect(email.sendCheckoutFollowUp).toHaveBeenCalledTimes(1);
  });
});

describe('a real payment problem', () => {
  const failedRow = (over = {}) => makeSub({ lifecycleMail: { paymentFailedAt: ago(40 * 60 * 1000) }, ...over });

  it('leaves the order pending (not swept) and sends one plain help mail', async () => {
    const row = failedRow({ createdAt: new Date(NOW.getTime() - 3 * HOUR) });
    stages({ sweep: [row], failed: [row] });

    const counts = await runSubscriptionLifecycle(NOW);

    expect(Subscription.update).not.toHaveBeenCalled(); // sweeper skipped it
    expect(email.sendPaymentFailed).toHaveBeenCalledWith('aman@example.com', 'Aman', 'Premium', 1099);
    expect(row.lifecycleMail.paymentFailed).toEqual(expect.any(String));
    expect(counts.paymentFailed).toBe(1);
  });

  it('claims the ledger BEFORE sending, so a broken write can never mean a repeat', async () => {
    const row = failedRow();
    let ledgerAtSend;
    email.sendPaymentFailed.mockImplementation(async () => { ledgerAtSend = { ...row.lifecycleMail }; return { success: true }; });
    stages({ failed: [row] });

    await runSubscriptionLifecycle(NOW);

    expect(ledgerAtSend.paymentFailed).toEqual(expect.any(String));
  });

  it('sends nothing when the ledger write fails', async () => {
    const row = failedRow();
    row.update.mockRejectedValueOnce(new Error('db down'));
    stages({ failed: [row] });

    await runSubscriptionLifecycle(NOW);

    expect(email.sendPaymentFailed).not.toHaveBeenCalled();
  });

  it('releases the claim when delivery fails, so it is retried on a later tick', async () => {
    const row = failedRow();
    email.sendPaymentFailed.mockResolvedValueOnce({ success: false });
    stages({ failed: [row] });

    await runSubscriptionLifecycle(NOW);

    expect(row.lifecycleMail.paymentFailed).toBeUndefined();
  });

  it.each([
    ['the failure is under 15 minutes old', { paymentFailedAt: ago(5 * 60 * 1000) }],
    ['the help mail was already sent', { paymentFailedAt: ago(HOUR), paymentFailed: ago(30 * 60 * 1000) }],
    ['no failure was ever recorded', {}],
  ])('sends nothing when %s', async (_label, ledger) => {
    stages({ failed: [makeSub({ lifecycleMail: ledger })] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendPaymentFailed).not.toHaveBeenCalled();
  });

  it('sends nothing if the retry succeeded (they now hold a paid plan)', async () => {
    Subscription.count.mockResolvedValueOnce(1);
    stages({ failed: [failedRow()] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendPaymentFailed).not.toHaveBeenCalled();
  });

  it('is exempt from the nudge gap — it is help, not a nudge', async () => {
    stages({ failed: [failedRow({ User: { lifecycleMail: { lastSentAt: ago(HOUR) } } })] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendPaymentFailed).toHaveBeenCalledTimes(1);
  });
});

describe('sweeping stale pending orders', () => {
  it('closes a failed order only after a week, with no follow-up eligibility', async () => {
    const old = makeSub({ createdAt: new Date(NOW.getTime() - 8 * DAY), lifecycleMail: { paymentFailedAt: ago(8 * DAY) } });
    Subscription.findAll.mockResolvedValueOnce([old]);

    expect(await sweepPendingOrders(NOW)).toBe(1);
    const [values] = Subscription.update.mock.calls[0];
    expect(values.status).toBe('cancelled');
    expect(values.lifecycleMail.cancelledAt).toBeUndefined();
  });

  it('closes a months-old orphan silently — no follow-up about a decision from July', async () => {
    Subscription.findAll.mockResolvedValueOnce([makeSub({ createdAt: new Date(NOW.getTime() - 60 * DAY) })]);

    await sweepPendingOrders(NOW);

    const [values] = Subscription.update.mock.calls[0];
    expect(values.status).toBe('cancelled');
    expect(values.lifecycleMail.cancelledAt).toBeUndefined();
  });

  it('never overwrites a row that was activated between the read and the write', async () => {
    Subscription.findAll.mockResolvedValueOnce([makeSub()]);
    Subscription.update.mockResolvedValueOnce([0]); // payment landed first

    expect(await sweepPendingOrders(NOW)).toBe(0);
    expect(Subscription.update.mock.calls[0][1].where).toMatchObject({ status: 'pending', razorpayPaymentId: null });
  });
});

describe('notices vs nudges', () => {
  const renewalRow = (userOver) => makeSub({
    status: 'active', endDate: new Date(NOW.getTime() + 5 * DAY), User: userOver,
  });

  it('a renewal notice is sent once and recorded', async () => {
    const row = renewalRow();
    stages({ ending: [row] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendRenewalReminder).toHaveBeenCalledTimes(1);
    expect(row.lifecycleMail.renewal).toEqual(expect.any(String));
  });

  it('a renewal notice is NOT held back by a recent nudge', async () => {
    stages({ ending: [renewalRow({ lifecycleMail: { lastSentAt: ago(DAY) } })] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendRenewalReminder).toHaveBeenCalledTimes(1);
  });

  it('a win-back nudge IS held back by a recent mail', async () => {
    const lapsed = makeSub({ status: 'expired', endDate: new Date(NOW.getTime() - 15 * DAY), User: { lifecycleMail: { lastSentAt: ago(2 * DAY) } } });
    stages({ lapsed: [lapsed] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendWinBack).not.toHaveBeenCalled();
  });

  it('a renewal notice is NOT stopped by an unsubscribe — it is about their own plan', async () => {
    stages({ ending: [renewalRow({ lifecycleMail: { emailOptOut: ago(5 * DAY) } })] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendRenewalReminder).toHaveBeenCalledTimes(1);
  });

  it('a payment-failed help mail is NOT stopped by an unsubscribe', async () => {
    const row = makeSub({ lifecycleMail: { paymentFailedAt: ago(40 * 60 * 1000) }, User: { lifecycleMail: { emailOptOut: ago(5 * DAY) } } });
    stages({ failed: [row] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendPaymentFailed).toHaveBeenCalledTimes(1);
  });

  it('a win-back nudge is stopped by an unsubscribe', async () => {
    const lapsed = makeSub({ status: 'expired', endDate: new Date(NOW.getTime() - 15 * DAY), User: { lifecycleMail: { emailOptOut: ago(20 * DAY) } } });
    stages({ lapsed: [lapsed] });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendWinBack).not.toHaveBeenCalled();
  });

  it('a renewal notice is not repeated on the next tick', async () => {
    stages({ ending: [renewalRow({ })].map((r) => { r.lifecycleMail = { renewal: ago(HOUR) }; return r; }) });
    await runSubscriptionLifecycle(NOW);
    expect(email.sendRenewalReminder).not.toHaveBeenCalled();
  });
});

describe('photo nudge', () => {
  const candidate = (over = {}) => makeUser({
    createdAt: new Date(NOW.getTime() - 5 * DAY), Profile: { firstName: 'Riya', photos: [] }, ...over,
  });

  it('sends the first nudge to a no-photo member a few days in, with an unsubscribe link, claiming it first', async () => {
    const u = candidate();
    let claimsAtSend;
    email.sendAddPhotoNudge.mockImplementation(async () => { claimsAtSend = patchUserLedger.mock.calls.slice(); return { success: true }; });
    User.findAll.mockResolvedValueOnce([u]);

    const r = await runPhotoNudge(NOW);

    expect(r.sent).toBe(1);
    expect(claimsAtSend).toHaveLength(1);
    expect(claimsAtSend[0]).toEqual(['u1', { photoNudge1: expect.any(String), lastSentAt: expect.any(String) }]);
    expect(email.sendAddPhotoNudge).toHaveBeenCalledWith(
      'aman@example.com', 'Riya', expect.objectContaining({ pageUrl: expect.stringContaining('/unsubscribe?u=u1&t=') })
    );
  });

  it('does not nudge a member who signed up hours ago', async () => {
    User.findAll.mockResolvedValueOnce([candidate({ createdAt: new Date(NOW.getTime() - 5 * HOUR) })]);
    expect((await runPhotoNudge(NOW)).sent).toBe(0);
  });

  it('does NOT send the same nudge again the next day — the second waits at least a week', async () => {
    const u = candidate({ lifecycleMail: { photoNudge1: ago(DAY), lastSentAt: ago(DAY) } });
    User.findAll.mockResolvedValueOnce([u]);
    expect((await runPhotoNudge(NOW)).sent).toBe(0);
    expect(email.sendAddPhotoNudge).not.toHaveBeenCalled();
  });

  it('sends the second nudge once, 7–10 days after the first', async () => {
    const u = candidate({ lifecycleMail: { photoNudge1: ago(11 * DAY), lastSentAt: ago(11 * DAY) } });
    User.findAll.mockResolvedValueOnce([u]);
    expect((await runPhotoNudge(NOW)).sent).toBe(1);
    expect(patchUserLedger).toHaveBeenCalledWith('u1', { photoNudge2: expect.any(String), lastSentAt: expect.any(String) });
  });

  it('releases the claim when delivery fails, restoring the earlier lastSentAt', async () => {
    const earlier = ago(11 * DAY);
    const u = candidate({ lifecycleMail: { photoNudge1: earlier, lastSentAt: earlier } });
    email.sendAddPhotoNudge.mockResolvedValueOnce({ success: false });
    User.findAll.mockResolvedValueOnce([u]);

    expect((await runPhotoNudge(NOW)).sent).toBe(0);
    expect(patchUserLedger).toHaveBeenLastCalledWith('u1', { lastSentAt: earlier }, ['photoNudge2']);
  });

  it('releases a first-time claim completely when delivery fails, so it is retried', async () => {
    email.sendAddPhotoNudge.mockResolvedValueOnce({ success: false });
    User.findAll.mockResolvedValueOnce([candidate()]);

    await runPhotoNudge(NOW);

    expect(patchUserLedger).toHaveBeenLastCalledWith('u1', {}, ['photoNudge1', 'lastSentAt']);
  });

  it('sends nothing when the ledger write fails', async () => {
    patchUserLedger.mockRejectedValueOnce(new Error('db down'));
    User.findAll.mockResolvedValueOnce([candidate()]);
    await runPhotoNudge(NOW);
    expect(email.sendAddPhotoNudge).not.toHaveBeenCalled();
  });

  it('sends nothing to a member who unsubscribed', async () => {
    User.findAll.mockResolvedValueOnce([candidate({ lifecycleMail: { emailOptOut: ago(3 * DAY) } })]);
    expect((await runPhotoNudge(NOW)).sent).toBe(0);
    expect(email.sendAddPhotoNudge).not.toHaveBeenCalled();
  });

  it('skips members with no email address', async () => {
    User.findAll.mockResolvedValueOnce([candidate({ email: null })]);
    expect((await runPhotoNudge(NOW)).sent).toBe(0);
  });
});
