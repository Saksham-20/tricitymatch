/**
 * The Team page is for marketing managers (and admins looking in). A plain
 * partner must not even see the link, and the partner page must surface leads
 * that nobody is following up.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const auth = vi.hoisted(() => ({ role: 'marketing' }));
const client = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
const api = vi.hoisted(() => ({ reassignPartnerLeads: vi.fn(), updateMarketingUser: vi.fn(), resetMarketingUserPassword: vi.fn(), resendPartnerWelcome: vi.fn(), assignLead: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: auth.role, email: 'x@example.com', firstName: 'X' }, logout: vi.fn() }) }));
vi.mock('../../api/apiClient', () => ({ default: client }));
vi.mock('../../api/adminApi', () => api);
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('../../hooks/useDarkMode', () => ({ default: () => ({ isDark: false, toggle: vi.fn() }) }));
vi.mock('../../components/admin/AdminLayout', () => ({ useAdminScopes: () => null }));
vi.mock('../../hooks/useAutoRefresh', () => ({ default: () => {} }));

import MarketingLayout from '../../pages/marketing/MarketingLayout';
import AdminMarketingUserDetail from '../../pages/admin/AdminMarketingUserDetail';

afterEach(cleanup);

describe('Marketing portal navigation', () => {
  beforeEach(() => {
    client.get.mockResolvedValue({ data: { onboarding: { steps: { agreement: true } } } });
  });

  const renderLayout = () => render(
    <MemoryRouter initialEntries={['/marketing/dashboard']}>
      <Routes><Route path="/marketing" element={<MarketingLayout />}><Route path="dashboard" element={<p>dash</p>} /></Route></Routes>
    </MemoryRouter>,
  );

  it.each([
    ['marketing', false],
    ['marketing_manager', true],
    ['admin', true],
    ['super_admin', true],
  ])('%s sees the Team link: %s', async (role, visible) => {
    auth.role = role;
    renderLayout();
    await screen.findByText('dash');
    expect(screen.queryByRole('link', { name: 'Team' }) !== null).toBe(visible);
  });

  it('puts Team between the member tools and the guide', async () => {
    auth.role = 'marketing_manager';
    renderLayout();
    await screen.findByText('dash');
    const labels = screen.getAllByRole('link').map((a) => a.textContent.trim());
    expect(labels.indexOf('Team')).toBe(labels.indexOf('Referral Codes') + 1);
  });
});

describe('Partner page: open leads', () => {
  const load = ({ status = 'active', openLeads = 5 } = {}) => {
    client.get.mockImplementation(async (url) => {
      if (url.includes('/report')) {
        return { data: { user: { id: 'p1', email: 'rohit@example.com', role: 'marketing', status, Profile: { firstName: 'Rohit', lastName: 'Sethi' } }, onboarding: null, openLeads, summary: null, members: [], pagination: { total: 0 } } };
      }
      if (url.includes('/admin/referral-codes')) return { data: { codes: [] } };
      if (url.includes('/payouts')) return { data: { summary: { payable: 0, inHold: 0 }, payouts: [] } };
      if (url.includes('/admin/marketing-users')) return { data: { users: [{ id: 'p2', email: 'meera@example.com', status: 'active', Profile: { firstName: 'Meera' } }] } };
      return { data: {} };
    });
    return render(
      <MemoryRouter initialEntries={['/admin/marketing-users/p1']}>
        <Routes><Route path="/admin/marketing-users/:userId" element={<AdminMarketingUserDetail />} /></Routes>
      </MemoryRouter>,
    );
  };

  it('shows the count and moves them to another partner', async () => {
    api.reassignPartnerLeads.mockResolvedValue({ data: { message: 'Moved 5 leads.' } });
    load();
    await screen.findByText('5 open leads');
    fireEvent.click(screen.getByRole('button', { name: 'Move to another partner' }));
    fireEvent.change(await screen.findByLabelText('Give to'), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move 5 leads' }));
    await waitFor(() => expect(api.reassignPartnerLeads).toHaveBeenCalledWith('p1', 'p2'));
    expect(toast.success).toHaveBeenCalledWith('Moved 5 leads.');
  });

  it('warns that an inactive partner\'s leads are going nowhere', async () => {
    load({ status: 'inactive', openLeads: 1 });
    await screen.findByText('1 open lead');
    expect(screen.getByText(/nobody is following these people up/)).toBeInTheDocument();
  });

  it('shows nothing when there are no open leads', async () => {
    load({ openLeads: 0 });
    await screen.findByRole('heading', { name: 'Rohit Sethi' });
    expect(screen.queryByRole('button', { name: 'Move to another partner' })).not.toBeInTheDocument();
  });
});
