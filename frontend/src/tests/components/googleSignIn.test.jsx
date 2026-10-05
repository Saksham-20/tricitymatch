/**
 * Google sign-in never creates an account on implied consent: a new Google
 * user sees the same Terms / data notice as email signup and the credential is
 * sent again only after they tick the box.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ post: vi.fn(), setUser: vi.fn(), callback: null }));

vi.mock('../../config', () => ({ google: { clientId: 'x.apps.googleusercontent.com', isConfigured: true } }));
vi.mock('../../api/axios', () => ({ default: { post: mocks.post } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ setUser: mocks.setUser }) }));
vi.mock('../../utils/googleIdentity', () => ({
  loadGoogleIdentity: () => Promise.resolve({
    accounts: { id: { initialize: ({ callback }) => { mocks.callback = callback; }, renderButton: () => {} } },
  }),
}));

import GoogleSignIn from '../../components/auth/GoogleSignIn';

const consentRequired = () => Object.assign(new Error('400'), {
  response: { status: 400, data: { error: { code: 'GOOGLE_CONSENT_REQUIRED', message: 'Please accept' } } },
});

describe('GoogleSignIn', () => {
  beforeEach(() => { mocks.post.mockReset(); mocks.setUser.mockReset(); mocks.callback = null; });

  it('signs an existing member straight in', async () => {
    const onSuccess = vi.fn();
    mocks.post.mockResolvedValue({ data: { isNewUser: false, user: { id: 'u1', role: 'user' } } });
    render(<GoogleSignIn onSuccess={onSuccess} referralCode="ABC123" />);
    await waitFor(() => expect(mocks.callback).toBeTruthy());
    await act(async () => { await mocks.callback({ credential: 'tok' }); });
    expect(mocks.post).toHaveBeenCalledWith('/auth/google', { credential: 'tok', referralCode: 'ABC123' });
    expect(onSuccess).toHaveBeenCalledWith({ id: 'u1', role: 'user' }, false);
  });

  it('asks a new member for consent, then resends the same credential with it', async () => {
    const onSuccess = vi.fn();
    mocks.post
      .mockRejectedValueOnce(consentRequired())
      .mockResolvedValueOnce({ data: { isNewUser: true, user: { id: 'u2', role: 'user', onboardingComplete: false } } });
    render(<GoogleSignIn onSuccess={onSuccess} />);
    await waitFor(() => expect(mocks.callback).toBeTruthy());
    await act(async () => { await mocks.callback({ credential: 'tok' }); });

    expect(await screen.findByText(/Create your account with Google/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(screen.getByText(/Please accept the Terms/)).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText(/This account is for finding a marriage partner/));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create my account' })); });
    expect(mocks.post).toHaveBeenLastCalledWith('/auth/google', { credential: 'tok', termsAccepted: true, marketingConsent: false });
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'u2' }), true);
  });
});
