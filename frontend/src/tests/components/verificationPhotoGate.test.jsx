/**
 * Selfie verification compares the selfie with the profile photo. A member
 * without a photo could open the camera, capture, and only on "Submit for
 * review" learn they needed a photo first, with no way to add one. Both
 * verification screens now say so before the camera, with a link to add one.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', role: 'user', Profile: { firstName: 'Ravi' } }, logout: vi.fn(), updateUser: vi.fn() }),
}));
// The camera itself is not under test: a stand-in shows whether it was offered.
vi.mock('../../components/verification/LiveSelfieCapture', () => ({
  default: () => <div data-testid="live-camera" />,
  captureHeaders: () => ({}),
}));

import api from '../../api/axios';
import Verification from '../../pages/Verification';
import Settings from '../../pages/Settings';

const serve = ({ status = 'not_submitted', profilePhoto = null, profileFails = false } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/verification/status') return Promise.resolve({ data: { verification: { status } } });
    if (url === '/profile/me') {
      return profileFails
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ data: { profile: { profilePhoto } } });
    }
    return Promise.resolve({ data: {} });
  });
};

const renderPage = (element, entry = '/verification') => render(
  <MemoryRouter initialEntries={[entry]}>{element}</MemoryRouter>
);

beforeEach(() => vi.clearAllMocks());

describe('/verification without a profile photo', () => {
  it('asks for a photo before offering the camera, with a link to add one', async () => {
    serve({ profilePhoto: null });
    renderPage(<Verification />);
    expect(await screen.findByText('Add a profile photo first')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add a photo/i })).toHaveAttribute('href', '/profile/edit?section=photos');
    expect(screen.queryByTestId('live-camera')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument();
  });

  it('offers the camera when the member has a photo', async () => {
    serve({ profilePhoto: 'https://img.test/a.jpg' });
    renderPage(<Verification />);
    expect(await screen.findByTestId('live-camera')).toBeInTheDocument();
    expect(screen.queryByText('Add a profile photo first')).not.toBeInTheDocument();
  });

  it('still offers the camera if the profile could not be read', async () => {
    serve({ profileFails: true });
    renderPage(<Verification />);
    expect(await screen.findByTestId('live-camera')).toBeInTheDocument();
  });
});

describe('Settings → Verification without a profile photo', () => {
  it('asks for a photo before offering the camera', async () => {
    serve({ profilePhoto: null });
    renderPage(<Settings />, '/settings?tab=verification');
    expect(await screen.findByText('Add a profile photo first')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add a photo/i })).toHaveAttribute('href', '/profile/edit?section=photos');
    expect(screen.queryByTestId('live-camera')).not.toBeInTheDocument();
  });

  it('offers the camera when the member has a photo', async () => {
    serve({ profilePhoto: 'https://img.test/a.jpg' });
    renderPage(<Settings />, '/settings?tab=verification');
    expect(await screen.findByTestId('live-camera')).toBeInTheDocument();
  });

  it('a verification held for a closer look shows as under review, not as a fresh form', async () => {
    serve({ status: 'flagged', profilePhoto: 'https://img.test/a.jpg' });
    renderPage(<Settings />, '/settings?tab=verification');
    expect(await screen.findByText('Under Review')).toBeInTheDocument();
    expect(screen.queryByTestId('live-camera')).not.toBeInTheDocument();
  });
});
