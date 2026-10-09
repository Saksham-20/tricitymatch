import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileCard from '../../components/cards/ProfileCard';

/**
 * A free founding grant gets no plan badge (it was never a purchase, and the
 * offer is off by choice), and
 * the plan on sale (premium_plus) is called "Premium", not "Plus" (DISC-26).
 */
const base = { userId: 'u1', firstName: 'Asha', lastName: 'Verma', city: 'Mohali', dateOfBirth: '1996-04-12', isPremium: true, profilePhoto: 'https://res.cloudinary.com/demo/image/upload/a.jpg' };
const badge = (premiumPlan) => {
  const { unmount } = render(
    <MemoryRouter><ProfileCard profile={{ ...base, premiumPlan }} userId="u1" /></MemoryRouter>
  );
  const text = document.body.textContent;
  unmount();
  return text;
};

describe('ProfileCard plan badge', () => {
  it('shows no plan badge for a founding grant', () => {
    const text = badge('founding_premium');
    expect(text).not.toContain('Founding');
    expect(text).not.toContain('Premium');
  });

  it('calls the plan on sale Premium, not Plus', () => {
    const text = badge('premium_plus');
    expect(text).toContain('Premium');
    expect(text).not.toContain('Plus');
  });

  it('keeps the other tiers\' own names', () => {
    expect(badge('vip')).toContain('VIP');
    expect(badge('elite')).toContain('Elite');
    expect(badge('nri')).toContain('NRI');
  });
});
