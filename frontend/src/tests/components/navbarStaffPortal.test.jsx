/**
 * The desktop profile dropdown is hidden below md, so the mobile drawer must
 * carry the staff-portal link itself. Without it an admin on a phone had no
 * way from the member site back to /admin.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockAuth = { isAuthenticated: true, user: null, logout: vi.fn() };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
vi.mock('../../context/SocketContext', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { count: 0 } })) },
}));
vi.mock('../../hooks/useDarkMode', () => ({
  default: () => ({ isDark: false, toggle: vi.fn() }),
}));
vi.mock('../../hooks/useElderMode', () => ({ default: () => ({}) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
}));

import Navbar from '../../components/common/Navbar';

const openDrawer = (role) => {
  mockAuth.user = { firstName: 'Test', lastName: 'User', role };
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByLabelText('Open menu'));
  return screen.getByRole('dialog');
};

beforeEach(() => {
  mockAuth.user = null;
});

describe('Navbar mobile drawer — staff portal link', () => {
  it.each(['admin', 'super_admin', 'sub_admin'])('%s gets a link to the admin panel', (role) => {
    const drawer = openDrawer(role);
    const link = Array.from(drawer.querySelectorAll('a')).find((a) => a.textContent === 'Admin panel');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/admin/dashboard');
  });

  it('marketing role gets the marketing portal', () => {
    const drawer = openDrawer('marketing');
    const link = Array.from(drawer.querySelectorAll('a')).find((a) => a.textContent === 'Marketing portal');
    expect(link.getAttribute('href')).toBe('/marketing/dashboard');
  });

  it('a plain member sees no staff link', () => {
    const drawer = openDrawer('user');
    expect(drawer.textContent).not.toMatch(/Admin panel|Marketing portal/);
  });
});
