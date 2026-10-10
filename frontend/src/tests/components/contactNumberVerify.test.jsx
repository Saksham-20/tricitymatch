/**
 * APP-03: choosing the sign-in number again showed "Number verified" but never
 * told the server, so the old separate contact number stayed saved and kept
 * being handed out on contact unlock.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../api/axios', () => ({ default: { post: vi.fn() } }));

import api from '../../api/axios';
import ContactNumberVerify from '../../components/common/ContactNumberVerify';

beforeEach(() => { vi.clearAllMocks(); });

describe('ContactNumberVerify (account flow)', () => {
  it('saves an already-verified number before reporting it verified', async () => {
    api.post.mockImplementation((url) => (url === '/auth/contact-number/request'
      ? Promise.resolve({ data: { success: true, alreadyVerified: true, phone: '9000001005' } })
      : Promise.resolve({ data: { success: true, isLoginNumber: true, contactPhone: null } })));
    const onVerified = vi.fn();
    render(<ContactNumberVerify flow="account" value="9000001005" onVerified={onVerified} />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => expect(onVerified).toHaveBeenCalledWith('9000001005'));
    expect(api.post.mock.calls.map(([url, body]) => [url, body])).toEqual([
      ['/auth/contact-number/request', { phone: '9000001005' }],
      ['/auth/contact-number/verify', { phone: '9000001005' }],
    ]);
  });

  it('does not report the number verified when saving it fails', async () => {
    api.post.mockImplementation((url) => (url === '/auth/contact-number/request'
      ? Promise.resolve({ data: { success: true, alreadyVerified: true } })
      : Promise.reject({ response: { data: { error: { message: 'Could not save that number.' } } } })));
    const onVerified = vi.fn();
    render(<ContactNumberVerify flow="account" value="9000001005" onVerified={onVerified} />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that number.');
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('a new number still asks for the SMS code', async () => {
    api.post.mockResolvedValue({ data: { success: true, alreadyVerified: false } });
    const onVerified = vi.fn();
    render(<ContactNumberVerify flow="account" value="9000001055" onVerified={onVerified} />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    expect(await screen.findByText(/Enter the 4-digit code/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(onVerified).not.toHaveBeenCalled();
  });
});
