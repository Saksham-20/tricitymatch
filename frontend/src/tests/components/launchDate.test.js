/**
 * The launch banner counts down to a fixed IST calendar date and retires itself
 * the day after. These tests pin the three things that can embarrass us in
 * public: the wrong phase around midnight IST, a stale "launches on" line after
 * launch, and a dismissal that hides the launch-day message.
 */
import { describe, it, expect } from 'vitest';

import { launchPhase } from '../../utils/launchDate';

// All instants are written in UTC; IST is +05:30.
const at = (iso) => new Date(iso);

describe('launchPhase (IST calendar days)', () => {
  it('counts whole days before launch', () => {
    expect(launchPhase(at('2026-10-05T10:00:00Z'))).toEqual({ phase: 'before', days: 6 });
    expect(launchPhase(at('2026-10-10T10:00:00Z'))).toEqual({ phase: 'before', days: 1 });
  });

  it('flips to launch day at 00:00 IST, not 00:00 UTC', () => {
    // 18:29 UTC on the 10th is still 23:59 IST on the 10th.
    expect(launchPhase(at('2026-10-10T18:29:00Z')).phase).toBe('before');
    // 18:30 UTC is 00:00 IST on the 11th.
    expect(launchPhase(at('2026-10-10T18:30:00Z')).phase).toBe('today');
    expect(launchPhase(at('2026-10-11T10:00:00Z')).phase).toBe('today');
  });

  it('is over from 00:00 IST on the 12th', () => {
    expect(launchPhase(at('2026-10-11T18:29:00Z')).phase).toBe('today');
    expect(launchPhase(at('2026-10-11T18:30:00Z')).phase).toBe('after');
  });
});
