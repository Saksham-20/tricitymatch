import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';

// A tab opened before the Terms changed holds a user without
// `requiresReconsent`, so no accept screen shows while the server refuses
// every action. A refusal must make the app re-read the user.

describe('updated Terms on an already-open tab', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('the API client announces a TERMS_RECONSENT_REQUIRED refusal', async () => {
    vi.doUnmock('../../api/axios');
    const { default: api } = await import('../../api/axios');
    const reject = api.interceptors.response.handlers.find((h) => h && h.rejected).rejected;
    const heard = vi.fn();
    window.addEventListener('tm:reconsent-required', heard);
    try {
      const refused = { config: { url: '/profile/me' }, response: { status: 403, data: { success: false, error: { code: 'TERMS_RECONSENT_REQUIRED', message: 'Please review and accept the updated Terms to continue' } } } };
      await expect(reject(refused)).rejects.toBe(refused);
      expect(heard).toHaveBeenCalledTimes(1);

      const otherForbidden = { config: { url: '/chat/conversations' }, response: { status: 403, data: { success: false, error: { code: 'PREMIUM_REQUIRED', message: 'Upgrade' } } } };
      await expect(reject(otherForbidden)).rejects.toBe(otherForbidden);
      expect(heard).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('tm:reconsent-required', heard);
    }
  });

  it('the auth context re-reads the user, so the accept screen can show', async () => {
    const get = vi.fn()
      // First load: signed in, Terms fine at the time.
      .mockResolvedValueOnce({ data: { user: { id: 'u1', role: 'user', requiresReconsent: false } } })
      // After the refusal: the server now says the member must accept.
      .mockResolvedValue({ data: { user: { id: 'u1', role: 'user', requiresReconsent: true } } });
    vi.doMock('../../api/axios', () => ({ default: { get, post: vi.fn() } }));
    vi.doUnmock('../../context/AuthContext');
    // A protected page makes the app check the session on load.
    window.history.pushState({}, '', '/dashboard');
    const { AuthProvider, useAuth } = await import('../../context/AuthContext');
    const Probe = () => {
      const { user } = useAuth();
      return <span>{user ? (user.requiresReconsent ? 'MUST-ACCEPT' : 'OK') : 'NONE'}</span>;
    };
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('OK')).toBeInTheDocument());

    await act(async () => { window.dispatchEvent(new Event('tm:reconsent-required')); });
    await waitFor(() => expect(screen.getByText('MUST-ACCEPT')).toBeInTheDocument());
    expect(get).toHaveBeenLastCalledWith('/auth/me');
  });
});
