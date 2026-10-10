/**
 * Profile page: the state shown beside the city is worked out from the city
 * (the stored column said "Punjab" for everyone), and values are no longer run
 * through CSS capitalize, which turned units into "142 Cm" and "₹12.0L/Yr".
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', role: 'user', Profile: { firstName: 'Ravi', city: 'Mohali' } } }),
}));
vi.mock('../../context/CallContext', () => ({ useCall: () => ({ startCall: vi.fn() }) }));

import api from '../../api/axios';
import ProfileDetail from '../../pages/ProfileDetail';

const profileOf = (extra) => ({
  userId: 'u2', firstName: 'Asha', lastName: 'Verma', dateOfBirth: '1996-04-12', gender: 'female',
  height: 142, weight: 62, income: 1200000, diet: 'vegetarian', smoking: 'never', drinking: 'occasionally',
  religion: 'Hindu', motherTongue: 'Punjabi', maritalStatus: 'never_married',
  ...extra,
});

const renderProfile = (profile) => {
  api.get.mockImplementation((url) => (url === '/profile/u2'
    ? Promise.resolve({ data: { profile, compatibilityScore: 72, hasPremiumAccess: false, contactShare: { level: 'everyone', allowed: true } } })
    : Promise.reject(Object.assign(new Error('no'), { response: { status: 404 } }))));
  return render(
    <MemoryRouter initialEntries={['/profile/u2']}>
      <Routes><Route path="/profile/:userId" element={<ProfileDetail />} /></Routes>
    </MemoryRouter>
  );
};

beforeEach(() => vi.clearAllMocks());

describe('ProfileDetail place line', () => {
  it('shows a Panchkula profile in Haryana, whatever the stored state says', async () => {
    renderProfile(profileOf({ city: 'Panchkula', state: 'Punjab' }));
    expect((await screen.findAllByText('Panchkula, Haryana')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Panchkula, Punjab/)).not.toBeInTheDocument();
  });

  it('shows Chandigarh once, not "Chandigarh, Punjab"', async () => {
    renderProfile(profileOf({ city: 'Chandigarh', state: 'Punjab' }));
    expect((await screen.findAllByText('Chandigarh')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Chandigarh, /)).not.toBeInTheDocument();
  });
});

describe('ProfileDetail values', () => {
  it('keeps units as written: no CSS capitalize on the height, weight or income', async () => {
    renderProfile(profileOf({ city: 'Mohali' }));
    const height = await screen.findAllByText(`4'8" (142 cm)`);
    const weight = screen.getAllByText('62 kg');
    const income = screen.getAllByText('₹12.0L/yr');
    for (const el of [...height, ...weight, ...income]) {
      expect(el.className).not.toMatch(/\bcapitalize\b/);
    }
  });

  it('formats stored choices instead of leaving them lower case', async () => {
    renderProfile(profileOf({ city: 'Mohali' }));
    expect((await screen.findAllByText('Vegetarian')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Never').length).toBeGreaterThan(0);
    expect(screen.queryByText('vegetarian')).not.toBeInTheDocument();
  });
});
