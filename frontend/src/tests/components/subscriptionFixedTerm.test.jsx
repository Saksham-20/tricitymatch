/**
 * Plans page under the fixed launch term (owner decision 2026-10-09): the card
 * names the end date, the banner explains the final-month bonus, and no unit
 * price ("≈ ₹351/month", "₹12/day") is shown — it moved daily as the offer
 * ran down and read like a different price.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'user', features: {} }, checkAuth: vi.fn() }),
}));
vi.mock('../../utils/analytics', () => ({ track: vi.fn(), STAGES: {} }));

import api from '../../api/axios';
import Subscription from '../../pages/Subscription';

const END = '2027-01-10T18:29:59.999Z';
const PLANS = {
  plans: {
    free: { name: 'Free', price: 0, duration: 'Unlimited', contactUnlocks: 0, features: [] },
    premium_plus: {
      name: 'Premium', price: 1100, mrp: 2500, perMonth: 351, duration: 'until 10 January 2027',
      durationDays: 94, endsOn: END, contactUnlocks: -1, isLaunchPrice: true, features: [],
    },
  },
  bundles: {},
  launchOffer: {
    active: true, endsAt: END, headline: 'Launch offer', subline: null,
    fixedTerm: {
      plansEndOn: END, finalMonthFrom: '2026-12-10T18:30:00.000Z',
      lateBonusMonths: 1, bonusEndsOn: '2027-02-10T18:29:59.999Z',
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Second month of the offer: the bonus line still applies to a later buy.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T06:00:00Z'));
  api.get.mockImplementation((url) => {
    if (url === '/subscription/plans') return Promise.resolve({ data: PLANS });
    if (url === '/subscription/my-subscription') return Promise.resolve({ data: { subscription: null } });
    return Promise.resolve({ data: {} });
  });
});

afterEach(() => vi.useRealTimers());

const renderPage = () => render(
  <HelmetProvider><MemoryRouter><Subscription /></MemoryRouter></HelmetProvider>,
);

describe('plans page, fixed launch term', () => {
  it('drops the bonus line once the final month has started', async () => {
    vi.setSystemTime(new Date('2026-12-20T06:00:00Z'));
    renderPage();
    await screen.findByText(/Every plan bought in the launch offer runs until/);
    expect(screen.queryByText(/extra month/)).not.toBeInTheDocument();
  });

  it('names the end date on the card and in the banner', async () => {
    renderPage();
    expect((await screen.findAllByText(/until 10 Jan 2027/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Every plan bought in the launch offer runs until 10 Jan 2027/)).toBeInTheDocument();
    expect(screen.getByText(/Buy from 11 Dec 2026 and get 1 extra month, to 10 Feb 2027/)).toBeInTheDocument();
  });

  it('shows no per-month or per-day price', async () => {
    renderPage();
    await screen.findAllByText(/until 10 Jan 2027/);
    expect(document.body.textContent).not.toMatch(/\/month|\/day|351/);
  });
});
