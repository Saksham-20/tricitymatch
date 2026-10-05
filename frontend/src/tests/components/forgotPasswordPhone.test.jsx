import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/axios', () => ({ default: { post: vi.fn() } }));
vi.mock('../../components/common/Seo', () => ({ default: () => null }));
vi.mock('../../components/common/Logo', () => ({ default: () => <span>logo</span> }));

import api from '../../api/axios';
import ForgotPasswordPhone from '../../pages/ForgotPasswordPhone';

beforeEach(() => vi.clearAllMocks());

const typeCode = (code) => {
  const boxes = screen.getAllByRole('textbox').filter((el) => el.getAttribute('maxlength') === '1' || el.inputMode === 'numeric');
  const inputs = boxes.length >= 4 ? boxes : screen.getAllByRole('textbox');
  code.split('').forEach((d, i) => fireEvent.change(inputs[i], { target: { value: d } }));
};

describe('ForgotPasswordPhone', () => {
  it('emails a reset link when given the mobile number and the email on the account (preferred: no SMS cost)', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    render(<MemoryRouter><ForgotPasswordPhone /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '98765 43210' } });
    fireEvent.change(screen.getByLabelText('Email on your account'), { target: { value: 'asha@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /email me a reset link/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/forgot-password/phone-email', { phone: '9876543210', email: 'asha@example.com' }));
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    // SMS stays one tap away if the mail does not come.
    fireEvent.click(screen.getByRole('button', { name: /text me a code instead/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/forgot-password/phone', { phone: '9876543210' }));
  });

  it('asks for the email before sending a link', async () => {
    render(<MemoryRouter><ForgotPasswordPhone /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /email me a reset link/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/email address on your account/);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects a number that is not a 10-digit Indian mobile', async () => {
    render(<MemoryRouter><ForgotPasswordPhone /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: /text me a code instead/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/10-digit/);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('sends the code, then resets with code and a strong password', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    render(<MemoryRouter><ForgotPasswordPhone /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '+91 98765 43210' } });
    fireEvent.click(screen.getByRole('button', { name: /text me a code instead/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/forgot-password/phone', { phone: '9876543210' }));

    await screen.findByLabelText('New password');
    typeCode('4821');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'N3w!Password-2026' } });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/reset-password/phone', { phone: '9876543210', code: '4821', password: 'N3w!Password-2026' }));
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
  });

  it('does not call the server with a weak password', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    render(<MemoryRouter><ForgotPasswordPhone /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /text me a code instead/i }));
    await screen.findByLabelText('New password');
    typeCode('4821');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/8\+ characters/);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('offers a resend (after a cooldown) and an email route on the code step', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    render(<MemoryRouter><ForgotPasswordPhone /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /text me a code instead/i }));
    await screen.findByLabelText('New password');

    // Cooling down right after the first send: the resend control is disabled.
    expect(screen.getByRole('button', { name: /resend in \d+s/i })).toBeDisabled();
    expect(screen.getByRole('link', { name: /reset with just your email/i })).toHaveAttribute('href', '/forgot-password');
  });

  it('accepts a password whose only symbol is outside the old @$!%*?& set', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    render(<MemoryRouter><ForgotPasswordPhone /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /text me a code instead/i }));
    await screen.findByLabelText('New password');
    typeCode('4821');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Hello#1234' } });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/reset-password/phone', expect.objectContaining({ password: 'Hello#1234' })));
  });
});
