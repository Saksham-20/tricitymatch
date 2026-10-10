/**
 * The bell and Messages badges used to poll their REST endpoints every 30 s
 * from every open tab, although each tab already holds a socket. The server now
 * pushes `unread:counts` ({ notifications?, chat? }) when a number changes; the
 * badges take it from there and poll only every 3 minutes as a safety net, plus
 * once when the tab comes back into view or the socket reconnects.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  socket: null,
  get: null,
  auth: { isAuthenticated: true, user: { firstName: 'Asha', lastName: 'K', role: 'user' }, logout: () => {} },
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../context/SocketContext', () => ({ useSocket: () => ({ socket: mocks.socket }) }));
vi.mock('../../api/axios', () => ({ default: { get: (...a) => mocks.get(...a) } }));
vi.mock('../../hooks/useDarkMode', () => ({ default: () => ({ isDark: false, toggle: () => {} }) }));
vi.mock('../../hooks/useElderMode', () => ({ default: () => ({}) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
// The bell itself has its own tests; here only the number Navbar hands it matters.
vi.mock('../../components/notifications/NotificationBell', () => ({
  default: ({ count, onCountChange }) => (
    <button type="button" data-testid="bell" onClick={() => onCountChange(0)}>{count}</button>
  ),
}));

import Navbar from '../../components/common/Navbar';
import BottomNav from '../../components/common/BottomNav';

const makeSocket = ({ connected = true } = {}) => {
  const handlers = {};
  return {
    connected,
    on: vi.fn((event, fn) => { (handlers[event] = handlers[event] || new Set()).add(fn); }),
    off: vi.fn((event, fn) => { if (handlers[event]) handlers[event].delete(fn); }),
    fire: (event, payload) => (handlers[event] ? [...handlers[event]] : []).forEach((fn) => fn(payload)),
    listeners: (event) => (handlers[event] ? handlers[event].size : 0),
  };
};

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const renderNavbar = () => render(<MemoryRouter><Navbar /></MemoryRouter>);
const renderBottomNav = () => render(<MemoryRouter><BottomNav /></MemoryRouter>);
const callsTo = (url) => mocks.get.mock.calls.filter(([u]) => u === url).length;

beforeEach(() => {
  mocks.socket = makeSocket();
  mocks.get = vi.fn(() => Promise.resolve({ data: { count: 1 } }));
  mocks.auth.isAuthenticated = true;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Navbar bell count', () => {
  it('takes the pushed notifications count', async () => {
    renderNavbar();
    await flush();
    expect(screen.getByTestId('bell').textContent).toBe('1');
    act(() => mocks.socket.fire('unread:counts', { notifications: 4 }));
    expect(screen.getByTestId('bell').textContent).toBe('4');
    act(() => mocks.socket.fire('unread:counts', { notifications: 0 }));
    expect(screen.getByTestId('bell').textContent).toBe('0');
  });

  it('ignores a push that carries only the chat count', async () => {
    renderNavbar();
    await flush();
    act(() => mocks.socket.fire('unread:counts', { chat: 7 }));
    expect(screen.getByTestId('bell').textContent).toBe('1');
  });

  it('a REST answer already in flight when a push lands does not overwrite it', async () => {
    let resolveLate;
    mocks.get = vi.fn(() => new Promise((r) => { resolveLate = r; }));
    renderNavbar();
    act(() => mocks.socket.fire('unread:counts', { notifications: 5 }));
    await act(async () => { resolveLate({ data: { count: 2 } }); await Promise.resolve(); });
    expect(screen.getByTestId('bell').textContent).toBe('5');
  });

  it('the bell can still set the count (mark read)', async () => {
    renderNavbar();
    await flush();
    fireEvent.click(screen.getByTestId('bell'));
    expect(screen.getByTestId('bell').textContent).toBe('0');
  });

  it('polls only every 3 minutes and refetches on tab focus, reconnect and tm:notifications-changed', async () => {
    vi.useFakeTimers();
    renderNavbar();
    const url = '/notifications/unread-count';
    expect(callsTo(url)).toBe(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(179999); });
    expect(callsTo(url)).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(callsTo(url)).toBe(2);

    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(callsTo(url)).toBe(3);

    act(() => mocks.socket.fire('connect'));
    expect(callsTo(url)).toBe(4);

    act(() => { window.dispatchEvent(new Event('tm:notifications-changed')); });
    expect(callsTo(url)).toBe(5);
  });

  it('the first connect of a socket that was not yet connected does not double-fetch', () => {
    mocks.socket = makeSocket({ connected: false });
    renderNavbar();
    expect(callsTo('/notifications/unread-count')).toBe(1);
    act(() => mocks.socket.fire('connect'));
    expect(callsTo('/notifications/unread-count')).toBe(1);
    act(() => mocks.socket.fire('connect')); // a real reconnect
    expect(callsTo('/notifications/unread-count')).toBe(2);
  });

  it('removes its socket listeners on unmount and does not poll signed out', () => {
    const { unmount } = renderNavbar();
    expect(mocks.socket.listeners('unread:counts')).toBe(1);
    unmount();
    expect(mocks.socket.listeners('unread:counts')).toBe(0);
    expect(mocks.socket.listeners('connect')).toBe(0);

    mocks.get.mockClear();
    mocks.auth.isAuthenticated = false;
    renderNavbar();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.socket.listeners('unread:counts')).toBe(0);
  });
});

describe('BottomNav Messages badge', () => {
  it('takes the pushed chat count', async () => {
    mocks.get = vi.fn(() => Promise.resolve({ data: { count: 0 } }));
    renderBottomNav();
    await flush();
    expect(screen.queryByText('3')).toBeNull();
    act(() => mocks.socket.fire('unread:counts', { chat: 3 }));
    expect(screen.getByText('3')).toBeTruthy();
    act(() => mocks.socket.fire('unread:counts', { notifications: 8 }));
    expect(screen.getByText('3')).toBeTruthy();
    act(() => mocks.socket.fire('unread:counts', { chat: 12 }));
    expect(screen.getByText('9+')).toBeTruthy();
    act(() => mocks.socket.fire('unread:counts', { chat: 0 }));
    expect(screen.queryByText('9+')).toBeNull();
  });

  it('polls only every 3 minutes and refetches on tab focus, reconnect and tm:chat-read', async () => {
    vi.useFakeTimers();
    renderBottomNav();
    const url = '/chat/unread-count';
    expect(callsTo(url)).toBe(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(179999); });
    expect(callsTo(url)).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(callsTo(url)).toBe(2);

    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(callsTo(url)).toBe(3);

    act(() => mocks.socket.fire('connect'));
    expect(callsTo(url)).toBe(4);

    act(() => { window.dispatchEvent(new Event('tm:chat-read')); });
    expect(callsTo(url)).toBe(5);
  });

  it('removes its socket listeners on unmount', () => {
    const { unmount } = renderBottomNav();
    expect(mocks.socket.listeners('unread:counts')).toBe(1);
    unmount();
    expect(mocks.socket.listeners('unread:counts')).toBe(0);
    expect(mocks.socket.listeners('connect')).toBe(0);
  });
});
