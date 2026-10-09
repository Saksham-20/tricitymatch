/**
 * Fixed-end launch term (owner decision 2026-10-09). The launch offer runs for
 * a set window; every plan sold under it ends when the window ends, and buyers
 * in the window's final calendar month get extra months so nobody pays for a
 * few days. When the window closes, plans are back to "N months from purchase".
 */
const launchOffer = require('../../utils/launchOffer');
const { termEndDate } = require('../../utils/planTerm');

// End of 10 Jan 2027 in India.
const OFFER_END = '2027-01-10T18:29:59.999Z';
const istDate = (d) => new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10);

const blob = (fixedTerm) => ({
  enabled: true,
  endsAt: OFFER_END,
  headline: 'Launch offer',
  subline: null,
  plans: { premium_plus: { amount: 110000, duration: 90, contactUnlocks: null, mrp: 250000 } },
  bundles: {},
  founding: { enabled: false },
  fixedTerm,
});

const at = (iso, fn) => {
  jest.useFakeTimers({ now: new Date(iso), doNotFake: ['nextTick', 'setImmediate'] });
  try { return fn(); } finally { jest.useRealTimers(); }
};

const BASE = { name: 'Premium', amount: 249900, duration: 90, contactUnlocks: null };

describe('fixed launch term', () => {
  afterEach(() => launchOffer.__setCacheForTests(null));

  it('ends a plan bought early in the window on the offer end date', () => {
    launchOffer.__setCacheForTests(blob({ enabled: true, lateBonusMonths: 1 }));
    at('2026-10-11T06:00:00Z', () => {
      const plan = launchOffer.overlayPlan('premium_plus', BASE);
      expect(plan.amount).toBe(110000);
      expect(istDate(plan.endsOn)).toBe('2027-01-10');
      expect(istDate(termEndDate(new Date(), plan))).toBe('2027-01-10');
    });
  });

  it('ends a plan bought in the second month on the same date', () => {
    launchOffer.__setCacheForTests(blob({ enabled: true, lateBonusMonths: 1 }));
    at('2026-12-10T12:00:00Z', () => {
      expect(istDate(launchOffer.overlayPlan('premium_plus', BASE).endsOn)).toBe('2027-01-10');
    });
    // 23:59 IST on 10 Dec: still the second month.
    at('2026-12-10T18:29:30Z', () => {
      expect(istDate(launchOffer.overlayPlan('premium_plus', BASE).endsOn)).toBe('2027-01-10');
    });
  });

  it('gives a final-month buyer one extra month', () => {
    launchOffer.__setCacheForTests(blob({ enabled: true, lateBonusMonths: 1 }));
    // 00:00 on 11 Dec in India is the first moment of the final month.
    at('2026-12-10T18:30:00Z', () => {
      expect(istDate(launchOffer.overlayPlan('premium_plus', BASE).endsOn)).toBe('2027-02-10');
    });
    at('2027-01-10T12:00:00Z', () => {
      expect(istDate(launchOffer.overlayPlan('premium_plus', BASE).endsOn)).toBe('2027-02-10');
    });
  });

  it('reports the dates for the plans page', () => {
    launchOffer.__setCacheForTests(blob({ enabled: true, lateBonusMonths: 1 }));
    at('2026-10-11T06:00:00Z', () => {
      const { fixedTerm } = launchOffer.getOfferState();
      expect(istDate(fixedTerm.plansEndOn)).toBe('2027-01-10');
      expect(istDate(fixedTerm.finalMonthFrom)).toBe('2026-12-11');
      expect(fixedTerm.finalMonthFrom).toBe('2026-12-10T18:30:00.000Z'); // 00:00 IST
      expect(istDate(fixedTerm.bonusEndsOn)).toBe('2027-02-10');
    });
  });

  it('runs N months from purchase when the fixed term is off', () => {
    launchOffer.__setCacheForTests(blob({ enabled: false, lateBonusMonths: 1 }));
    at('2026-10-11T06:00:00Z', () => {
      const plan = launchOffer.overlayPlan('premium_plus', BASE);
      expect(plan.endsOn).toBeNull();
      expect(istDate(termEndDate(new Date(), plan))).toBe('2027-01-11');
      expect(launchOffer.getOfferState().fixedTerm).toBeNull();
    });
  });

  it('goes back to the regular plan once the window has closed', () => {
    launchOffer.__setCacheForTests(blob({ enabled: true, lateBonusMonths: 1 }));
    at('2027-01-11T06:00:00Z', () => {
      const plan = launchOffer.overlayPlan('premium_plus', BASE);
      expect(plan).toBe(BASE);
      expect(istDate(termEndDate(new Date(), plan))).toBe('2027-04-11');
    });
  });

  it('never uses a fixed end that is already in the past', () => {
    const plan = { duration: 90, endsOn: '2026-01-01T00:00:00Z' };
    expect(istDate(termEndDate(new Date('2026-10-11T06:00:00Z'), plan))).toBe('2027-01-11');
  });
});
