/**
 * MATCH-08: "Load more" was gated on a field the API never sends, so members
 * only ever saw their newest 20, and the unread badge counted loaded rows only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const get = vi.fn();
vi.mock('../../api/axios', () => ({ default: { get: (...a) => get(...a), put: vi.fn(), delete: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() }, toast: { error: vi.fn(), success: vi.fn() } }));

import Notifications from '../../pages/Notifications';

const row = (i, isRead = false) => ({ id: `n${i}`, type: 'system', title: `Title ${i}`, body: '', isRead, createdAt: new Date().toISOString() });
const page = (from, n) => Array.from({ length: n }, (_, i) => row(from + i));

describe('Notifications paging', () => {
  beforeEach(() => get.mockReset());

  it('offers Load more using pagination.pages, fetches page 2, and shows the server unread count', async () => {
    get
      .mockResolvedValueOnce({ data: { notifications: page(0, 20), unreadCount: 25, pagination: { page: 1, limit: 20, total: 25, pages: 2 } } })
      .mockResolvedValueOnce({ data: { notifications: page(20, 5), unreadCount: 25, pagination: { page: 2, limit: 20, total: 25, pages: 2 } } });
    render(<MemoryRouter><Notifications /></MemoryRouter>);

    await screen.findByText('Title 0');
    expect(screen.getByText('25')).toBeTruthy(); // server count, not the 20 loaded
    const more = await screen.findByRole('button', { name: /load more/i });
    await userEvent.click(more);

    await screen.findByText('Title 24');
    expect(get).toHaveBeenLastCalledWith('/notifications', { params: { page: 2, limit: 20 } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /load more/i })).toBeNull());
  });
});
