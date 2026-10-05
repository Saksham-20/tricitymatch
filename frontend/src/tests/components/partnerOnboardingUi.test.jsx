/**
 * Marketing-partner onboarding surfaces: the live checklist, the guide's
 * acceptance, the Outreach Kit messages and the admin's create-and-share flow.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../../api/apiClient', () => ({ default: { get: mocks.get, post: mocks.post, put: mocks.put } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/admin/AdminLayout', () => ({ useAdminScopes: () => null }));
vi.mock('../../utils/copyText', () => ({ default: vi.fn(async () => true) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { firstName: 'Priya' } }) }));

import PartnerChecklist from '../../components/marketing/PartnerChecklist';
import MarketingGuide from '../../pages/marketing/MarketingGuide';
import AdminMarketingUsers from '../../pages/admin/AdminMarketingUsers';
import { messageTemplates } from '../../data/partnerMessages';
import copyText from '../../utils/copyText';

const onboarding = (steps = {}, extra = {}) => {
  const full = { agreement: false, payout: false, code: false, outreach: false, ...steps };
  const completed = Object.values(full).filter(Boolean).length;
  return {
    guideVersion: '2026-10-05', agreementAcceptedAt: full.agreement ? '2026-10-06T08:00:00.000Z' : null,
    needsReacceptance: false, steps: full, completed, total: 4, complete: completed === 4, ...extra,
  };
};

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('PartnerChecklist', () => {
  it('renders nothing before the status loads and once everything is done', () => {
    const { container, rerender } = render(<MemoryRouter><PartnerChecklist onboarding={null} /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
    rerender(<MemoryRouter><PartnerChecklist onboarding={onboarding({ agreement: true, payout: true, code: true, outreach: true })} /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
  });

  it('points at the first step that is not done, and only that one', () => {
    render(<MemoryRouter><PartnerChecklist onboarding={onboarding()} /></MemoryRouter>);
    expect(screen.getByText('0 of 4 done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open the guide/i })).toHaveAttribute('href', '/marketing/guide');
    // Later steps are visible but carry no button yet.
    expect(screen.queryByRole('link', { name: /get my code/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /add details/i })).toBeNull();
  });

  it('moves the action forward as steps complete and reports progress accessibly', () => {
    render(<MemoryRouter><PartnerChecklist onboarding={onboarding({ agreement: true })} /></MemoryRouter>);
    expect(screen.getByRole('progressbar', { name: /setup progress/i })).toHaveAttribute('aria-valuenow', '1');
    const add = screen.getByRole('link', { name: /add details/i });
    expect(add).toHaveAttribute('href', '#payout-details');
    expect(screen.getByText(/Read and accept the Partner Guide/).closest('li')).toHaveAttribute('data-done', 'true');
  });
});

describe('messageTemplates', () => {
  const texts = (phase) => messageTemplates({ me: 'Priya', link: 'https://tricitymatch.com/onboarding?ref=PRIYA1', phase });

  it('puts the partner\'s name and link into every message', () => {
    for (const m of texts('after')) {
      expect(m.text).toContain('https://tricitymatch.com/onboarding?ref=PRIYA1');
    }
    expect(texts('after').find((m) => m.id === 'intro').text).toContain("it's Priya");
  });

  it('only announces a launch while it is still ahead, and says "today" on the day', () => {
    expect(texts('after').some((m) => m.id === 'launch')).toBe(false);
    expect(texts('before').find((m) => m.id === 'launch').text).toMatch(/launches on 11 October/);
    expect(texts('today').find((m) => m.id === 'launch').text).toMatch(/launches today/);
  });

  it('never makes a promise the programme rules forbid', () => {
    const all = ['before', 'today', 'after'].flatMap(texts).map((m) => m.text).join('\n');
    expect(all).not.toMatch(/guarantee/i);
    expect(all).not.toMatch(/background[- ]verified|police|id[- ]verified/i);
    expect(all).not.toMatch(/\bfree premium\b/i);
    expect(all).not.toMatch(/\d[\d,]*\+? (members|matches|couples)/i);
  });
});

const renderGuide = (ctx) => render(
  <MemoryRouter initialEntries={['/marketing/guide']}>
    <Routes>
      <Route path="/marketing" element={<Outlet context={ctx} />}>
        <Route path="guide" element={<MarketingGuide />} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

describe('Partner Guide acceptance', () => {
  beforeEach(() => {
    mocks.get.mockImplementation((url) => {
      if (url === '/marketing/payouts') return Promise.resolve({ data: { summary: { commissionRate: 20, holdDays: 10, minPayout: 750 } } });
      if (url === '/subscription/plans') return Promise.resolve({ data: { plans: { free: { price: 0 }, premium_plus: { name: 'Premium', price: 1099, duration: '3 months' } } } });
      return Promise.resolve({ data: {} });
    });
  });

  it('keeps the button disabled until the box is ticked, then records the CURRENT version', async () => {
    const refresh = vi.fn(async () => {});
    mocks.post.mockResolvedValue({ data: { success: true } });
    renderGuide({ onboarding: onboarding(), refreshOnboarding: refresh });

    const button = screen.getByRole('button', { name: /accept and continue/i });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /i have read the partner guide/i }));
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/marketing/accept-agreement', { version: '2026-10-05', accepted: true }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('shows when the guide was accepted instead of the form', () => {
    renderGuide({ onboarding: onboarding({ agreement: true }), refreshOnboarding: vi.fn() });
    expect(screen.getByText(/you accepted this guide/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept and continue/i })).toBeNull();
  });

  it('asks again, and says why, when the guide has changed', () => {
    renderGuide({ onboarding: onboarding({}, { needsReacceptance: true }), refreshOnboarding: vi.fn() });
    expect(screen.getByText(/has changed since you last accepted/i)).toBeInTheDocument();
  });

  it('reads the hold period and minimum payout from the live settings, not from the page', async () => {
    renderGuide({ onboarding: onboarding(), refreshOnboarding: vi.fn() });
    expect(await screen.findByText(/payable 10 days after/i)).toBeInTheDocument();
    expect(screen.getByText(/Minimum payout ₹750/)).toBeInTheDocument();
    expect(await screen.findByText(/you earn up to ₹220/)).toBeInTheDocument();
  });

  it('shows no acceptance form to someone who is not a partner (an admin browsing)', () => {
    renderGuide({ onboarding: null, refreshOnboarding: vi.fn() });
    expect(screen.queryByRole('heading', { name: /your agreement/i })).toBeNull();
  });
});

describe('Admin: creating a partner', () => {
  const partnerRow = {
    id: 'u1', email: 'priya.field@example.com', role: 'marketing', status: 'active',
    Profile: { firstName: 'Priya', lastName: 'Field' },
    onboarding: onboarding({ agreement: true }),
  };

  beforeEach(() => {
    mocks.get.mockImplementation((url) => {
      if (url.startsWith('/admin/marketing-users')) return Promise.resolve({ data: { users: [partnerRow], pagination: { pages: 1 } } });
      if (url === '/admin/marketing-commission') return Promise.resolve({ data: { commission: { rate: 20 } } });
      return Promise.resolve({ data: {} });
    });
  });

  it('lists how far each partner has got and what is missing', async () => {
    render(<MemoryRouter><AdminMarketingUsers /></MemoryRouter>);
    expect(await screen.findByText('1 of 4')).toBeInTheDocument();
    expect(screen.getByText(/No payout details · No code yet · No members yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Guide not accepted/)).toBeNull();
  });

  it('generates a password that meets the policy and shows the sign-in details once', async () => {
    mocks.post.mockResolvedValue({ data: { user: { email: 'new.rep@example.com' }, welcomeEmailSent: true } });
    render(<MemoryRouter><AdminMarketingUsers /></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole('button', { name: /create user/i }))[0]);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new.rep@example.com' } });
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Neha' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Sood' } });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    const pw = screen.getByLabelText(/temporary password/i).value;
    expect(pw.length).toBeGreaterThanOrEqual(12);
    expect(pw).toMatch(/[A-Z]/); expect(pw).toMatch(/[a-z]/); expect(pw).toMatch(/\d/); expect(pw).toMatch(/[^A-Za-z\d]/);

    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    const dialog = await screen.findByRole('dialog', { name: /partner account created/i });
    expect(within(dialog).getByText(/welcome email with the first steps was sent/i)).toBeInTheDocument();
    expect(dialog.textContent).toContain(pw);
    expect(dialog.textContent).toContain('/login');

    fireEvent.click(within(dialog).getByRole('button', { name: /copy sign-in details/i }));
    await waitFor(() => expect(copyText).toHaveBeenCalled());
    expect(copyText.mock.calls[0][0]).toContain(pw);

    // Closing the panel discards the password for good.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog', { name: /partner account created/i })).toBeNull();
  });

  it('tells the admin when the welcome email did not go so they can send the details themselves', async () => {
    mocks.post.mockResolvedValue({ data: { user: { email: 'new.rep@example.com' }, welcomeEmailSent: false } });
    render(<MemoryRouter><AdminMarketingUsers /></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole('button', { name: /create user/i }))[0]);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new.rep@example.com' } });
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Neha' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Sood' } });
    fireEvent.change(screen.getByLabelText(/temporary password/i), { target: { value: 'Str0ng!Passw0rd-xx' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(await screen.findByText(/welcome email could not be sent/i)).toBeInTheDocument();
  });
});
