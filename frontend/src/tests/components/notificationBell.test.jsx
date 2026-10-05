/**
 * The navbar bell used to open a panel that only said "N unread" — nothing to
 * read, nothing to tap — and "Mark all read" called PATCH, which the server
 * does not route (404 in the prod log), so the count never cleared. On a phone
 * the bell was hidden inside the menu.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const mockGet = vi.fn();
const mockPut = vi.fn(() => Promise.resolve({ data: { success: true } }));
vi.mock('../../api/axios', () => ({
  default: { get: (...a) => mockGet(...a), put: (...a) => mockPut(...a) },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));

import NotificationBell from '../../components/notifications/NotificationBell';
import { notifLink } from '../../components/notifications/notificationMeta';

const NOTES = [
  { id: 'n1', type: 'new_match', title: 'Someone liked your profile!', body: 'Asha liked your profile.', isRead: false, createdAt: new Date().toISOString() },
  { id: 'n2', type: 'system', title: 'Profile 50% complete!', body: 'Add your education.', isRead: true, createdAt: new Date().toISOString() },
];

const Where = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;

const renderBell = (count = 1, onCountChange = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <NotificationBell count={count} onCountChange={onCountChange} />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>
  );
  return onCountChange;
};

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockClear();
  mockGet.mockResolvedValue({ data: { notifications: NOTES, unreadCount: 1, pagination: { total: 2 } } });
});

describe('NotificationBell', () => {
  it('opens to the actual notifications, not just a count', async () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /navbar.notifications, 1 unread/ }));
    const panel = await screen.findByRole('dialog', { name: 'navbar.notifications' });
    expect(await within(panel).findByText('Someone liked your profile!')).toBeTruthy();
    expect(within(panel).getByText('Profile 50% complete!')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith('/notifications', { params: { page: 1, limit: 8 } });
  });

  it('tapping one marks it read and opens where it belongs', async () => {
    const onCountChange = renderBell();
    fireEvent.click(screen.getByRole('button', { name: /navbar.notifications/ }));
    fireEvent.click(await screen.findByText('Someone liked your profile!'));
    expect(mockPut).toHaveBeenCalledWith('/notifications/n1/read');
    expect(onCountChange).toHaveBeenCalledWith(0);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/matches?tab=likes'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a read notification does not call the server again', async () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /navbar.notifications/ }));
    fireEvent.click(await screen.findByText('Profile 50% complete!'));
    expect(mockPut).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/profile/edit'));
  });

  it('mark all read uses PUT (the route the server has) and clears the count', async () => {
    const onCountChange = renderBell();
    fireEvent.click(screen.getByRole('button', { name: /navbar.notifications/ }));
    await screen.findByText('Someone liked your profile!');
    fireEvent.click(screen.getByRole('button', { name: /navbar.markAllRead/ }));
    expect(mockPut).toHaveBeenCalledWith('/notifications/read-all');
    expect(onCountChange).toHaveBeenCalledWith(0);
  });

  it('shows an empty state and a retry on failure, never a blank panel', async () => {
    mockGet.mockRejectedValueOnce(new Error('offline'));
    renderBell(0);
    fireEvent.click(screen.getByRole('button', { name: 'navbar.notifications' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Someone liked your profile!')).toBeTruthy();

    mockGet.mockResolvedValue({ data: { notifications: [], unreadCount: 0, pagination: { total: 0 } } });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /navbar.notifications/ }));
    expect(await screen.findByText('navbar.allCaughtUp')).toBeTruthy();
  });
});

describe('system notices go somewhere useful', () => {
  it.each([
    ['Profile 70% complete!', '/profile/edit'],
    ['New sign-in to your account', '/settings'],
    ['Subscription updated', '/subscription'],
    ['Membership ended', '/subscription'],
    ['Refund issued', '/payment/history'],
    ['A photo was removed from your profile', '/profile/edit?section=photos'],
    ['Your photo verification needs a fresh look', '/verification'],
    ['You have a guardian invite', '/guardian'],
    ['Your account has been suspended', '/appeal'],
  ])('%s → %s', (title, to) => {
    expect(notifLink({ type: 'system', title })).toBe(to);
  });

  it('a like and a mutual match open different tabs', () => {
    expect(notifLink({ type: 'new_match', title: 'Someone liked your profile!' })).toBe('/matches?tab=likes');
    expect(notifLink({ type: 'new_match', title: "It's a Match!" })).toBe('/matches?tab=mutual');
  });
});
