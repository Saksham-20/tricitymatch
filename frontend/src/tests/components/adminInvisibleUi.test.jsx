/**
 * Admin "quiet hide": a member can be made invisible to other members from
 * their admin page, with a reason only admins see, and made visible again.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const api = vi.hoisted(() => ({
  getUser: vi.fn(), getModerationHistory: vi.fn(), updateSubscription: vi.fn(), updateVerification: vi.fn(),
  cancelSubscription: vi.fn(), refundSubscription: vi.fn(), deleteUsers: vi.fn(), updateUserStatus: vi.fn(),
  updateUserVisibility: vi.fn(), removePhoto: vi.fn(), flagPhoto: vi.fn(), getPlanOptions: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const scopes = vi.hoisted(() => ({ value: null }));

vi.mock('../../api/adminApi', () => api);
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('../../components/admin/AdminLayout', () => ({ useAdminScopes: () => scopes.value }));

import AdminUserDetail from '../../pages/admin/AdminUserDetail';

const member = (invisible = null) => ({
  data: {
    user: {
      id: 'u1', email: 'asha@example.com', role: 'user', status: 'active', invisible,
      Profile: { firstName: 'Asha', lastName: 'Verma', photos: [] },
      Verifications: [], Subscriptions: [], activeSubscription: null,
    },
    reports: [],
  },
});

const renderDetail = () => render(
  <MemoryRouter initialEntries={['/admin/users/u1']}>
    <Routes><Route path="/admin/users/:userId" element={<AdminUserDetail />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  scopes.value = null;
  api.getModerationHistory.mockResolvedValue({ data: { summary: {}, timeline: [] } });
  api.getPlanOptions.mockResolvedValue({ data: { options: [] } });
  api.updateUserVisibility.mockResolvedValue({ data: { success: true } });
});
afterEach(cleanup);

describe('Make invisible', () => {
  it('needs a reason, then hides the member', async () => {
    api.getUser.mockResolvedValue(member());
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: /make invisible/i }));
    const dialog = screen.getByRole('dialog', { name: 'Make this member invisible' });
    const confirm = within(dialog).getByRole('button', { name: 'Make invisible' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: 'test account' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.updateUserVisibility).toHaveBeenCalledWith('u1', { hidden: true, reason: 'test account' }));
  });

  it('an invisible member shows the banner and can be made visible again', async () => {
    api.getUser.mockResolvedValue(member({ since: '2026-10-05T10:00:00Z', reason: 'details being checked', byEmail: 'boss@example.com' }));
    renderDetail();
    expect(await screen.findByText(/Invisible to other members since/)).toBeInTheDocument();
    expect(screen.getByText('Reason: details being checked')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /make visible/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Make visible' }));
    await waitFor(() => expect(api.updateUserVisibility).toHaveBeenCalledWith('u1', { hidden: false, reason: '' }));
  });

  it('is not offered without the users scope', async () => {
    scopes.value = ['reports'];
    api.getUser.mockResolvedValue(member());
    renderDetail();
    await screen.findAllByText('asha@example.com');
    expect(screen.queryByRole('button', { name: /make invisible/i })).toBeNull();
  });
});
