/**
 * Who is under which partner, in the admin panel: Partner members filters and
 * the member/partner columns, the Marketing Users search and numbers, phone
 * card layouts, and the guide checkbox that scrolled the portal out of view.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({ assignLead: vi.fn(), reassignPartnerLeads: vi.fn() }));
const client = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('../../api/adminApi', () => api);
vi.mock('../../api/apiClient', () => ({ default: client }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('../../components/admin/AdminLayout', () => ({ useAdminScopes: () => null }));
vi.mock('../../components/admin/CommissionSettingsCard', () => ({ default: () => null }));

import AdminLeads from '../../pages/admin/AdminLeads';
import AdminMarketingUsers from '../../pages/admin/AdminMarketingUsers';
import MemberReportTable from '../../components/marketing/MemberReportTable';
import CheckBox from '../../components/ui/CheckBox';

const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; };

const setNarrow = (narrow) => {
  window.matchMedia.mockImplementation((query) => ({
    matches: narrow && query.includes('max-width'),
    media: query, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
};

beforeEach(() => { vi.clearAllMocks(); setNarrow(false); });
afterEach(cleanup);

const partners = [{ id: 'p1', email: 'rohit@example.com', status: 'active', Profile: { firstName: 'Rohit', lastName: 'Sethi' } }];
const leads = [
  {
    id: 'l1', name: 'Neha', phone: '9876500001', email: null, city: 'Mohali', status: 'converted', referralCode: 'ROHIT10', campaign: 'Sector 17',
    assignedToMarketingUserId: 'p1', AssignedMarketer: { id: 'p1', email: 'rohit@example.com', status: 'active' }, partnerName: 'Rohit Sethi',
    convertedUserId: 'u9', createdAt: '2026-10-01T05:00:00Z',
    member: { id: 'u9', name: 'Neha Kaur', status: 'active', paid: true, amountPaid: 1099, planType: 'premium_plus', signedUpAt: '2026-10-02T05:00:00Z' },
  },
];

describe('Partner members (admin)', () => {
  const renderPage = (entry = '/admin/leads') => {
    client.get.mockImplementation(async (url) => {
      if (url.startsWith('/admin/leads')) return { data: { leads, summary: { total: 1, signedUp: 1, paid: 1 }, pagination: { pages: 1, total: 1 } } };
      return { data: { users: partners } };
    });
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes><Route path="/admin/leads" element={<><AdminLeads /><Where /></>} /></Routes>
      </MemoryRouter>,
    );
  };

  it('shows which partner each person is with, the member they became and what they paid', async () => {
    renderPage();
    const row = (await screen.findByRole('cell', { name: 'Neha' })).closest('tr');
    expect(within(row).getByRole('link', { name: 'Rohit Sethi' })).toHaveAttribute('href', '/admin/marketing-users/p1');
    expect(within(row).getByRole('link', { name: 'Neha Kaur' })).toHaveAttribute('href', '/admin/users/u9');
    expect(within(row).getByText('₹1,099')).toBeInTheDocument();
  });

  it('keeps filters in the URL and sends them to the server', async () => {
    renderPage('/admin/leads?marketingUserId=p1');
    await screen.findByRole('cell', { name: 'Neha' });
    expect(client.get).toHaveBeenCalledWith(expect.stringContaining('marketingUserId=p1'));
    fireEvent.change(screen.getByLabelText('Paid'), { target: { value: 'yes' } });
    await waitFor(() => expect(screen.getByTestId('where').textContent).toContain('paid=yes'));
    await waitFor(() => expect(client.get).toHaveBeenCalledWith(expect.stringMatching(/\/admin\/leads\?.*paid=yes/)));
  });

  it('shows one card per person on a phone', async () => {
    setNarrow(true);
    renderPage();
    expect(await screen.findByText('Neha')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: /filters/i })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Marketing Users (admin)', () => {
  const row = {
    id: 'p1', email: 'rohit@example.com', role: 'marketing', status: 'active', createdAt: '2026-09-01T00:00:00Z',
    Profile: { firstName: 'Rohit', lastName: 'Sethi' },
    onboarding: { completed: 4, total: 4, complete: true, steps: { agreement: true, payout: true, code: true, outreach: true } },
    metrics: { totalLeads: 12, signedUp: 7, paidMembers: 3, revenue: 3297, commissionEarned: 659 },
  };

  it('shows each partner\'s numbers linked to their filtered members, and searches', async () => {
    client.get.mockResolvedValue({ data: { users: [row], totals: { partners: 1, active: 1, totalLeads: 12, signedUp: 7, paidMembers: 3, revenue: 3297, commissionEarned: 659 }, pagination: { pages: 1, total: 1 } } });
    render(<MemoryRouter><AdminMarketingUsers /></MemoryRouter>);
    const paidLink = await screen.findByRole('link', { name: '3' });
    expect(paidLink).toHaveAttribute('href', '/admin/leads?marketingUserId=p1&paid=yes');
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'rohit' } });
    await waitFor(() => expect(client.get).toHaveBeenCalledWith(expect.stringContaining('search=rohit')), { timeout: 1500 });
  });
});

describe('Shared pieces', () => {
  it('member report shows cards on a phone and links the member for admins', () => {
    setNarrow(true);
    render(
      <MemoryRouter>
        <MemberReportTable
          members={[{ leadId: 'l1', memberId: 'u9', name: 'Neha Kaur', phone: '9876500001', leadStatus: 'converted', signedUp: true, signedUpAt: '2026-10-02', paid: false }]}
          memberHref={(m) => `/admin/users/${m.memberId}`}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('link', { name: 'Neha Kaur' })).toHaveAttribute('href', '/admin/users/u9');
  });

  // sr-only makes the input absolute; without a positioned label it escaped the
  // portal's scrolling <main>, grew the window, and a click on the Partner
  // Guide's checkbox scrolled the whole portal out of view.
  it('checkbox input is positioned inside its label', () => {
    render(<CheckBox checked={false} onChange={() => {}} label="I agree" />);
    expect(screen.getByRole('checkbox').closest('label').className).toMatch(/\brelative\b/);
  });
});
