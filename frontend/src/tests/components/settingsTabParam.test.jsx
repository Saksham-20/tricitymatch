/**
 * Settings tabs follow the address: copy that says "Settings → Privacy" can
 * link to /settings?tab=privacy, and switching tabs keeps the address in step.
 * Also: the Notifications tab lists message emails, which members had no way
 * to turn off.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const auth = vi.hoisted(() => ({ user: { id: 'me', role: 'user', Profile: { firstName: 'Ravi' } } }));

vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../api/safety', () => ({ getBlockedMembers: vi.fn(async () => []), unblockMember: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, logout: vi.fn(), updateUser: vi.fn() }),
}));

import api from '../../api/axios';
import Settings from '../../pages/Settings';

const Where = () => {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
};

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Settings />
    <Where />
  </MemoryRouter>
);

const PREFS = { matches: true, interests: true, messages: true, profileViews: true, promotions: false };

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'me', role: 'user', Profile: { firstName: 'Ravi' } };
  api.get.mockImplementation((url) => {
    if (url === '/profile/me') {
      return Promise.resolve({ data: { profile: { profileVisibility: 'everyone', showOnlineStatus: true, showLastSeen: true, fieldVisibility: {} } } });
    }
    if (url === '/notifications/preferences') return Promise.resolve({ data: { preferences: PREFS } });
    return Promise.resolve({ data: {} });
  });
  api.put.mockResolvedValue({ data: { success: true } });
});

const navButton = (name) => screen.getAllByRole('button').find((b) => b.textContent.startsWith(name));

describe('Settings ?tab=', () => {
  it('?tab=privacy opens the Privacy tab', async () => {
    renderAt('/settings?tab=privacy');
    expect(await screen.findByRole('switch', { name: /hide my photos until we match/i })).toBeInTheDocument();
    expect(navButton('Privacy')).toHaveAttribute('aria-current', 'page');
  });

  it('switching tabs puts the tab in the address', async () => {
    renderAt('/settings?tab=privacy');
    await screen.findByRole('switch', { name: /hide my photos until we match/i });
    fireEvent.click(navButton('Notifications'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/settings?tab=notifications'));
    expect(navButton('Notifications')).toHaveAttribute('aria-current', 'page');
  });

  it('ignores a tab that does not exist', async () => {
    renderAt('/settings?tab=billing');
    await waitFor(() => expect(navButton('Account')).toHaveAttribute('aria-current', 'page'));
  });

  it('a staff account only has Account, whatever the address asks for', async () => {
    auth.user = { id: 'staff', role: 'admin' };
    renderAt('/settings?tab=privacy');
    expect(screen.queryByRole('switch', { name: /hide my photos until we match/i })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/profile/me');
  });
});

describe('Settings → Notifications', () => {
  it('lists message emails and saves the choice', async () => {
    renderAt('/settings?tab=notifications');
    const messages = await screen.findByRole('switch', { name: 'Messages' });
    expect(messages).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(messages);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/notifications/preferences', { messages: false }));
    expect(messages).toHaveAttribute('aria-checked', 'false');
  });
});
