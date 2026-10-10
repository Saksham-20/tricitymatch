/**
 * FUN-01: "Create it for them" → "Switch to a personal profile" left the
 * guardian draft (creatingFor:'other') in storage, and every later self-signup
 * failed with an attestation error the personal form cannot answer.
 *
 * FUN-02: a draft resumed at step 2 (after "Save & Exit" or a reload) has no
 * password and no verification proof, so "Create my profile" dead-ended at
 * "Password is required" with no password field on the page.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }), put: vi.fn() },
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ signup: vi.fn(), isAuthenticated: false, loading: false }),
}));
vi.mock('../../utils/analytics', () => ({ track: vi.fn(), STAGES: { SIGNUP_STARTED: 'signup_started' } }));
vi.mock('../../api/invite', () => ({ resolveInvite: vi.fn().mockResolvedValue(null) }));
vi.mock('../../components/common/Logo', () => ({ default: () => <span>logo</span> }));
vi.mock('../../components/auth/GoogleSignIn', () => ({ default: () => null }));

import { OnboardingProvider, useOnboarding } from '../../context/OnboardingContext';
import ModernOnboarding from '../../pages/ModernOnboarding';

// The global setup stubs localStorage with non-persisting mocks; the provider
// seeds itself from storage, so give it a real map-backed store.
let store;
beforeEach(() => {
  store = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  });
});

const guardianDraft = {
  identifier: 'me@example.com',
  email: 'me@example.com',
  creatingFor: 'other',
  relationshipToProfile: 'parent',
  yourName: 'Asha',
  yourPhone: '9876543210',
  yourEmail: 'asha@example.com',
  account_attest: true,
  firstName: 'Ravi',
};

const Probe = () => {
  const { formData, currentStep } = useOnboarding();
  return <pre data-testid="probe">{JSON.stringify({ ...formData, currentStep })}</pre>;
};
const probe = () => JSON.parse(screen.getByTestId('probe').textContent);

describe('signup mode after visiting the guardian form (FUN-01)', () => {
  it('treats the profile as the member\'s own and blanks the guardian fields', () => {
    store.set('onboarding_draft', JSON.stringify(guardianDraft));
    render(<OnboardingProvider mode="signup"><Probe /></OnboardingProvider>);
    const data = probe();
    expect(data.creatingFor).toBe('self');
    expect(data).toMatchObject({ relationshipToProfile: '', yourName: '', yourPhone: '', yourEmail: '', account_attest: false });
    // The member's own answers survive the switch.
    expect(data.identifier).toBe('me@example.com');
    expect(data.firstName).toBe('Ravi');
  });

  it('the guardian flow itself still opens for someone else', () => {
    store.set('onboarding_draft', JSON.stringify({ ...guardianDraft, creatingFor: 'self' }));
    render(<OnboardingProvider mode="create_for_other"><Probe /></OnboardingProvider>);
    expect(probe().creatingFor).toBe('other');
  });
});

describe('resuming a signup draft (FUN-02)', () => {
  it('reopens the account step, because the password and code are not saved', () => {
    store.set('onboarding_draft', JSON.stringify({ identifier: 'me@example.com', email: 'me@example.com', firstName: 'Ravi' }));
    store.set('onboarding_step', '1');
    render(<OnboardingProvider mode="signup"><Probe /></OnboardingProvider>);
    expect(probe().currentStep).toBe(0);
  });

  it('the page shows "Create Account", not the step it cannot finish', () => {
    store.set('onboarding_draft', JSON.stringify({ identifier: 'me@example.com', email: 'me@example.com', firstName: 'Ravi' }));
    store.set('onboarding_step', '1');
    render(<MemoryRouter initialEntries={['/onboarding']}><ModernOnboarding /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 2, name: 'Create Account' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Basic Information' })).not.toBeInTheDocument();
    // The saved contact is still filled in.
    expect(screen.getByLabelText(/email or mobile/i)).toHaveValue('me@example.com');
  });
});
