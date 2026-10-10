/**
 * Matches → Saved. The shortlist endpoint does not say the rows are saved, so
 * the cards on this tab used to start with an empty bookmark and a tap saved
 * the profile AGAIN instead of taking it off the list.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', role: 'user', Profile: { firstName: 'Ravi' } } }),
}));

import api from '../../api/axios';
import toast from 'react-hot-toast';
import Matches from '../../pages/Matches';

const saved = { userId: 'u9', firstName: 'Asha', lastName: 'Verma', city: 'Mohali', dateOfBirth: '1996-04-12' };

const renderSaved = () => render(
  <MemoryRouter initialEntries={['/matches']}>
    <Matches />
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => Promise.resolve(
    url === '/match/shortlist' ? { data: { shortlisted: [saved] } } : { data: {} }
  ));
  api.post.mockResolvedValue({ data: { success: true, removed: true } });
});

describe('Matches → Saved tab', () => {
  it('shows a saved profile as saved', async () => {
    renderSaved();
    const bookmark = await screen.findByRole('button', { name: /remove from shortlist/i });
    expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  });

  it('a tap on the bookmark takes the profile off the list (undo), not a second save', async () => {
    renderSaved();
    fireEvent.click(await screen.findByRole('button', { name: /remove from shortlist/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/match/u9', { action: 'undo' }));
    expect(api.post).not.toHaveBeenCalledWith('/match/u9', { action: 'shortlist' });
    await waitFor(() => expect(screen.queryByText('Asha Verma')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('keeps the card, still saved, when the server refuses', async () => {
    api.post.mockRejectedValueOnce(new Error('offline'));
    renderSaved();
    fireEvent.click(await screen.findByRole('button', { name: /remove from shortlist/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const bookmark = await screen.findByRole('button', { name: /remove from shortlist/i });
    expect(bookmark).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Asha Verma')).toBeInTheDocument();
  });
});

describe('Matches → Likes you tab', () => {
  it('the interest button on someone who already liked you says "Like back"', async () => {
    const liker = { ...saved, userId: 'u7', firstName: 'Neha', lastName: 'Sharma' };
    api.get.mockImplementation((url) => Promise.resolve(
      url === '/match/likes' ? { data: { likes: [liker] } } : { data: {} }
    ));
    render(
      <MemoryRouter initialEntries={['/matches?tab=likes']}>
        <Matches />
      </MemoryRouter>
    );
    expect(await screen.findByRole('button', { name: 'Like back' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Express Interest' })).not.toBeInTheDocument();
  });
});
