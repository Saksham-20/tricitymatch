/**
 * Regression: onboarding VerificationStep must let a user fix a wrong/typo'd
 * email inline, without navigating 11 steps back to Create Account. Editing the
 * email also has to clear any prior emailVerification so a corrected address
 * can never submit with a stale "verified" flag.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// No network in tests — the OTP endpoints are exercised live in QA, not here.
vi.mock('../../api/axios', () => ({ default: { post: vi.fn().mockResolvedValue({ data: {} }) } }));

import { OnboardingProvider, useOnboarding } from '../../context/OnboardingContext';
import VerificationStep from '../../components/onboarding/steps/VerificationStep';

// The global setup.js stubs localStorage with non-persisting vi.fn()s; the
// onboarding provider seeds its draft from localStorage, so give it a real
// map-backed store for these tests.
beforeEach(() => {
  const store = new Map();
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

const seedDraft = (overrides = {}) => {
  localStorage.setItem(
    'onboarding_draft',
    JSON.stringify({ creatingFor: 'self', email: 'wrong.typo@gmial.com', emailVerification: false, ...overrides })
  );
};

const renderStep = () =>
  render(
    <OnboardingProvider mode="signup">
      <VerificationStep />
    </OnboardingProvider>
  );

describe('VerificationStep email change', () => {
  it('shows the current email with a Change affordance', () => {
    seedDraft();
    renderStep();
    expect(screen.getByText('wrong.typo@gmial.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
  });

  it('lets the user correct a wrong email inline', () => {
    seedDraft();
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /change/i }));

    const input = screen.getByLabelText(/update email/i);
    fireEvent.change(input, { target: { value: 'correct.user@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    // Old address gone, new one shown, editor closed (Change is back).
    expect(screen.queryByText('wrong.typo@gmial.com')).not.toBeInTheDocument();
    expect(screen.getByText('correct.user@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
  });

  it('rejects an invalid email and keeps the original', () => {
    seedDraft();
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /change/i }));

    const input = screen.getByLabelText(/update email/i);
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
    expect(screen.getByText('wrong.typo@gmial.com')).toBeInTheDocument();
  });

  it('clears a prior verified flag when the email is changed (context guard)', () => {
    seedDraft({ emailVerification: true });

    let ctx;
    const Probe = () => { ctx = useOnboarding(); return null; };
    render(
      <OnboardingProvider mode="signup">
        <Probe />
      </OnboardingProvider>
    );

    expect(ctx.formData.emailVerification).toBe(true);
    // Same-value writes must NOT reset the flag (idempotent).
    act(() => ctx.updateFormData('email', 'wrong.typo@gmial.com'));
    expect(ctx.formData.emailVerification).toBe(true);
    // A real email change resets verification.
    act(() => ctx.updateFormData('email', 'changed@gmail.com'));
    expect(ctx.formData.emailVerification).toBe(false);
  });
});
