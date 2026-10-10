/**
 * A free member who opens Chat sees the Premium paywall. While the free-reply
 * window is switched on, the paywall also says they can answer a Premium match
 * who writes first, so they are not told chat is closed to them when it is not.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ get: vi.fn(), features: {} }));

vi.mock('../../api/axios', () => ({ default: { get: mocks.get, post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../context/SocketContext', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', subscriptionPlan: 'free', features: mocks.features } }),
}));

import Chat from '../../pages/Chat';

const premiumRequired = { response: { status: 403, data: { error: { code: 'PREMIUM_REQUIRED', message: 'Premium subscription required' } } } };

describe('Chat paywall for a free member', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mocks.get.mockReset();
    mocks.get.mockImplementation(async (url) => {
      if (url === '/chat/conversations') throw premiumRequired;
      return { data: {} };
    });
  });

  it('mentions free replies while the free-reply window is on', async () => {
    mocks.features = { freeReplyWindow: true };
    render(<MemoryRouter><Chat /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /chat is a premium feature/i })).toBeInTheDocument();
    expect(screen.getByText(/you can reply for free/i)).toBeInTheDocument();
  });

  it('says nothing about free replies when the window is off', async () => {
    mocks.features = { freeReplyWindow: false };
    render(<MemoryRouter><Chat /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /chat is a premium feature/i })).toBeInTheDocument();
    expect(screen.queryByText(/you can reply for free/i)).toBeNull();
  });
});
