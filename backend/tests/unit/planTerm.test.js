/**
 * Plan terms run in calendar months. A "3 months" plan bought on 9 Oct ended
 * on 7 Jan when it was counted as 90 days (2026-10-09, real member report).
 */
const { planEndDate } = require('../../utils/planTerm');

// India calendar date of an instant, for readable assertions.
const istDate = (d) => new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);

describe('planEndDate', () => {
  it('runs a 90-day plan to the same date three months later', () => {
    const start = new Date('2026-10-09T04:44:47.915Z');
    const end = planEndDate(start, 90);
    expect(end.toISOString()).toBe('2027-01-09T04:44:47.915Z');
  });

  it('maps 30/180/360 days to 1/6/12 calendar months', () => {
    const start = new Date('2026-10-09T04:44:47.915Z');
    expect(istDate(planEndDate(start, 30))).toBe('2026-11-09');
    expect(istDate(planEndDate(start, 180))).toBe('2027-04-09');
    expect(istDate(planEndDate(start, 360))).toBe('2027-10-09');
  });

  it('clamps to the last day of a shorter month', () => {
    expect(istDate(planEndDate(new Date('2026-11-30T06:00:00Z'), 90))).toBe('2027-02-28');
    expect(istDate(planEndDate(new Date('2027-11-30T06:00:00Z'), 90))).toBe('2028-02-29');
    expect(istDate(planEndDate(new Date('2026-10-31T06:00:00Z'), 30))).toBe('2026-11-30');
  });

  it('counts months on the India date, not the UTC one', () => {
    // 20:00 UTC on 31 Oct is already 1 Nov in India.
    const start = new Date('2026-10-31T20:00:00Z');
    expect(istDate(start)).toBe('2026-11-01');
    expect(istDate(planEndDate(start, 90))).toBe('2027-02-01');
  });

  it('keeps a duration that is not whole months in days', () => {
    const start = new Date('2026-10-09T00:00:00Z');
    expect(planEndDate(start, 7).toISOString()).toBe('2026-10-16T00:00:00.000Z');
    expect(planEndDate(start, 45).toISOString()).toBe('2026-11-23T00:00:00.000Z');
  });
});
