import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LaunchBanner, { launchBannerState } from '../components/home/LaunchBanner';

const at = (iso) => new Date(iso);
const renderAt = (iso) => render(<MemoryRouter><LaunchBanner now={at(iso)} /></MemoryRouter>);

describe('home LaunchBanner', () => {
  it('phases by IST calendar day', () => {
    expect(launchBannerState(at('2026-10-10T18:00:00Z'))).toBe('before'); // 23:30 IST on the 10th
    expect(launchBannerState(at('2026-10-10T18:30:00Z'))).toBe('open');   // 00:00 IST on the 11th
    expect(launchBannerState(at('2026-10-25T18:29:00Z'))).toBe('open');   // 23:59 IST on the 25th
    expect(launchBannerState(at('2026-10-25T18:30:00Z'))).toBe('hidden'); // the 26th in IST
  });

  it('before launch shows the dated heading as an h2 linking to /onboarding', () => {
    renderAt('2026-10-06T06:00:00Z');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Registrations open11 October.');
    expect(screen.getByRole('link', { name: /register now/i }).getAttribute('href')).toBe('/onboarding');
  });

  it('from launch day says registrations are open', () => {
    renderAt('2026-10-12T06:00:00Z');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Registrationsare open.');
    expect(screen.getByRole('link', { name: /create your profile/i }).getAttribute('href')).toBe('/onboarding');
  });

  it('renders nothing after 25 October', () => {
    const { container } = renderAt('2026-10-27T06:00:00Z');
    expect(container.innerHTML).toBe('');
  });
});
