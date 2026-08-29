const {
  DEFAULT_RATE,
  CommissionValidationError,
  commissionOn,
  getRateForUser,
  getCommissionSettings,
  saveCommissionSettings,
  __setCacheForTests,
} = require('../../utils/marketingCommission');

describe('marketing commission', () => {
  afterEach(() => __setCacheForTests(null));

  describe('commissionOn', () => {
    it('takes the given percentage of a paid amount', () => {
      expect(commissionOn(1100, 20)).toBe(220);
      expect(commissionOn(2499, 20)).toBe(500); // 499.8 rounds up
    });

    it('rounds to whole rupees, half up, so a rep is never shorted', () => {
      expect(commissionOn(101, 50)).toBe(51); // 50.5 -> 51
      expect(commissionOn(1100, 12.5)).toBe(138); // 137.5 -> 138
    });

    it('is zero for unpaid members rather than NaN', () => {
      expect(commissionOn(0, 20)).toBe(0);
      expect(commissionOn(null, 20)).toBe(0);
      expect(commissionOn(undefined, 20)).toBe(0);
      expect(commissionOn(1100, 0)).toBe(0);
    });
  });

  describe('rate resolution', () => {
    it('defaults to 20% when nothing is configured', async () => {
      __setCacheForTests({});
      const settings = await getCommissionSettings();
      expect(settings.rate).toBe(DEFAULT_RATE);
      expect(DEFAULT_RATE).toBe(20);
    });

    it('falls back to the default when the stored blob is malformed', async () => {
      // A commission that silently reads 0 would be shown to a rep as "you
      // earned nothing", which is worse than a slightly stale rate.
      __setCacheForTests({ rate: 'not-a-number' });
      expect((await getCommissionSettings()).rate).toBe(DEFAULT_RATE);

      __setCacheForTests({ rate: 250 });
      expect((await getCommissionSettings()).rate).toBe(DEFAULT_RATE);
    });

    it('honours a per-rep override, and ignores an out-of-range one', async () => {
      __setCacheForTests({ rate: 20, overrides: { 'rep-a': 30, 'rep-b': 900 } });
      await expect(getRateForUser('rep-a')).resolves.toBe(30);
      await expect(getRateForUser('rep-b')).resolves.toBe(20);
      await expect(getRateForUser('rep-unknown')).resolves.toBe(20);
    });
  });

  describe('saveCommissionSettings', () => {
    it('rejects a rate outside 0–100 instead of storing it', async () => {
      __setCacheForTests({ rate: 20 });
      await expect(saveCommissionSettings({ rate: -1 })).rejects.toThrow(CommissionValidationError);
      await expect(saveCommissionSettings({ rate: 101 })).rejects.toThrow(CommissionValidationError);
      await expect(saveCommissionSettings({ rate: 'twenty' })).rejects.toThrow(CommissionValidationError);
    });

    it('rejects an out-of-range per-rep override', async () => {
      __setCacheForTests({ rate: 20 });
      await expect(saveCommissionSettings({ overrides: { 'rep-a': 150 } }))
        .rejects.toThrow(CommissionValidationError);
    });
  });
});
