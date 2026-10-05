/**
 * Admin tools added for launch: caring for a partner account, and issuing a
 * refund from a member's subscription history (money leaves through Razorpay,
 * so the modal must state the amount, cap it, and insist on a reason).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const api = vi.hoisted(() => ({
  getUser: vi.fn(), getModerationHistory: vi.fn(), updateSubscription: vi.fn(), updateVerification: vi.fn(),
  cancelSubscription: vi.fn(), refundSubscription: vi.fn(), deleteUsers: vi.fn(), updateUserStatus: vi.fn(),
  removePhoto: vi.fn(), flagPhoto: vi.fn(), getPlanOptions: vi.fn(),
  updateMarketingUser: vi.fn(), resetMarketingUserPassword: vi.fn(), resendPartnerWelcome: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const scopes = vi.hoisted(() => ({ value: null }));

vi.mock('../../api/adminApi', () => api);
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('../../utils/copyText', () => ({ default: vi.fn(async () => true) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('../../components/admin/AdminLayout', () => ({ useAdminScopes: () => scopes.value }));

import AdminUserDetail from '../../pages/admin/AdminUserDetail';
import PartnerAccountCard from '../../components/admin/PartnerAccountCard';

beforeEach(() => {
  vi.clearAllMocks();
  scopes.value = null;
  api.getModerationHistory.mockResolvedValue({ data: { summary: {}, timeline: [] } });
  api.getPlanOptions.mockResolvedValue({ data: { options: [] } });
});
afterEach(cleanup);

const member = (subs) => ({
  data: {
    user: {
      id: 'u1', email: 'asha@example.com', role: 'user', status: 'active',
      Profile: { firstName: 'Asha', lastName: 'Verma', photos: [], fieldVisibility: { contact: 'matches' } },
      Verifications: [], Subscriptions: subs, activeSubscription: null,
    },
    reports: [],
  },
});

const renderDetail = () => render(
  <MemoryRouter initialEntries={['/admin/users/u1']}>
    <Routes><Route path="/admin/users/:userId" element={<AdminUserDetail />} /></Routes>
  </MemoryRouter>,
);

const paid = (over = {}) => ({
  id: 's1', planType: 'premium_plus', status: 'active', amount: 1099, razorpayPaymentId: 'pay_1',
  razorpaySignature: 'sig', refundedAmount: 0, refundedAt: null, endDate: '2027-01-01T00:00:00Z', ...over,
});

describe('Refund from the member page', () => {
  it('offers Refund only on a paid, not-yet-refunded Razorpay payment', async () => {
    api.getUser.mockResolvedValue(member([
      paid(),
      paid({ id: 's2', razorpayPaymentId: null }),                       // an admin grant
      paid({ id: 's3', razorpaySignature: 'GOOGLE_PLAY' }),              // refunded in Play Console
      paid({ id: 's4', refundedAt: '2026-10-01T00:00:00Z', refundedAmount: 1099 }),
    ]));
    renderDetail();
    await screen.findByText('History');
    expect(screen.getAllByRole('button', { name: 'Refund' })).toHaveLength(1);
    expect(screen.getByText('Refunded in full')).toBeInTheDocument();
    expect(screen.getByText('granted')).toBeInTheDocument();
  });

  it('hides it from an admin without the subscriptions scope', async () => {
    scopes.value = ['users'];
    api.getUser.mockResolvedValue(member([paid()]));
    renderDetail();
    await screen.findByText('History');
    expect(screen.queryByRole('button', { name: 'Refund' })).toBeNull();
    expect(screen.queryByRole('button', { name: /override plan/i })).toBeNull();
  });

  it('caps the amount at what is left, needs a reason, and sends rupees to the right payment', async () => {
    api.getUser.mockResolvedValue(member([paid({ refundedAmount: 99 })]));
    api.refundSubscription.mockResolvedValue({ data: { success: true } });
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));

    const dialog = await screen.findByRole('dialog', { name: /refund this payment/i });
    const amount = within(dialog).getByLabelText(/amount to refund/i);
    expect(amount.value).toBe('1000'); // 1099 paid less 99 already refunded
    const submit = within(dialog).getByRole('button', { name: /^Refund ₹/ });
    expect(submit).toBeDisabled(); // no reason yet

    fireEvent.change(amount, { target: { value: '5000' } });
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: 'duplicate payment' } });
    expect(within(dialog).getByText(/most that can be refunded is ₹1,000/i)).toBeInTheDocument();
    expect(submit).toBeDisabled();

    fireEvent.change(amount, { target: { value: '500' } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(api.refundSubscription).toHaveBeenCalledWith('s1', { amount: 500, reason: 'duplicate payment' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    // The page reloads the member so the history shows what was refunded.
    expect(api.getUser.mock.calls.length).toBeGreaterThan(1);
  });

  it('shows the server\'s reason when the gateway refuses', async () => {
    api.getUser.mockResolvedValue(member([paid()]));
    api.refundSubscription.mockRejectedValue({ response: { data: { error: { message: 'Refund failed: payment already fully refunded' } } } });
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));
    const dialog = await screen.findByRole('dialog', { name: /refund this payment/i });
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: 'customer request' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Refund ₹/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Refund failed: payment already fully refunded'));
  });

  it('shows the real contact-sharing setting, not the dead showPhone flag', async () => {
    api.getUser.mockResolvedValue(member([]));
    renderDetail();
    expect(await screen.findByText('Matches only')).toBeInTheDocument();
    expect(screen.queryByText('Shows phone')).toBeNull();
  });
});

describe('PartnerAccountCard', () => {
  const partner = { id: 'p1', email: 'priya@example.com', phone: '9876501234', Profile: { firstName: 'Priya', lastName: 'Field' } };

  it('saves corrected details and refreshes the page', async () => {
    api.updateMarketingUser.mockResolvedValue({ data: { success: true } });
    const onChanged = vi.fn();
    render(<PartnerAccountCard user={partner} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /edit details/i }));
    const dialog = await screen.findByRole('dialog', { name: /edit partner details/i });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'priya.field@example.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateMarketingUser).toHaveBeenCalledWith('p1', {
      firstName: 'Priya', lastName: 'Field', email: 'priya.field@example.com', phone: '9876501234',
    }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('shows the server\'s message inside the dialog when the email is taken', async () => {
    api.updateMarketingUser.mockRejectedValue({ response: { data: { error: { message: 'Another account already uses this email' } } } });
    render(<PartnerAccountCard user={partner} />);
    fireEvent.click(screen.getByRole('button', { name: /edit details/i }));
    const dialog = await screen.findByRole('dialog', { name: /edit partner details/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Another account already uses this email');
  });

  it('sets a generated password and shows the sign-in details exactly once', async () => {
    api.resetMarketingUserPassword.mockResolvedValue({ data: { success: true } });
    render(<PartnerAccountCard user={partner} />);
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));
    const dialog = await screen.findByRole('dialog', { name: /set a new password/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /generate/i }));
    const pw = within(dialog).getByLabelText('New password').value;
    expect(pw.length).toBeGreaterThanOrEqual(12);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Set password' }));

    await waitFor(() => expect(api.resetMarketingUserPassword).toHaveBeenCalledWith('p1', pw));
    const done = await screen.findByRole('dialog', { name: /new password set/i });
    expect(done.textContent).toContain(pw);
    fireEvent.click(within(done).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('resends the welcome email and reports whether it went', async () => {
    api.resendPartnerWelcome.mockResolvedValueOnce({ data: { welcomeEmailSent: true } }).mockResolvedValueOnce({ data: { welcomeEmailSent: false } });
    render(<PartnerAccountCard user={partner} />);
    fireEvent.click(screen.getByRole('button', { name: /resend welcome email/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Welcome email sent to priya@example.com'));
    fireEvent.click(screen.getByRole('button', { name: /resend welcome email/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
