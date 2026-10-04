/**
 * Manual rep payout workflow on a real database: refund-window hold, TDS,
 * encrypted payout details, the monthly prepare run, the bank upload file and
 * marking paid with UTRs.
 */

jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));
jest.mock('../../../utils/email', () => ({
  ...jest.requireActual('../../../utils/email'),
  sendEmail: jest.fn(async () => ({ success: true })),
}));
jest.mock('../../../middlewares/logger', () => {
  const actual = jest.requireActual('../../../middlewares/logger');
  return { ...actual, logAudit: jest.fn() };
});

const { describeDb, makeMember, removeMembers, call, uniq } = require('../../helpers/db');

const DAY = 86400000;
const UPI = { method: 'upi', upiId: 'priya@okhdfc', accountHolder: 'Priya Sharma', pan: 'ABCDE1234F' };
const BANK = {
  method: 'bank', accountHolder: 'Priya Sharma', accountNumber: '123456789012', ifsc: 'HDFC0001234', pan: 'ABCDE1234F',
};

describeDb('manual rep payouts', (t) => {
  const ids = [];
  let models; let sequelize; let payouts; let details; let settings; let commission; let ctl;

  const member = async (user = {}) => { const m = await makeMember({ user }); ids.push(m.user.id); return m.user; };
  const rep = () => member({ role: 'marketing' });
  const sub = (userId, over = {}) => models.Subscription.create({
    userId, planType: 'premium_plus', amount: 1000, status: 'active',
    startDate: new Date(Date.now() - 10 * DAY), endDate: new Date(Date.now() + 80 * DAY),
    contactUnlocksAllowed: null, razorpayPaymentId: `pay_${uniq()}`, razorpayOrderId: `order_${uniq()}`, ...over,
  });
  const lead = (r, buyer) => models.MarketingLead.create({
    name: 'Lead', phone: 'N/A', assignedToMarketingUserId: r.id, convertedUserId: buyer.id, referralCode: 'T', status: 'contacted',
  });
  // A rep whose one member paid ₹1000 `daysAgo` days ago -> ₹200 commission at 20%.
  const repWithSale = async (daysAgo = 10) => {
    const r = await rep(); const buyer = await member();
    await lead(r, buyer);
    await sub(buyer.id, { startDate: new Date(Date.now() - daysAgo * DAY) });
    return r;
  };
  const setDetailsAge = (id, days) => sequelize.query(
    'UPDATE "MarketingPayoutDetails" SET "updatedAt" = NOW() - (:d || \' days\')::interval WHERE "marketingUserId" = :id',
    { replacements: { id, d: String(days) } },
  );

  beforeAll(async () => {
    models = require('../../../models');
    sequelize = require('../../../config/database');
    payouts = require('../../../utils/marketingPayouts');
    details = require('../../../utils/payoutDetails');
    settings = require('../../../utils/marketingPayoutSettings');
    commission = require('../../../utils/marketingCommission');
    ctl = require('../../../controllers/marketingPayoutController');
    commission.__setCacheForTests({ rate: 20, overrides: {} });
    settings.__resetForTests();
    await settings.savePayoutSettings({ holdDays: 7, minPayout: 100, tdsRate: 0 }, null);
  });

  afterAll(async () => {
    await settings.savePayoutSettings({ holdDays: 7, minPayout: 500, tdsRate: 0 }, null).catch(() => {});
    settings.__resetForTests();
    if (ids.length) {
      const q = (sql) => sequelize.query(sql, { replacements: { ids } }).catch(() => {});
      await q('DELETE FROM "MarketingPayouts" WHERE "marketingUserId" IN (:ids)');
      await q('DELETE FROM "MarketingPayoutDetails" WHERE "marketingUserId" IN (:ids)');
      await q('DELETE FROM "MarketingLeads" WHERE "assignedToMarketingUserId" IN (:ids) OR "convertedUserId" IN (:ids)');
    }
    await removeMembers(ids);
  });

  // ---------------------------------------------------------- hold window

  t('commission inside the refund window is in hold, not payable', async () => {
    const r = await repWithSale(2);
    const { summary } = await payouts.getPayoutLedger(r.id);
    expect(summary).toMatchObject({ earned: 200, outstanding: 200, payable: 0, inHold: 200, holdDays: 7 });
  });

  t('once the window passes the commission is payable', async () => {
    const r = await repWithSale(10);
    const { summary } = await payouts.getPayoutLedger(r.id);
    expect(summary).toMatchObject({ earned: 200, payable: 200, inHold: 0 });
  });

  t('paying money still inside the window is refused with the reason, unless allowOverpay', async () => {
    const r = await repWithSale(2);
    await expect(payouts.recordPayout(r.id, { amount: 200, status: 'paid' }, null))
      .rejects.toThrow(/payable balance of ₹0.*₹200 more is still inside the 7-day refund window/);
    const ok = await payouts.recordPayout(r.id, { amount: 200, status: 'paid', allowOverpay: true }, null);
    expect(Number(ok.amount)).toBe(200);
  });

  t('a refunded payment never becomes payable', async () => {
    const r = await rep(); const buyer = await member();
    await lead(r, buyer);
    await sub(buyer.id, { startDate: new Date(Date.now() - 10 * DAY), refundedAt: new Date(), refundedAmount: 1000 });
    const { summary } = await payouts.getPayoutLedger(r.id);
    expect(summary).toMatchObject({ earned: 0, payable: 0 });
  });

  // ------------------------------------------------------------------ TDS

  t('TDS is withheld at the configured rate; gross settles the balance, net leaves the bank', async () => {
    const r = await repWithSale(10);
    const p = await payouts.recordPayout(r.id, { amount: 200, status: 'pending', tdsRate: 10 }, null);
    expect(Number(p.tdsAmount)).toBe(20);
    const ledger = await payouts.getPayoutLedger(r.id);
    expect(ledger.payouts[0]).toMatchObject({ amount: 200, tdsRate: 10, tdsAmount: 20, netAmount: 180 });
    expect(ledger.summary).toMatchObject({ pending: 200, payable: 0 });
    await expect(payouts.recordPayout(r.id, { amount: 10, tdsRate: 45 }, null)).rejects.toThrow(/tdsRate/);
  });

  t('the default TDS rate from settings applies when none is sent', async () => {
    await settings.savePayoutSettings({ tdsRate: 5 }, null);
    try {
      const r = await repWithSale(10);
      const p = await payouts.recordPayout(r.id, { amount: 200, status: 'pending' }, null);
      expect(Number(p.tdsRate)).toBe(5);
      expect(Number(p.tdsAmount)).toBe(10);
    } finally {
      await settings.savePayoutSettings({ tdsRate: 0 }, null);
    }
  });

  // ------------------------------------------------------ payout details

  t('details are validated, stored encrypted, and the rep only gets a masked view back', async () => {
    const r = await rep();
    await expect(details.saveDetails(r.id, { ...BANK, ifsc: 'bad' })).rejects.toBeInstanceOf(details.PayoutDetailsError);
    await expect(details.saveDetails(r.id, { ...UPI, pan: '123' })).rejects.toBeInstanceOf(details.PayoutDetailsError);
    await expect(details.saveDetails(r.id, { ...UPI, upiId: 'no-at-sign' })).rejects.toBeInstanceOf(details.PayoutDetailsError);
    await expect(details.saveDetails(r.id, { method: 'cash' })).rejects.toBeInstanceOf(details.PayoutDetailsError);

    const masked = await details.saveDetails(r.id, BANK);
    expect(masked.accountNumber).toBe('••••••••9012');
    expect(masked.pan).toBe('AB••••••4F');
    expect(JSON.stringify(masked)).not.toContain('123456789012');

    const [row] = await sequelize.query('SELECT payload FROM "MarketingPayoutDetails" WHERE "marketingUserId" = :id',
      { replacements: { id: r.id }, type: sequelize.QueryTypes.SELECT });
    expect(row.payload).not.toContain('123456789012');
    expect(row.payload).not.toContain('ABCDE1234F');

    const full = await details.getFullDetails(r.id);
    expect(full).toMatchObject({ method: 'bank', accountNumber: '123456789012', ifsc: 'HDFC0001234', pan: 'ABCDE1234F' });
  });

  t('the rep route returns 400 for bad details and never echoes the full values', async () => {
    const r = await rep();
    const bad = await call(ctl.saveMyPayoutDetails, { user: { id: r.id }, body: { ...BANK, accountNumber: '12' } });
    expect(bad.statusCode).toBe(400);
    const ok = await call(ctl.saveMyPayoutDetails, { user: { id: r.id }, body: UPI });
    expect(ok.statusCode).toBe(200);
    expect(JSON.stringify(ok.body)).not.toContain('priya@okhdfc');
    const read = await call(ctl.getMyPayoutDetails, { user: { id: r.id } });
    expect(read.body.details.method).toBe('upi');
    expect(JSON.stringify(read.body)).not.toContain('ABCDE1234F');
  });

  // ---------------------------------------------------- overview / prepare

  t('overview explains why a rep would be skipped', async () => {
    const noDetails = await repWithSale(10);
    const fresh = await repWithSale(10); await details.saveDetails(fresh.id, UPI); // changed just now
    const ready = await repWithSale(10); await details.saveDetails(ready.id, UPI); await setDetailsAge(ready.id, 3);
    const hold = await repWithSale(2); await details.saveDetails(hold.id, UPI); await setDetailsAge(hold.id, 3);
    const small = await rep(); const b = await member(); await lead(small, b);
    await sub(b.id, { amount: 100 }); // 20 commission, below the 100 minimum
    await details.saveDetails(small.id, UPI); await setDetailsAge(small.id, 3);

    const { reps } = await payouts.payableOverview();
    const by = Object.fromEntries(reps.map((x) => [x.userId, x]));
    expect(by[noDetails.id].reason).toBe('no_details');
    expect(by[fresh.id].reason).toBe('details_changed_recently');
    expect(by[ready.id]).toMatchObject({ eligible: true, reason: null, payable: 200 });
    expect(by[hold.id].reason).toBe('nothing_payable');
    expect(by[small.id].reason).toBe('below_minimum');
  });

  t('prepare queues exactly the payable balance once; a second run creates nothing', async () => {
    const ready = await repWithSale(10); await details.saveDetails(ready.id, BANK); await setDetailsAge(ready.id, 3);
    const skip = await repWithSale(10); // no details
    const first = await payouts.preparePayouts(null, { repIds: [ready.id, skip.id] });
    expect(first.created).toHaveLength(1);
    expect(first.created[0]).toMatchObject({ userId: ready.id, amount: 200 });
    expect(first.skipped).toEqual([expect.objectContaining({ userId: skip.id, reason: 'no_details' })]);

    const row = await models.MarketingPayout.findByPk(first.created[0].id);
    expect(row).toMatchObject({ status: 'pending', method: 'bank_transfer' });

    const second = await payouts.preparePayouts(null, { repIds: [ready.id] });
    expect(second.created).toHaveLength(0);
    expect(second.skipped[0].reason).toBe('nothing_payable');
  });

  t('two prepare runs at once pay a rep once', async () => {
    const ready = await repWithSale(10); await details.saveDetails(ready.id, UPI); await setDetailsAge(ready.id, 3);
    const runs = await Promise.all([
      payouts.preparePayouts(null, { repIds: [ready.id] }),
      payouts.preparePayouts(null, { repIds: [ready.id] }),
    ]);
    expect(runs.reduce((n, r) => n + r.created.length, 0)).toBe(1);
    const rows = await models.MarketingPayout.count({ where: { marketingUserId: ready.id } });
    expect(rows).toBe(1);
  });

  // -------------------------------------------------------- CSV + mark paid

  t('the bank file carries decrypted destinations, TDS and net, and flags missing details', async () => {
    await settings.savePayoutSettings({ tdsRate: 10 }, null);
    try {
      // A distinct account number: earlier tests leave their own pending rows in the file.
      const ready = await repWithSale(10);
      await details.saveDetails(ready.id, { ...BANK, accountNumber: '998877665544' }); await setDetailsAge(ready.id, 3);
      await payouts.preparePayouts(null, { repIds: [ready.id] });
      const res = await call(ctl.queuedCsv, { user: { id: ready.id } });
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      const text = res.body;
      expect(text).toContain('Net to transfer (INR)');
      const line = text.split('\r\n').find((l) => l.includes('998877665544'));
      expect(line).toBeTruthy();
      expect(line).toContain('HDFC0001234');
      expect(line).toContain('ABCDE1234F');
      expect(line).toContain(',200,20,180,');
    } finally {
      await settings.savePayoutSettings({ tdsRate: 0 }, null);
    }
  });

  t('marking paid records the UTR, and never touches voided or already-paid rows', async () => {
    const ready = await repWithSale(10); await details.saveDetails(ready.id, UPI); await setDetailsAge(ready.id, 3);
    const { created } = await payouts.preparePayouts(null, { repIds: [ready.id] });
    const id = created[0].id;

    const first = await payouts.markPaidBatch([{ id, reference: 'UTR123456' }, { id: '00000000-0000-4000-8000-000000000000' }], null);
    expect(first[0]).toMatchObject({ ok: true, reference: 'UTR123456' });
    expect(first[1]).toMatchObject({ ok: false, reason: 'not_found' });

    const again = await payouts.markPaidBatch([{ id, reference: 'OTHER' }], null);
    expect(again[0]).toMatchObject({ ok: false, reason: 'already_paid' });
    expect((await models.MarketingPayout.findByPk(id)).reference).toBe('UTR123456');

    const ledger = await payouts.getPayoutLedger(ready.id);
    expect(ledger.summary).toMatchObject({ paidOut: 200, pending: 0, payable: 0 });

    const voided = await repWithSale(10); await details.saveDetails(voided.id, UPI); await setDetailsAge(voided.id, 3);
    const q = await payouts.preparePayouts(null, { repIds: [voided.id] });
    await payouts.voidPayout(q.created[0].id, { reason: 'wrong rep selected', adminId: null });
    const v = await payouts.markPaidBatch([{ id: q.created[0].id }], null);
    expect(v[0]).toMatchObject({ ok: false, reason: 'voided' });
  });

  t('an admin read of the full details is audited', async () => {
    const { logAudit } = require('../../../middlewares/logger');
    const r = await rep(); const admin = await member();
    await details.saveDetails(r.id, UPI);
    const res = await call(ctl.getRepPayoutDetails, { user: { id: admin.id }, params: { userId: r.id } });
    expect(res.statusCode).toBe(200);
    expect(res.body.details.upiId).toBe('priya@okhdfc');
    expect(logAudit).toHaveBeenCalledWith('marketing_payout_details_read', admin.id, { targetUserId: r.id });
  });
});
