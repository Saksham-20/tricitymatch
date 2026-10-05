/**
 * The launch banner counts down to a fixed IST calendar date and retires itself
 * the day after. These tests pin the three things that can embarrass us in
 * public: the wrong phase around midnight IST, a stale "launches on" line after
 * launch, and a dismissal that hides the launch-day message.
 */
import React from 'react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import LaunchBanner from '../../components/common/LaunchBanner';
import { launchPhase } from '../../utils/launchDate';

// All instants are written in UTC; IST is +05:30.
const at = (iso) => new Date(iso);

const show = (now, props = {}) =>
  render(
    <MemoryRouter>
      <LaunchBanner now={at(now)} {...props} />
    </MemoryRouter>
  );

// tests/setup.js replaces localStorage with bare vi.fn()s; give them real storage.
let store;
beforeEach(() => {
  store = new Map();
  window.localStorage.getItem.mockImplementation((k) => (store.has(k) ? store.get(k) : null));
  window.localStorage.setItem.mockImplementation((k, v) => { store.set(k, String(v)); });
});
afterEach(cleanup);

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

describe('LaunchBanner', () => {
  it('announces the date before launch and offers sign-up', () => {
    show('2026-10-05T10:00:00Z');
    expect(screen.getByText(/launches on 11 October/i)).toBeTruthy();
    const cta = screen.getByRole('link', { name: /create your profile/i });
    expect(cta.getAttribute('href')).toBe('/onboarding');
  });

  it('says tomorrow the day before and today on the day', () => {
    show('2026-10-10T10:00:00Z');
    expect(screen.getByText(/launches tomorrow, 11 October/i)).toBeTruthy();
    cleanup();
    show('2026-10-11T10:00:00Z');
    expect(screen.getByText(/launches today/i)).toBeTruthy();
  });

  it('renders nothing once launch day has passed', () => {
    const { container } = show('2026-10-12T10:00:00Z');
    expect(container.firstChild).toBeNull();
  });

  it('drops the sign-up link for a signed-in member but keeps the message', () => {
    show('2026-10-05T10:00:00Z', { authenticated: true });
    expect(screen.getByText(/launches on 11 October/i)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /create your profile/i })).toBeNull();
  });

  it('stays dismissed within a phase but returns on launch day', () => {
    const first = show('2026-10-05T10:00:00Z');
    fireEvent.click(screen.getByRole('button', { name: /dismiss launch announcement/i }));
    expect(first.container.firstChild).toBeNull();
    first.unmount();

    // Same phase, later visit: still dismissed.
    expect(show('2026-10-08T10:00:00Z').container.firstChild).toBeNull();
    cleanup();

    // Launch day is a new phase: the message comes back.
    show('2026-10-11T10:00:00Z');
    expect(screen.getByText(/launches today/i)).toBeTruthy();
  });

  it('survives storage being unavailable', () => {
    window.localStorage.getItem.mockImplementation(() => { throw new Error('blocked'); });
    window.localStorage.setItem.mockImplementation(() => { throw new Error('blocked'); });
    show('2026-10-05T10:00:00Z');
    expect(screen.getByText(/launches on 11 October/i)).toBeTruthy();
    // Dismissing must still hide it for this view even though nothing persists.
    fireEvent.click(screen.getByRole('button', { name: /dismiss launch announcement/i }));
    expect(screen.queryByText(/launches on 11 October/i)).toBeNull();
  });
});
