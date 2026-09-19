'use strict';

const {
  minuteOfDayIST, inSendWindow, slotMinute, isDue, jitterHours, WINDOW_OPEN, WINDOW_CLOSE,
} = require('../../utils/lifecycleWindow');

// IST = UTC+05:30, no DST.
const atIST = (hh, mm = 0) => new Date(Date.UTC(2026, 8, 19, hh - 5, mm - 30));

describe('send window (IST)', () => {
  it('converts UTC to IST minute-of-day', () => {
    expect(minuteOfDayIST(new Date('2026-09-19T04:30:00Z'))).toBe(10 * 60); // 10:00 IST
    expect(minuteOfDayIST(new Date('2026-09-19T18:30:00Z'))).toBe(0);       // midnight IST
  });

  it('is closed overnight and open from 10:00 until 22:00', () => {
    expect(inSendWindow(atIST(3, 0))).toBe(false);
    expect(inSendWindow(atIST(9, 59))).toBe(false);
    expect(inSendWindow(atIST(10, 0))).toBe(true);
    expect(inSendWindow(atIST(15, 30))).toBe(true);
    expect(inSendWindow(atIST(21, 59))).toBe(true);
    expect(inSendWindow(atIST(22, 0))).toBe(false);
    expect(inSendWindow(atIST(23, 30))).toBe(false);
  });
});

describe('per-member slot', () => {
  const seeds = Array.from({ length: 400 }, (_, i) => `member-${i}:photoNudge1`);

  it('always lands inside the window, never after 21:30', () => {
    for (const s of seeds) {
      const m = slotMinute(s);
      expect(m).toBeGreaterThanOrEqual(WINDOW_OPEN);
      expect(m).toBeLessThanOrEqual(21 * 60 + 30);
      expect(m).toBeLessThan(WINDOW_CLOSE);
    }
  });

  it('is stable for one seed and spread across the day for many', () => {
    expect(slotMinute('a')).toBe(slotMinute('a'));
    const hours = new Set(seeds.map((s) => Math.floor(slotMinute(s) / 60)));
    // 400 members across a 12h window: every hour of it should be used.
    expect(hours.size).toBeGreaterThanOrEqual(11);
  });

  it('differs between two kinds of mail to the same member', () => {
    const differing = Array.from({ length: 50 }, (_, i) =>
      slotMinute(`m${i}:photoNudge1`) !== slotMinute(`m${i}:photoNudge2`));
    expect(differing.filter(Boolean).length).toBeGreaterThan(40);
  });

  it('is due only once the slot has arrived, and never outside the window', () => {
    const slot = slotMinute('x');
    const h = Math.floor(slot / 60);
    const m = slot % 60;
    expect(isDue('x', atIST(h, m))).toBe(true);
    expect(isDue('x', atIST(3, 0))).toBe(false);
    expect(isDue('x', atIST(22, 30))).toBe(false);
    // Before the slot but inside the window: not yet.
    const early = slotMinute('late-slot-seed');
    if (early > WINDOW_OPEN) {
      const before = early - 1;
      expect(isDue('late-slot-seed', atIST(Math.floor(before / 60), before % 60))).toBe(false);
    }
  });
});

describe('jitterHours', () => {
  it('stays inside [min, max] and is stable per seed', () => {
    for (let i = 0; i < 200; i++) {
      const v = jitterHours(`s${i}`, 24, 48);
      expect(v).toBeGreaterThanOrEqual(24);
      expect(v).toBeLessThanOrEqual(48);
    }
    expect(jitterHours('same', 1, 9)).toBe(jitterHours('same', 1, 9));
  });
});
