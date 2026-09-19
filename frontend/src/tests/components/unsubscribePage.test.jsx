/**
 * Reminder-mail unsubscribe page. It confirms before it acts (mail-security
 * scanners open every link in a message, so a page that unsubscribed on load
 * would unsubscribe everyone on delivery), offers an undo, states what is NOT
 * affected, and fails with a retry rather than a dead end.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '../../api/axios';
import Unsubscribe from '../../pages/Unsubscribe';

const U = '3f0c9a52-8d6e-4b1a-9c77-2a5d1e6f4b10';
const T = 'a'.repeat(32);

const renderAt = (search) => render(
  <HelmetProvider>
    <MemoryRouter initialEntries={[`/unsubscribe${search}`]}><Unsubscribe /></MemoryRouter>
  </HelmetProvider>
);

beforeEach(() => vi.clearAllMocks());

describe('Unsubscribe page', () => {
  it('does nothing on load and says what it will and will not stop', () => {
    renderAt(`?u=${U}&t=${T}`);

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /unsubscribe from reminder emails/i })).toBeInTheDocument();
    expect(screen.getByText(/still reach you/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unsubscribe' })).toBeEnabled();
  });

  it('unsubscribes on click with the signed link, then offers Undo', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderAt(`?u=${U}&t=${T}`);

    await user.click(screen.getByRole('button', { name: 'Unsubscribe' }));

    expect(api.post).toHaveBeenCalledWith('/email/unsubscribe', { u: U, t: T });
    expect(await screen.findByRole('heading', { name: /you are unsubscribed/i })).toBeInTheDocument();

    api.post.mockResolvedValue({ data: { success: true } });
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(api.post).toHaveBeenLastCalledWith('/email/resubscribe', { u: U, t: T });
    expect(await screen.findByRole('heading', { name: /reminder emails are back on/i })).toBeInTheDocument();
  });

  it('shows the server reason and a retry that retries the same action', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { error: { message: 'This link is not valid.' } } } });
    const user = userEvent.setup();
    renderAt(`?u=${U}&t=${T}`);

    await user.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    expect(await screen.findByText('This link is not valid.')).toBeInTheDocument();

    api.post.mockResolvedValueOnce({ data: { success: true } });
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post).toHaveBeenLastCalledWith('/email/unsubscribe', { u: U, t: T });
    expect(await screen.findByRole('heading', { name: /you are unsubscribed/i })).toBeInTheDocument();
  });

  it.each([
    ['no params', ''],
    ['a malformed id', `?u=nope&t=${T}`],
    ['a truncated token', `?u=${U}&t=abc`],
  ])('with %s: an invalid-link state with a way out, and no request', (_label, search) => {
    renderAt(search);

    expect(screen.getByRole('heading', { name: /this link is not valid/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /email support/i })).toHaveAttribute('href', 'mailto:support@tricitymatch.com');
    expect(screen.queryByRole('button', { name: 'Unsubscribe' })).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
