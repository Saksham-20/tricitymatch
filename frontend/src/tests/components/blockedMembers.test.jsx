import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getBlockedMembers: vi.fn(),
  unblockMember: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../api/safety', () => ({
  getBlockedMembers: mocks.getBlockedMembers,
  unblockMember: mocks.unblockMember,
}));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.toastSuccess, error: mocks.toastError } }));

import BlockedMembers from '../../components/safety/BlockedMembers';

const block = (id, firstName, city) => ({
  id: `b-${id}`,
  blockedUserId: id,
  BlockedUser: { id, Profile: { firstName, lastName: 'Sharma', city } },
});

beforeEach(() => vi.clearAllMocks());

describe('BlockedMembers', () => {
  it('lists blocked members with an Unblock action', async () => {
    mocks.getBlockedMembers.mockResolvedValue([block('u1', 'Asha', 'Mohali')]);
    render(<BlockedMembers />);
    expect(await screen.findByText('Asha Sharma')).toBeInTheDocument();
    expect(screen.getByText('Mohali')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unblock/i })).toBeInTheDocument();
  });

  it('says so when nobody is blocked (not an error)', async () => {
    mocks.getBlockedMembers.mockResolvedValue([]);
    render(<BlockedMembers />);
    expect(await screen.findByText(/haven.t blocked anyone/i)).toBeInTheDocument();
  });

  it('shows a retryable error, distinct from empty, when loading fails', async () => {
    mocks.getBlockedMembers.mockRejectedValueOnce(new Error('down'));
    render(<BlockedMembers />);
    expect(await screen.findByText(/couldn.t load blocked members/i)).toBeInTheDocument();
    expect(screen.queryByText(/haven.t blocked anyone/i)).not.toBeInTheDocument();

    mocks.getBlockedMembers.mockResolvedValueOnce([block('u1', 'Asha', 'Mohali')]);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Asha Sharma')).toBeInTheDocument();
  });

  it('unblocks and removes the row', async () => {
    mocks.getBlockedMembers.mockResolvedValue([block('u1', 'Asha', 'Mohali'), block('u2', 'Meera', 'Panchkula')]);
    mocks.unblockMember.mockResolvedValue({});
    render(<BlockedMembers />);
    await screen.findByText('Asha Sharma');
    fireEvent.click(screen.getAllByRole('button', { name: /unblock/i })[0]);
    await waitFor(() => expect(mocks.unblockMember).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(screen.queryByText('Asha Sharma')).not.toBeInTheDocument());
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('keeps the row and reports failure when unblocking fails', async () => {
    mocks.getBlockedMembers.mockResolvedValue([block('u1', 'Asha', 'Mohali')]);
    mocks.unblockMember.mockRejectedValue(new Error('nope'));
    render(<BlockedMembers />);
    await screen.findByText('Asha Sharma');
    fireEvent.click(screen.getByRole('button', { name: /unblock/i }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(screen.getByText('Asha Sharma')).toBeInTheDocument();
  });
});
