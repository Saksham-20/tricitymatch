/**
 * Settings → Privacy: "Hide my photos until we match".
 *
 * The Privacy Policy, Help and the dashboard photo nudge all point members to
 * this control, and the server already enforces it (photos are withheld from
 * anyone who is not a mutual match). The switch was missing, so nobody could
 * turn it on. It must hydrate from the server and save through the same
 * privacy endpoint as the other switches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../api/axios', () => ({ default: { get: mocks.get, put: mocks.put } }));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock('../../api/safety', () => ({ getBlockedMembers: vi.fn(async () => []), unblockMember: vi.fn() }));

import { PrivacyTab } from '../../pages/Settings';

const serverProfile = (overrides = {}) => ({
  data: {
    profile: {
      profileVisibility: 'everyone',
      showOnlineStatus: true,
      showLastSeen: true,
      incognitoMode: false,
      photoBlurUntilMatch: false,
      fieldVisibility: {},
      ...overrides,
    },
  },
});

beforeEach(() => vi.clearAllMocks());

describe('PrivacyTab photo hiding', () => {
  it('shows the switch off by default and saves it on', async () => {
    mocks.get.mockResolvedValue(serverProfile());
    mocks.put.mockResolvedValue({ data: { success: true } });
    render(<PrivacyTab />);

    const toggle = await screen.findByRole('switch', { name: /hide my photos until we match/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/see your initials instead of your photos/i)).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith(
      '/profile/privacy',
      expect.objectContaining({ photoBlurUntilMatch: true }),
    ));
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('hydrates an existing choice from the server', async () => {
    mocks.get.mockResolvedValue(serverProfile({ photoBlurUntilMatch: true }));
    render(<PrivacyTab />);
    const toggle = await screen.findByRole('switch', { name: /hide my photos until we match/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('reports a failed save instead of pretending it worked', async () => {
    mocks.get.mockResolvedValue(serverProfile());
    mocks.put.mockRejectedValue({ response: { data: { message: 'Could not save' } } });
    render(<PrivacyTab />);

    fireEvent.click(await screen.findByRole('switch', { name: /hide my photos until we match/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Could not save'));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
