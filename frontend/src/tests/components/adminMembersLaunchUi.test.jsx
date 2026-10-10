/**
 * Admin members, plans and money (launch week): correcting a member's date of
 * birth or gender, a failed member list that says it failed, phone numbers in
 * the list, the refund dialog working out the published policy, lists that
 * ignore a stale response, the moderation history's readable staff actions,
 * and the dashboard's open-work tiles.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const api = vi.hoisted(() => ({
  getUsers: vi.fn(), getUser: vi.fn(), getModerationHistory: vi.fn(), updateSubscription: vi.fn(), updateVerification: vi.fn(),
  cancelSubscription: vi.fn(), refundSubscription: vi.fn(), deleteUsers: vi.fn(), updateUserStatus: vi.fn(),
  updateUserVisibility: vi.fn(), removePhoto: vi.fn(), flagPhoto: vi.fn(), getPlanOptions: vi.fn(),
  changeMemberIdentity: vi.fn(), exportUsers: vi.fn(), bulkUpdateStatus: vi.fn(), getAnalytics: vi.fn(),
  adminGetInvoice: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const scopes = vi.hoisted(() => ({ value: null }));

vi.mock('../../api/adminApi', () => api);
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('../../components/admin/AdminLayout', () => ({ useAdminScopes: () => scopes.value }));
// Charts are not under test here and need layout jsdom does not have.
vi.mock('recharts', () => {
  const Box = ({ children }) => <div>{children}</div>;
  const Nothing = () => null;
  return {
    ResponsiveContainer: Box, LineChart: Box, BarChart: Box, PieChart: Box, Pie: Box,
    Line: Nothing, Bar: Nothing, Cell: Nothing, XAxis: Nothing, YAxis: Nothing, CartesianGrid: Nothing, Tooltip: Nothing, Legend: Nothing,
  };
});

import AdminUserDetail from '../../pages/admin/AdminUserDetail';
import AdminUsers from '../../pages/admin/AdminUsers';
import AdminSubscriptions from '../../pages/admin/AdminSubscriptions';
import AdminDashboard from '../../pages/admin/AdminDashboard';
import PlanRefundDialog, { refundSuggestion } from '../../components/admin/PlanRefundDialog';

const DAY = 24 * 60 * 60 * 1000;

const member = (over = {}) => ({
  data: {
    user: {
      id: 'd40443e0-1111-4111-8111-111111111111', email: 'asha@example.com', role: 'user', status: 'active',
      Profile: { firstName: 'Asha', lastName: 'Verma', photos: [], gender: 'female', dateOfBirth: '1996-04-12T00:00:00.000Z' },
      Verifications: [], Subscriptions: [], activeSubscription: null,
      ...over,
    },
    reports: [],
  },
});

const renderDetail = () => render(
  <MemoryRouter initialEntries={['/admin/users/u1']}>
    <Routes><Route path="/admin/users/:userId" element={<AdminUserDetail />} /></Routes>
  </MemoryRouter>,
);
const renderAt = (ui, path = '/') => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

const usersPage = (users, total = users.length) => ({ data: { users, pagination: { page: 1, limit: 20, total, pages: 1 } } });

beforeEach(() => {
  vi.clearAllMocks();
  scopes.value = null;
  api.getModerationHistory.mockResolvedValue({ data: { summary: {}, timeline: [] } });
  api.getPlanOptions.mockResolvedValue({ data: { options: [] } });
});
afterEach(cleanup);

describe('correcting date of birth or gender', () => {
  it('sends only what changed, with the reason', async () => {
    api.getUser.mockResolvedValue(member());
    api.changeMemberIdentity.mockResolvedValue({ data: { success: true } });
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: /edit date of birth \/ gender/i }));
    const dialog = screen.getByRole('dialog', { name: /correct date of birth or gender/i });
    // The stored date shows as the India calendar day.
    expect(within(dialog).getByLabelText('Date of birth').value).toBe('1996-04-12');

    const save = within(dialog).getByRole('button', { name: 'Save change' });
    expect(save).toBeDisabled(); // nothing changed yet
    fireEvent.change(within(dialog).getByLabelText('Date of birth'), { target: { value: '1995-04-12' } });
    expect(save).toBeDisabled(); // no reason yet
    fireEvent.change(within(dialog).getByLabelText(/reason for the change/i), { target: { value: 'Typo at sign-up, member sent proof' } });
    fireEvent.click(save);

    await waitFor(() => expect(api.changeMemberIdentity).toHaveBeenCalledWith(
      'u1', { reason: 'Typo at sign-up, member sent proof', dateOfBirth: '1995-04-12' },
    ));
    await waitFor(() => expect(api.getUser.mock.calls.length).toBeGreaterThan(1));
  });

  it('shows the server\'s age-rule refusal inside the dialog', async () => {
    api.getUser.mockResolvedValue(member());
    api.changeMemberIdentity.mockRejectedValue({ response: { data: { error: { message: 'The member must be at least 21 years old' } } } });
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: /edit date of birth \/ gender/i }));
    const dialog = screen.getByRole('dialog', { name: /correct date of birth or gender/i });
    fireEvent.change(within(dialog).getByLabelText('Gender'), { target: { value: 'male' } });
    fireEvent.change(within(dialog).getByLabelText(/reason for the change/i), { target: { value: 'Gender entered wrongly' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save change' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The member must be at least 21 years old');
    expect(api.changeMemberIdentity).toHaveBeenCalledWith('u1', { reason: 'Gender entered wrongly', gender: 'male' });
  });

  it('is not offered without the users scope', async () => {
    scopes.value = ['subscriptions'];
    api.getUser.mockResolvedValue(member());
    renderDetail();
    await screen.findAllByText('asha@example.com');
    expect(screen.queryByRole('button', { name: /edit date of birth/i })).toBeNull();
  });
});

describe('member page header and load states', () => {
  it('shows the TCS profile code', async () => {
    api.getUser.mockResolvedValue(member());
    renderDetail();
    expect(await screen.findByText('TCS-D40443E0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy profile code/i })).toBeInTheDocument();
  });

  it('a failed load is an error with a retry, not "User not found"', async () => {
    api.getUser.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValue(member());
    renderDetail();
    expect(await screen.findByText(/couldn't load this member/i)).toBeInTheDocument();
    expect(screen.queryByText('User not found')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('TCS-D40443E0')).toBeInTheDocument();
  });

  it('a 404 says the user was not found', async () => {
    api.getUser.mockRejectedValue({ response: { status: 404 } });
    renderDetail();
    expect(await screen.findByText('User not found')).toBeInTheDocument();
  });

  it('an assisted signup that has not accepted the Terms says so', async () => {
    api.getUser.mockResolvedValue(member({ termsVersion: 'assisted-signup', termsAcceptedAt: null }));
    renderDetail();
    expect(await screen.findByText('Not accepted yet (assisted signup)')).toBeInTheDocument();
  });

  it('plan history shows the payment date, the gateway ids and a dispute', async () => {
    api.getUser.mockResolvedValue(member({
      Subscriptions: [{
        id: 's1', planType: 'premium_plus', status: 'active', amount: 1099, refundedAmount: 0,
        razorpayPaymentId: 'pay_PAYID123', razorpayOrderId: 'order_ORD456', razorpaySignature: 'sig',
        paidAt: '2026-10-08T08:22:00.000Z', paymentRail: 'razorpay', disputeStatus: 'open',
        endDate: '2027-01-10T18:29:59.999Z',
      }],
    }));
    renderDetail();
    expect(await screen.findByText('pay_PAYID123')).toBeInTheDocument();
    expect(screen.getByText('order_ORD456')).toBeInTheDocument();
    expect(screen.getByText(/^Paid 8 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText('Payment dispute: open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy payment id' })).toBeInTheDocument();
  });
});

describe('moderation history', () => {
  it('reads staff actions as what changed and why, and folds record views away', async () => {
    api.getUser.mockResolvedValue(member());
    api.getModerationHistory.mockResolvedValue({
      data: {
        summary: { reportsReceived: 0, reportsResolved: 0, reportsFiled: 0, photosHeld: 0, appeals: 0, views: 2 },
        timeline: [
          { at: '2026-10-09T10:00:00Z', kind: 'staff_action', summary: 'user_status_changed', id: 'a1', byName: 'Neha', details: { previousStatus: 'active', newStatus: 'banned', reason: 'fake photos' } },
          { at: '2026-10-09T11:00:00Z', kind: 'staff_action', summary: 'member_record_viewed', id: 'v1', byName: 'Neha', view: true },
          { at: '2026-10-09T12:00:00Z', kind: 'staff_action', summary: 'member_record_viewed', id: 'v2', byName: 'Neha', view: true },
        ],
      },
    });
    renderDetail();
    expect(await screen.findByText(/active → banned · "fake photos"/)).toBeInTheDocument();
    expect(screen.queryByText(/Member record opened/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show views (2)' }));
    expect(screen.getAllByText(/Member record opened/)).toHaveLength(2);
  });
});

describe('the members list', () => {
  it('shows the phone number, and on its own when there is no email', async () => {
    api.getUsers.mockResolvedValue(usersPage([
      { id: 'u1', email: null, phone: '9876510001', role: 'user', status: 'active', Profile: { firstName: 'Ravi', lastName: 'Kumar' } },
    ]));
    renderAt(<AdminUsers />);
    expect(await screen.findByText('+91 98765 10001')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search name, email, phone or TCS code')).toBeInTheDocument();
  });

  it('a failed load says so and retries, instead of "No members yet"', async () => {
    api.getUsers.mockRejectedValueOnce(new Error('500')).mockResolvedValue(usersPage([
      { id: 'u1', email: 'asha@example.com', role: 'user', status: 'active', Profile: { firstName: 'Asha' } },
    ]));
    renderAt(<AdminUsers />);
    expect(await screen.findByText(/couldn't load the members/i)).toBeInTheDocument();
    expect(screen.queryByText('No members yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('asha@example.com')).toBeInTheDocument();
  });

  it('ignores a slower, older response that lands after a newer one', async () => {
    let releaseFirst;
    api.getUsers
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
      .mockResolvedValue(usersPage([{ id: 'u2', email: 'banned@example.com', role: 'user', status: 'banned', Profile: { firstName: 'B' } }]));
    renderAt(<AdminUsers />);
    await waitFor(() => expect(api.getUsers).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'banned' } });
    expect(await screen.findByText('banned@example.com')).toBeInTheDocument();
    await act(async () => {
      releaseFirst(usersPage([{ id: 'u1', email: 'everyone@example.com', role: 'user', status: 'active', Profile: { firstName: 'E' } }], 5000));
    });
    expect(screen.queryByText('everyone@example.com')).toBeNull();
    expect(screen.getByText('banned@example.com')).toBeInTheDocument();
  });

  it('waits for a pause in typing before searching', async () => {
    api.getUsers.mockResolvedValue(usersPage([]));
    renderAt(<AdminUsers />);
    await waitFor(() => expect(api.getUsers).toHaveBeenCalledTimes(1));
    const box = screen.getByPlaceholderText('Search name, email, phone or TCS code');
    fireEvent.change(box, { target: { value: '98' } });
    fireEvent.change(box, { target: { value: '98765' } });
    fireEvent.change(box, { target: { value: '+91 98765 10001' } });
    await waitFor(() => expect(api.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ search: '+91 98765 10001' })));
    const searches = api.getUsers.mock.calls.map(([p]) => p.search).filter(Boolean);
    expect(searches).toEqual(['+91 98765 10001']);
  });

  it('opens with the filters a dashboard tile links to', async () => {
    api.getUsers.mockResolvedValue(usersPage([]));
    renderAt(<AdminUsers />, '/admin/users?hasPhoto=no&role=user&status=active');
    await waitFor(() => expect(api.getUsers).toHaveBeenCalledWith(expect.objectContaining({ hasPhoto: 'no', role: 'user', status: 'active' })));
  });

  it('sends "paying" for real payments, and reads an old "paid" link as any premium', async () => {
    api.getUsers.mockResolvedValue(usersPage([]));
    renderAt(<AdminUsers />, '/admin/users?plan=paid');
    await waitFor(() => expect(api.getUsers).toHaveBeenCalledWith(expect.objectContaining({ plan: 'premium' })));
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'paying' } });
    await waitFor(() => expect(api.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ plan: 'paying' })));
  });
});

describe('the subscriptions list', () => {
  it('starts on members who really paid, with a total', async () => {
    api.getUsers.mockResolvedValue(usersPage([], 7));
    renderAt(<AdminSubscriptions />);
    await waitFor(() => expect(api.getUsers).toHaveBeenCalledWith(expect.objectContaining({ plan: 'paying' })));
    expect(await screen.findByText(/7 members · Paid \(real payment\)/)).toBeInTheDocument();
  });
});

describe('refund policy figure', () => {
  const now = Date.parse('2026-10-11T12:00:00.000Z');
  const paid = (over) => ({ id: 's1', planType: 'premium_plus', amount: 1099, refundedAmount: 0, razorpayPaymentId: 'pay_1', contactUnlocksAllowed: null, ...over });

  it('inside seven days: the full amount less unlocks at ₹199 for three', () => {
    const p = refundSuggestion(paid({ paidAt: new Date(now - 2 * DAY).toISOString(), contactUnlocksUsed: 4 }), now);
    expect(p.withinWindow).toBe(true);
    expect(p.days).toBe(2);
    expect(p.deduction).toBe(265); // 4 × 199 / 3 = 265.33
    expect(p.suggested).toBe(834);
  });

  it('no unlocks used: the whole remaining amount', () => {
    const p = refundSuggestion(paid({ paidAt: new Date(now - 6 * DAY).toISOString(), contactUnlocksUsed: 0, refundedAmount: 99 }), now);
    expect(p.suggested).toBe(1000);
  });

  it('after seven days: nothing, by the published policy', () => {
    const p = refundSuggestion(paid({ paidAt: new Date(now - 8 * DAY).toISOString(), contactUnlocksUsed: 0 }), now);
    expect(p.withinWindow).toBe(false);
    expect(p.suggested).toBe(0);
  });

  it('never suggests below zero, and cannot measure without a payment date', () => {
    expect(refundSuggestion(paid({ paidAt: new Date(now - DAY).toISOString(), contactUnlocksUsed: 30 }), now).suggested).toBe(0);
    expect(refundSuggestion(paid({}), now).suggested).toBeNull();
  });

  it('the dialog shows the figure, the unlocks and the age, and starts the amount there', () => {
    render(
      <PlanRefundDialog
        row={paid({ paidAt: new Date(Date.now() - 2 * DAY).toISOString(), contactUnlocksUsed: 4 })}
        onClose={() => {}}
        onRefunded={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: /refund this payment/i });
    expect(within(dialog).getByText('Policy suggests ₹834')).toBeInTheDocument();
    expect(within(dialog).getByText('4 of unlimited')).toBeInTheDocument();
    expect(within(dialog).getByText('2 days ago')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/amount to refund/i).value).toBe('834');
  });

  it('flags a payment older than seven days and leaves the amount for the admin to type', () => {
    render(<PlanRefundDialog row={paid({ paidAt: new Date(Date.now() - 9 * DAY).toISOString() })} onClose={() => {}} onRefunded={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: /refund this payment/i });
    expect(within(dialog).getByText('9 days ago')).toHaveClass('text-amber-800');
    expect(within(dialog).getByText('Policy suggests ₹0')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/amount to refund/i).value).toBe('');
  });
});

describe('dashboard', () => {
  const analytics = {
    data: {
      stats: {
        totalUsers: 120, verifiedUsers: 30, emailVerifiedUsers: 80, activeSubscribers: 11, paidSubscribers: 7,
        foundingActive: 2, staffGrantedActive: 2, revenueThisMonth: 7000, pendingVerifications: 1, openReports: 3,
        urgentOpenReports: 1, pendingAppeals: 2, unreadSupport: 4, oldestUnreadSupportAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        signupsToday: 9, paymentsToday: 3, profilesWithoutPhoto: 40, founding: null,
      },
      registrations: [], revenue: [], planDistribution: [],
    },
  };

  it('counts paying members apart from grants and opens the work behind each figure', async () => {
    api.getAnalytics.mockResolvedValue(analytics);
    renderAt(<AdminDashboard />);
    expect(await screen.findByText('plus 2 founding · 2 granted by staff')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /signups today/i })).toHaveAttribute('href', '/admin/users?joined=today');
    expect(screen.getByRole('link', { name: /urgent reports open/i })).toHaveAttribute('href', '/admin/reports?priority=urgent');
    expect(screen.getByRole('link', { name: /appeals waiting/i })).toHaveAttribute('href', '/admin/appeals');
    expect(screen.getByRole('link', { name: /oldest unread enquiry/i })).toHaveTextContent('5 h');
    expect(screen.getByRole('link', { name: /profiles with no photo/i })).toHaveAttribute('href', '/admin/users?hasPhoto=no&role=user&status=active');
  });

  it('hides tiles a scoped admin cannot open', async () => {
    scopes.value = ['users'];
    api.getAnalytics.mockResolvedValue({ data: { ...analytics.data, stats: { ...analytics.data.stats, paymentsToday: null, revenueThisMonth: null } } });
    renderAt(<AdminDashboard />);
    expect(await screen.findByRole('link', { name: /signups today/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /urgent reports open/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /payments today/i })).toBeNull();
  });
});
