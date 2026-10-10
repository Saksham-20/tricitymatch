/**
 * Public support pages: the appeal form takes a mobile number as well as an
 * email (members who joined by phone have no email), Success Stories says
 * plainly when nothing is published yet, and the 404 page carries no
 * canonical address.
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
import Appeal from '../../pages/Appeal';
import SuccessStories from '../../pages/SuccessStories';
import Seo from '../../components/common/Seo';

const renderPage = (page) => render(
  <HelmetProvider>
    <MemoryRouter>{page}</MemoryRouter>
  </HelmetProvider>
);

const STATEMENT = 'I was suspended by mistake. Please look at my account again.';

beforeEach(() => vi.clearAllMocks());

describe('Appeal form', () => {
  const fill = async (user, identifier) => {
    await user.type(screen.getByLabelText(/account email or mobile number/i), identifier);
    await user.type(screen.getByLabelText(/what happened/i), STATEMENT);
    await user.click(screen.getByRole('button', { name: /send appeal/i }));
  };

  it('sends a mobile number typed with +91 and spaces as ten digits', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderPage(<Appeal />);

    await fill(user, '+91 98765 43210');

    expect(api.post).toHaveBeenCalledWith('/appeals', { phone: '9876543210', statement: STATEMENT });
    expect(await screen.findByRole('status')).toHaveTextContent(/email or mobile number/i);
  });

  it('still sends an email address', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderPage(<Appeal />);

    await fill(user, 'member@example.com');

    expect(api.post).toHaveBeenCalledWith('/appeals', { email: 'member@example.com', statement: STATEMENT });
  });

  it('asks again for a number that cannot be a mobile, and sends nothing', async () => {
    const user = userEvent.setup();
    renderPage(<Appeal />);

    await fill(user, '12345');

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/10-digit mobile number/i);
    expect(screen.getByLabelText(/account email or mobile number/i)).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Success Stories', () => {
  it('says plainly that no stories are published yet, with no claim about couples', async () => {
    api.get.mockResolvedValue({ data: { stories: [] } });
    renderPage(<SuccessStories />);

    expect(await screen.findByText('No stories yet')).toBeInTheDocument();
    expect(screen.getByText(/first stories are still being written/i)).toBeInTheDocument();
    expect(screen.queryByText(/found their forever/i)).toBeNull();
    expect(screen.queryByText(/stories coming soon/i)).toBeNull();
  });

  it('shows a published story with its year', async () => {
    api.get.mockResolvedValue({
      data: { stories: [{ id: 's1', coupleNames: 'Aman & Simran', quote: 'We met here.', location: 'Mohali', marriedOn: '2027-02-14' }] },
    });
    renderPage(<SuccessStories />);

    expect(await screen.findByText('Aman & Simran')).toBeInTheDocument();
    expect(screen.getByText('Mohali · Married 2027')).toBeInTheDocument();
  });
});

describe('Seo', () => {
  const head = () => ({
    canonical: document.head.querySelector('link[rel="canonical"]'),
    ogUrl: document.head.querySelector('meta[property="og:url"]'),
  });

  it('gives a page its canonical address and og:url', async () => {
    render(<HelmetProvider><Seo title="About us" path="/about/" /></HelmetProvider>);

    await waitFor(() => expect(document.title).toBe('About us | TricityMatch'));
    expect(head().canonical).toHaveAttribute('href', 'https://tricitymatch.com/about');
    expect(head().ogUrl).toHaveAttribute('content', 'https://tricitymatch.com/about');
  });

  it('leaves both out when told the page has no address of its own', async () => {
    render(<HelmetProvider><Seo title="Page Not Found" noindex canonical={false} /></HelmetProvider>);

    await waitFor(() => expect(document.title).toBe('Page Not Found | TricityMatch'));
    expect(head().canonical).toBeNull();
    expect(head().ogUrl).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });
});
