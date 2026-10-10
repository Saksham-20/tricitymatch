/**
 * The contact form, opened by a signed-in member, starts with their name, email
 * and number filled in, and does not ask them to accept the Terms again (they
 * did when they joined). A signed-out visitor still has to tick the box.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const auth = vi.hoisted(() => ({ value: { user: null, isAuthenticated: false } }));

vi.mock('../../api/axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

import api from '../../api/axios';
import Contact from '../../pages/Contact';

const renderContact = () => render(
  <HelmetProvider><MemoryRouter><Contact /></MemoryRouter></HelmetProvider>
);

const MEMBER = {
  id: 'me', role: 'user', email: 'asha@example.com', phone: '9876543210', contactPhone: null,
  Profile: { firstName: 'Asha', lastName: 'Verma' },
};

beforeEach(() => {
  vi.clearAllMocks();
  api.post.mockResolvedValue({ data: { success: true } });
});

describe('Contact form for a signed-in member', () => {
  beforeEach(() => { auth.value = { user: MEMBER, isAuthenticated: true }; });

  it('fills in their name, email and number', async () => {
    renderContact();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('Asha Verma'));
    expect(screen.getByRole('textbox', { name: /email/i })).toHaveValue('asha@example.com');
    expect(screen.getByRole('textbox', { name: /phone/i })).toHaveValue('9876543210');
  });

  it('prefers the number they chose for contact over the sign-in number', async () => {
    auth.value = { user: { ...MEMBER, contactPhone: '9123456780' }, isAuthenticated: true };
    renderContact();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /phone/i })).toHaveValue('9123456780'));
  });

  it('does not ask for the Terms again and sends the message', async () => {
    renderContact();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'My payment went through but no plan.' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/contact', expect.objectContaining({
      name: 'Asha Verma', email: 'asha@example.com', phone: '9876543210',
    })));
  });
});

describe('Contact form for a visitor', () => {
  beforeEach(() => { auth.value = { user: null, isAuthenticated: false }; });

  it('starts empty and still needs the Terms box', async () => {
    renderContact();
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('');
    expect(screen.getByRole('checkbox')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value: 'Ravi' } });
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'ravi@example.com' } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'A question about plans for my son.' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(api.post).not.toHaveBeenCalled();
  });
});
