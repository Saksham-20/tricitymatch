/**
 * Invite surfaces (Phase S) — the SEND control and the city landing template.
 *
 * The invite is the only supply lever in the product that a member can pull, so
 * its failure modes matter more than its happy path: a link that silently fails
 * to load, or a signup page that hard-fails on a forged token, costs a real
 * introduction.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '../../api/axios';
import InviteLink from '../../components/common/InviteLink';
import CityMatrimony from '../../pages/CityMatrimony';
import { resolveInvite } from '../../api/invite';
import { __resetFoundingCache } from '../../hooks/useFoundingWindow';

const INVITE = { token: 'a3f48dce50486e62ac23200feb3ab48e', url: 'https://tricitymatch.com/signup?invite=a3f48dce50486e62ac23200feb3ab48e' };

beforeEach(() => {
  vi.clearAllMocks();
  __resetFoundingCache();
});

describe('InviteLink (send)', () => {
  it('shows the member their link and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });
    api.get.mockResolvedValue({ data: { invite: INVITE } });

    render(<InviteLink variant="card" />);
    await waitFor(() => expect(screen.getByLabelText(/your invite link/i)).toHaveValue(INVITE.url));

    await userEvent.click(screen.getByRole('button', { name: /copy invite link/i }));
    expect(writeText).toHaveBeenCalledWith(INVITE.url);
    await waitFor(() => expect(screen.getByRole('button', { name: /link copied/i })).toBeInTheDocument());
  });

  it('offers a retry instead of an empty box when the link cannot be loaded', async () => {
    api.get.mockRejectedValueOnce(new Error('boom'));
    render(<InviteLink variant="card" />);

    await waitFor(() => expect(screen.getByText(/could not load your invite link/i)).toBeInTheDocument());

    api.get.mockResolvedValue({ data: { invite: INVITE } });
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByLabelText(/your invite link/i)).toHaveValue(INVITE.url));
  });

  it('inline variant mints nothing until it is actually clicked', async () => {
    api.get.mockResolvedValue({ data: { invite: INVITE } });
    render(<InviteLink variant="inline" />);
    expect(api.get).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /invite someone you know/i }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/invite/my-link'));
  });
});

describe('resolveInvite (receive)', () => {
  it('returns the inviter first name on a valid token', async () => {
    api.get.mockResolvedValue({ data: { invite: { firstName: 'Simran' } } });
    await expect(resolveInvite(INVITE.token)).resolves.toEqual({ firstName: 'Simran' });
  });

  it('resolves to null — never throws — on an unknown or rate-limited token', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('nope'), { response: { status: 404 } }));
    await expect(resolveInvite('deadbeef')).resolves.toBeNull();

    api.get.mockRejectedValue(Object.assign(new Error('slow down'), { response: { status: 429 } }));
    await expect(resolveInvite('deadbeef')).resolves.toBeNull();
  });

  it('does not call the API at all without a token', async () => {
    await expect(resolveInvite('')).resolves.toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });
});

const renderCity = (slug) => render(
  <HelmetProvider>
    <MemoryRouter initialEntries={[`/matrimony/${slug}`]}>
      <Routes>
        <Route path="/matrimony/:city" element={<CityMatrimony />} />
        <Route path="/" element={<div data-testid="home" />} />
      </Routes>
    </MemoryRouter>
  </HelmetProvider>
);

describe('City landing pages', () => {
  it('renders the city-specific H1 and locality copy', async () => {
    api.get.mockResolvedValue({ data: { founding: { open: false } } });
    renderCity('mohali');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/matrimony in mohali/i);
    expect(screen.getByText(/what matchmaking in mohali actually looks like/i)).toBeInTheDocument();
  });

  // "Join free" is true in every state — signing up costs nothing. The claim
  // under gate is the free PREMIUM PERIOD, which only exists once the server
  // says the window is open and `grantFoundingIfOpen` actually issues it.
  it('never claims a free membership period while the founding window is closed', async () => {
    api.get.mockResolvedValue({ data: { founding: { open: false } } });
    renderCity('chandigarh');
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByText(/membership is free until/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/while the founding period is open/i)).not.toBeInTheDocument();
  });

  it('makes the membership claim once the server confirms the window is open', async () => {
    api.get.mockResolvedValue({ data: { founding: { open: true, endsAt: '2026-12-31', contactUnlocks: 5 } } });
    renderCity('chandigarh');
    await waitFor(() => expect(screen.getByText(/membership is free until the period ends/i)).toBeInTheDocument());
  });

  it('redirects an unknown city slug home instead of rendering a blank shell', () => {
    api.get.mockResolvedValue({ data: { founding: { open: false } } });
    renderCity('ludhiana');
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });
});
