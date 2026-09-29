/**
 * Guardian invites + profile hand-over (audit P1-14).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../components/common/Seo', () => ({ default: () => null }));
vi.mock('../../components/common/Logo', () => ({ default: () => <span>logo</span> }));

import api from '../../api/axios';
import Guardian from '../../pages/Guardian';
import HandOver from '../../pages/HandOver';

const mockLoad = ({ guardians = [], candidates = [], invites = [] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/guardian/my-guardians') return Promise.resolve({ data: { guardians } });
    if (url === '/guardian/my-candidates') return Promise.resolve({ data: { candidates } });
    if (url === '/guardian/pending-invites') return Promise.resolve({ data: { invites } });
    return Promise.reject(new Error(`unmocked ${url}`));
  });
};

beforeEach(() => { vi.clearAllMocks(); });

describe('Guardian page', () => {
  it('shows invites addressed to me and lets me accept one', async () => {
    mockLoad({ invites: [{ linkId: 'L1', candidateName: 'Asha Verma', expiresAt: '2030-01-10T00:00:00Z' }] });
    api.post.mockResolvedValue({ data: { success: true } });
    render(<MemoryRouter><Guardian /></MemoryRouter>);

    expect(await screen.findByText('Asha Verma')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/guardian/L1/accept'));
  });

  it('can decline an invite', async () => {
    mockLoad({ invites: [{ linkId: 'L2', candidateName: 'Ravi', expiresAt: '2030-01-10T00:00:00Z' }] });
    api.post.mockResolvedValue({ data: { success: true } });
    render(<MemoryRouter><Guardian /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /decline/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/guardian/L2/decline'));
  });

  it('labels a waiting invite as waiting, not as a guardian', async () => {
    mockLoad({ guardians: [{ linkId: 'G1', email: 'aunt@example.com', status: 'pending', expiresAt: '2030-01-10T00:00:00Z' }] });
    render(<MemoryRouter><Guardian /></MemoryRouter>);
    expect(await screen.findByText(/Waiting for their reply/)).toBeInTheDocument();
  });

  it('resolves the emailed token link once and drops it from the URL', async () => {
    mockLoad();
    api.post.mockResolvedValue({ data: { success: true } });
    render(<MemoryRouter initialEntries={['/guardian?invite=abc123']}><Guardian /></MemoryRouter>);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/guardian/resolve-invite/abc123'));
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});

describe('HandOver page', () => {
  it('says the link is invalid when there is no token', () => {
    render(<MemoryRouter initialEntries={['/handover']}><HandOver /></MemoryRouter>);
    expect(screen.getByText('Invalid link')).toBeInTheDocument();
  });

  it('refuses a weak or mismatched password before calling the server', async () => {
    render(<MemoryRouter initialEntries={['/handover?token=t'.padEnd(40, 'x')]}><HandOver /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('button', { name: /take over/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/8\+ characters/);

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Own3r!Pass-2026' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different!Pass-1' } });
    fireEvent.click(screen.getByRole('button', { name: /take over/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('sends the token and new password, then points to sign-in', async () => {
    const token = 'k'.repeat(64);
    api.post.mockResolvedValue({ data: { success: true } });
    render(<MemoryRouter initialEntries={[`/handover?token=${token}`]}><HandOver /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Own3r!Pass-2026' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Own3r!Pass-2026' } });
    fireEvent.click(screen.getByRole('button', { name: /take over/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/guardian/handover/complete', { token, password: 'Own3r!Pass-2026' }));
    expect(await screen.findByText('Your profile is yours')).toBeInTheDocument();
  });

  it('shows the server reason when the link was already used', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'This hand-over link is invalid or has already been used.' } } });
    render(<MemoryRouter initialEntries={[`/handover?token=${'z'.repeat(64)}`]}><HandOver /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Own3r!Pass-2026' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Own3r!Pass-2026' } });
    fireEvent.click(screen.getByRole('button', { name: /take over/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already been used/);
  });
});
