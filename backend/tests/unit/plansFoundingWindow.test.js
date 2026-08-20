/**
 * `GET /subscription/plans` → `founding` block (Phase S).
 *
 * This is the ONLY public signal telling the landing page, the city pages and
 * the signup kicker whether they may promise a free premium period. If it ever
 * reported open while `config.founding.isOpen()` said closed, every one of those
 * surfaces would advertise an entitlement `utils/foundingGrant.js` refuses to
 * issue — a fabricated claim shipped by accident, which is exactly what the
 * 2026-08 pass exists to prevent.
 *
 * It also must not leak the raw `FOUNDING_PERIOD_ENDS` while the window is shut:
 * a past/garbage date echoed to the client is an invitation for a client to
 * "helpfully" re-derive openness and get it wrong.
 */

jest.mock('../../config/env', () => ({
  founding: { endsAt: '', memberCap: 0, isOpen: jest.fn(() => false) },
  isProduction: false,
}));

jest.mock('../../models', () => ({
  Subscription: {}, User: {}, Profile: {}, MarketingLead: {}, UnlockPurchase: {},
}));
jest.mock('../../config/database', () => ({ transaction: jest.fn() }));
jest.mock('../../utils/email', () => ({ sendSubscriptionConfirmation: jest.fn() }));
jest.mock('../../utils/invoice', () => ({ generateInvoicePDF: jest.fn() }));
jest.mock('../../utils/notifyUser', () => ({ notify: jest.fn() }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

const config = require('../../config/env');
const { getPlans } = require('../../controllers/subscriptionController');
const { PURCHASABLE_PLANS, PAID_PLANS, FOUNDING_PLAN, FOUNDING_CONTACT_UNLOCKS } = require('../../constants/plans');

const callGetPlans = async () => {
  const res = { json: jest.fn() };
  await getPlans({}, res, jest.fn());
  return res.json.mock.calls[0][0];
};

beforeEach(() => {
  jest.clearAllMocks();
  config.founding.isOpen.mockReturnValue(false);
  config.founding.endsAt = '';
});

describe('public founding window', () => {
  it('reports CLOSED by default (no FOUNDING_PERIOD_ENDS set)', async () => {
    const body = await callGetPlans();
    expect(body.founding.open).toBe(false);
    expect(body.founding.endsAt).toBeNull();
  });

  it('withholds the end date while closed, even if the env still holds a stale one', async () => {
    config.founding.endsAt = '2020-01-01';
    const body = await callGetPlans();
    expect(body.founding.open).toBe(false);
    expect(body.founding.endsAt).toBeNull();
  });

  it('reports OPEN with the cohort end date and the real unlock cap', async () => {
    config.founding.isOpen.mockReturnValue(true);
    config.founding.endsAt = '2026-12-31';
    const body = await callGetPlans();
    expect(body.founding).toEqual({
      grantDays: 30,
      open: true,
      endsAt: '2026-12-31',
      contactUnlocks: FOUNDING_CONTACT_UNLOCKS,
    });
  });

  it('never lists the granted founding tier as something a member can buy', async () => {
    config.founding.isOpen.mockReturnValue(true);
    const body = await callGetPlans();
    expect(body.plans[FOUNDING_PLAN]).toBeUndefined();
    expect(PURCHASABLE_PLANS).not.toContain(FOUNDING_PLAN);
    // …while still counting as paid-grade for every entitlement gate.
    expect(PAID_PLANS).toContain(FOUNDING_PLAN);
  });
});
