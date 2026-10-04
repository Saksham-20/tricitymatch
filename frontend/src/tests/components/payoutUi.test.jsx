import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/apiClient', () => ({ default: { get: mocks.get, put: mocks.put } }));

import PayoutDetailsCard from '../../components/marketing/PayoutDetailsCard';
import PayoutSection from '../../components/marketing/PayoutSection';

beforeEach(() => vi.clearAllMocks());

describe('PayoutDetailsCard', () => {
  it('opens the form when nothing is saved and sends the whole set', async () => {
    mocks.get.mockResolvedValue({ data: { details: null } });
    mocks.put.mockResolvedValue({ data: { details: { method: 'upi', upiId: 'pr•••@okhdfc', pan: 'AB••••••4F' } } });
    render(<PayoutDetailsCard />);

    fireEvent.change(await screen.findByLabelText('UPI ID'), { target: { value: 'priya@okhdfc' } });
    fireEvent.change(screen.getByLabelText('PAN'), { target: { value: 'abcde1234f' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/marketing/payout-details',
      expect.objectContaining({ method: 'upi', upiId: 'priya@okhdfc', pan: 'ABCDE1234F' })));
    expect(await screen.findByText(/UPI on file/)).toBeInTheDocument();
    // The saved view is the masked one the server returned.
    expect(screen.getByText('pr•••@okhdfc')).toBeInTheDocument();
  });

  it('shows the masked details and the server\'s validation message', async () => {
    mocks.get.mockResolvedValue({ data: { details: { method: 'bank', accountHolder: 'Priya', accountNumber: '••••••••9012', ifsc: 'HDFC0001234', pan: 'AB••••••4F' } } });
    mocks.put.mockRejectedValue({ response: { data: { error: { message: 'Enter a valid IFSC code (for example HDFC0001234)' } } } });
    render(<PayoutDetailsCard />);

    expect(await screen.findByText(/Bank account on file/)).toBeInTheDocument();
    expect(screen.getByText(/••••••••9012/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Bank account' }));
    fireEvent.change(screen.getByLabelText('Account holder name'), { target: { value: 'Priya' } });
    fireEvent.change(screen.getByLabelText('Account number'), { target: { value: '123456789012' } });
    fireEvent.change(screen.getByLabelText('IFSC code'), { target: { value: 'bad' } });
    fireEvent.change(screen.getByLabelText('PAN'), { target: { value: 'ABCDE1234F' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid IFSC code');
  });

  it('offers a retry when the details cannot be loaded', async () => {
    mocks.get.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ data: { details: null } });
    render(<PayoutDetailsCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('UPI ID')).toBeInTheDocument();
  });
});

describe('PayoutSection hold and TDS', () => {
  const ledger = {
    summary: { commissionRate: 20, earned: 600, paidOut: 100, pending: 0, outstanding: 500, payable: 200, inHold: 300, holdDays: 7, overpaid: 0, lastPaidAt: null },
    payouts: [{ id: 'p1', amount: 1000, status: 'paid', tdsAmount: 100, tdsRate: 10, netAmount: 900, method: 'upi', reference: 'UTR1', createdAt: '2026-10-01', paidAt: '2026-10-01' }],
  };

  it('separates payable from the refund window and shows TDS with the net', () => {
    render(<PayoutSection ledger={ledger} />);
    expect(screen.getByText('Payable now')).toBeInTheDocument();
    expect(screen.getByText('In refund window')).toBeInTheDocument();
    expect(screen.getByText(/7 days after each member/)).toBeInTheDocument();
    expect(screen.getByText(/TDS ₹100 · you receive ₹900/)).toBeInTheDocument();
  });

  it('shows no hold figure when nothing is held', () => {
    render(<PayoutSection ledger={{ ...ledger, summary: { ...ledger.summary, inHold: 0 } }} />);
    expect(screen.queryByText('In refund window')).not.toBeInTheDocument();
  });
});
