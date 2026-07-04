/**
 * Dashboard state-branch tests (2026-07 refinement pass).
 * Covers the three behavioral branches added in the polish pass:
 *  - error banner (server failure must NOT render as an empty profile)
 *  - first-run setup checklist (replaces zero-stats for new/thin profiles)
 *  - fixed empty-state condition (a populated rail suppresses the empty card)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockAuth = { user: { firstName: 'Test' } };
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '../../api/axios';
import Dashboard from '../../pages/Dashboard';

const OLD_DATE = '2020-01-01T00:00:00.000Z';

// Route api.get by URL so each test controls every dashboard request.
const routeApi = (routes) => {
  api.get.mockImplementation((url) => {
    for (const [match, result] of routes) {
      if (url.startsWith(match)) {
        return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
      }
    }
    return Promise.reject(Object.assign(new Error('unmocked ' + url), { response: { status: 500 } }));
  });
};

const okEmpty = (profile) => ([
  ['/profile/me/stats', { data: { stats: { viewsThisWeek: 0, totalViews: 0, likesReceived: 0 } } }],
  ['/search/suggestions', { data: { suggestions: [] } }],
  ['/match/mutual', { data: { mutualMatches: [] } }],
  ['/profile/me/recently-viewed', { data: { profiles: [] } }],
  ['/profile/me', { data: { profile } }],
  ['/subscription/my-subscription', { data: { subscription: null } }],
  ['/match/daily', { data: { matches: [] } }],
]);

const completeProfile = {
  id: 1, firstName: 'Test', lastName: 'User', completionPercentage: 92,
  createdAt: OLD_DATE, profilePhoto: 'x.jpg', bio: 'a long enough bio for the meter to accept',
};

const renderDash = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('Dashboard error state', () => {
  it('renders the error banner with retry when requests fail — not the empty-profile card', async () => {
    const boom = Object.assign(new Error('server down'), { response: { status: 500 } });
    routeApi([['/', boom]]);
    renderDash();

    await waitFor(() => expect(screen.getByText(/couldn't load your dashboard/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/no matches to show yet/i)).not.toBeInTheDocument();
  });
});

describe('Dashboard first-run variant', () => {
  it('shows the setup checklist instead of zero-stats for a thin profile', async () => {
    const thinProfile = { id: 1, firstName: 'New', completionPercentage: 25, createdAt: OLD_DATE };
    routeApi(okEmpty(thinProfile));
    renderDash();

    await waitFor(() => expect(screen.getByText(/add your photo/i)).toBeInTheDocument());
    expect(screen.getByText(/set partner preferences/i)).toBeInTheDocument();
    expect(screen.queryByText('Profile Views')).not.toBeInTheDocument();
  });

  it('shows the normal stats row for an established complete profile', async () => {
    routeApi(okEmpty(completeProfile));
    renderDash();

    await waitFor(() => expect(screen.getByText('Profile Views')).toBeInTheDocument());
    expect(screen.queryByText(/add your photo/i)).not.toBeInTheDocument();
  });
});

describe('Dashboard empty state condition', () => {
  it('shows the discovery empty state when every section is empty', async () => {
    routeApi(okEmpty(completeProfile));
    renderDash();

    await waitFor(() => expect(screen.getByText(/no matches to show yet/i)).toBeInTheDocument());
  });

  it('suppresses the empty state when Today\'s Matches has content (the fixed condition)', async () => {
    const daily = [{ userId: 7, firstName: 'Simran', lastName: 'Kaur', city: 'Chandigarh' }];
    const routes = okEmpty(completeProfile).map(([m, r]) =>
      m === '/match/daily' ? [m, { data: { matches: daily, isPremium: true } }] : [m, r]);
    routeApi(routes);
    renderDash();

    await waitFor(() => expect(screen.getByText("Today's Matches")).toBeInTheDocument());
    expect(screen.queryByText(/no matches to show yet/i)).not.toBeInTheDocument();
  });
});
