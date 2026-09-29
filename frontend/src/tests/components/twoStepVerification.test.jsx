import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../api/axios', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { hasPassword: true }, setUser: vi.fn() }) }));

import TwoStepVerification from '../../components/settings/TwoStepVerification';

beforeEach(() => vi.clearAllMocks());

describe('TwoStepVerification', () => {
  it('walks password -> key + code -> one-time recovery codes', async () => {
    mocks.get.mockResolvedValue({ data: { enabled: false, required: false, recoveryCodesRemaining: 0 } });
    mocks.post
      .mockResolvedValueOnce({ data: { secret: 'ABCDEFGH23456723', otpauthUri: 'otpauth://totp/x' } })
      .mockResolvedValueOnce({ data: { recoveryCodes: ['aaaaa-bbbbb', 'ccccc-ddddd'] } });

    render(<TwoStepVerification />);
    fireEvent.click(await screen.findByRole('button', { name: /turn on/i }));
    fireEvent.change(screen.getByLabelText(/confirm your password/i), { target: { value: 'Pass@1234' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByTestId('mfa-secret')).toHaveTextContent('ABCD EFGH 2345 6723');
    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^turn on$/i }));

    expect(await screen.findByTestId('mfa-recovery-codes')).toHaveTextContent('aaaaa-bbbbb');
    expect(mocks.post).toHaveBeenNthCalledWith(1, '/auth/mfa/setup', { password: 'Pass@1234' });
    expect(mocks.post).toHaveBeenNthCalledWith(2, '/auth/mfa/enable', { code: '123456' });
  });

  it('cannot be turned off when the role requires it', async () => {
    mocks.get.mockResolvedValue({ data: { enabled: true, required: true, recoveryCodesRemaining: 8 } });
    render(<TwoStepVerification />);
    expect(await screen.findByText(/required for your role/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /turn off/i })).toBeNull();
  });

  it('shows a retry when the status cannot be loaded', async () => {
    mocks.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { enabled: false, required: false } });
    render(<TwoStepVerification />);
    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /turn on/i })).toBeInTheDocument());
  });
});
