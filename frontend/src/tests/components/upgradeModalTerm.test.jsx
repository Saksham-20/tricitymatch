/**
 * The upgrade modal prints the plan's live price and term. Under the launch
 * offer a plan runs to a fixed date, so the term is "until 10 Jan 2027", not
 * "/<duration>" (which rendered as "₹1,100/until 10 January 2027").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../api/axios', () => ({ default: { get: mocks.get } }));

import UpgradeModal from '../../components/common/UpgradeModal';

const renderModal = () => render(
  <MemoryRouter><UpgradeModal isOpen onClose={() => {}} /></MemoryRouter>,
);

beforeEach(() => vi.clearAllMocks());

describe('UpgradeModal term', () => {
  it('shows a fixed end date without a slash', async () => {
    mocks.get.mockResolvedValue({ data: { plans: { premium_plus: {
      name: 'Premium', price: 1100, duration: '3 months', endsOn: '2027-01-10T18:29:59.999Z', contactUnlocks: -1, unlockDailyCap: 25,
    } } } });
    renderModal();
    const line = await screen.findByText(/₹1,100/);
    expect(line.textContent).toMatch(/₹1,100 until 10 Jan(uary)? 2027/);
    expect(line.textContent).not.toContain('/until');
  });

  it('keeps "/duration" for a plan without a fixed end date', async () => {
    mocks.get.mockResolvedValue({ data: { plans: { premium_plus: {
      name: 'Premium', price: 2499, duration: '3 months', contactUnlocks: 15,
    } } } });
    renderModal();
    const line = await screen.findByText(/₹2,499/);
    expect(line.textContent).toContain('₹2,499/3 months');
  });
});
