/**
 * A member already on the best plan on sale saw "Go Premium" as the page title
 * and again as the closing button, which could only lead to a refused order
 * ("You are already on this plan"). Free and founding members still see both.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'user', features: {} }, checkAuth: vi.fn() }),
}));
vi.mock('../../utils/analytics', () => ({ track: vi.fn(), STAGES: {} }));

import api from '../../api/axios';
import i18n from '../../i18n';
import Subscription from '../../pages/Subscription';

// Read the copy from the locale files, so a wording change does not break this.
const GO_PREMIUM = i18n.t('plans.header.goPremium');
const CLOSING = i18n.t('plans.closing.heading');
const PAGE_TITLE = i18n.t('navbar.subscription');

const PLANS = {
  plans: {
    free: { name: 'Free', price: 0, duration: 'Unlimited', contactUnlocks: 0, features: [] },
    premium_plus: { name: 'Premium', price: 1100, mrp: 2500, duration: '90 days', contactUnlocks: -1, features: [] },
  },
  bundles: {},
  launchOffer: { active: false },
};

const serve = (subscription) => {
  api.get.mockImplementation((url) => {
    if (url === '/subscription/plans') return Promise.resolve({ data: PLANS });
    if (url === '/subscription/my-subscription') return Promise.resolve({ data: { subscription } });
    return Promise.resolve({ data: {} });
  });
};

const renderPage = () => render(
  <HelmetProvider><MemoryRouter><Subscription /></MemoryRouter></HelmetProvider>,
);

beforeEach(() => vi.clearAllMocks());

describe('plans page for a member who already holds the plan on sale', () => {
  it('drops the "Go Premium" title and closing button', async () => {
    serve({ planType: 'premium_plus', status: 'active', endDate: '2027-01-10T18:29:59.999Z', contactUnlocksAllowed: null });
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: PAGE_TITLE })).toBeInTheDocument();
    expect(screen.queryByText(GO_PREMIUM)).not.toBeInTheDocument();
    expect(screen.queryByText(CLOSING)).not.toBeInTheDocument();
  });

  it('still invites a free member to go Premium', async () => {
    serve(null);
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: GO_PREMIUM })).toBeInTheDocument();
    expect(screen.getByText(CLOSING)).toBeInTheDocument();
  });

  it('still invites a founding member, whose grant ranks below the plan on sale', async () => {
    serve({ planType: 'founding_premium', status: 'active', endDate: '2026-11-10T00:00:00.000Z', contactUnlocksAllowed: 3 });
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: GO_PREMIUM })).toBeInTheDocument();
  });
});
