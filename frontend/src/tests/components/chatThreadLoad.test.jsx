/**
 * The open thread must load whether or not the socket is connected, and
 * tapping the conversation that is already open must not blank it (it used to
 * reset to the loading skeleton and never reload — found on prod 2026-10-05).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ get: vi.fn(), socket: null }));

vi.mock('../../api/axios', () => ({ default: { get: mocks.get, post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../context/SocketContext', () => ({ useSocket: () => ({ socket: mocks.socket }) }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', subscriptionPlan: 'premium_plus', features: {} } }),
}));

import Chat from '../../pages/Chat';

const THEM = 'them-1';
const conversations = [{ userId: THEM, user: { name: 'Asha Verma' }, lastMessage: { content: 'Hello there' }, unreadCount: 0 }];
const messages = [{ id: 'm1', senderId: THEM, receiverId: 'me', content: 'Hello there', createdAt: new Date().toISOString() }];

describe('Chat thread loading', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mocks.get.mockReset();
    mocks.get.mockImplementation(async (url) => {
      if (url === '/chat/conversations') return { data: { conversations } };
      if (url === `/chat/messages/${THEM}`) return { data: { messages, chatAccess: { reason: 'paid' } } };
      return { data: {} };
    });
  });

  it('loads the thread with no socket connected', async () => {
    mocks.socket = null;
    render(<MemoryRouter><Chat /></MemoryRouter>);
    expect(await screen.findAllByText('Hello there')).not.toHaveLength(0);
    expect(mocks.get).toHaveBeenCalledWith(`/chat/messages/${THEM}`);
  });

  it('tapping the open conversation keeps the thread on screen', async () => {
    mocks.socket = null;
    render(<MemoryRouter><Chat /></MemoryRouter>);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(`/chat/messages/${THEM}`));
    const before = (await screen.findAllByText('Hello there')).length;
    fireEvent.click(screen.getAllByRole('button', { name: /Asha Verma/ })[0]);
    expect(screen.getAllByText('Hello there')).toHaveLength(before);
  });
});
