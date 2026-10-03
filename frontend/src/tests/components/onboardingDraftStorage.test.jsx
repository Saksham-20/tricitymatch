import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingProvider, useOnboarding } from '../../context/OnboardingContext';

const Probe = () => {
  const { formData, currentStep } = useOnboarding();
  return <div data-testid="probe">{String(formData.email || '')}|{currentStep}</div>;
};

const install = (impl) => Object.defineProperty(window, 'localStorage', { configurable: true, value: impl });

describe('onboarding draft storage (PROF-29)', () => {
  beforeEach(() => install({ getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} }));

  it('a corrupt saved draft falls back to a blank form instead of crashing', () => {
    install({ getItem: (k) => (k === 'onboarding_draft' ? '{not json' : '3'), setItem: () => {}, removeItem: () => {}, clear: () => {} });
    render(<OnboardingProvider mode="signup"><Probe /></OnboardingProvider>);
    expect(screen.getByTestId('probe').textContent).toMatch(/^\|/);
  });

  it('blocked storage (throws on every call) still renders', () => {
    const boom = () => { throw new Error('SecurityError'); };
    install({ getItem: boom, setItem: boom, removeItem: boom, clear: boom });
    render(<OnboardingProvider mode="signup"><Probe /></OnboardingProvider>);
    expect(screen.getByTestId('probe')).toBeTruthy();
  });

  it('a valid draft is still restored', () => {
    install({
      getItem: (k) => (k === 'onboarding_draft' ? JSON.stringify({ email: 'a@example.com' }) : null),
      setItem: () => {}, removeItem: () => {}, clear: () => {},
    });
    render(<OnboardingProvider mode="signup"><Probe /></OnboardingProvider>);
    expect(screen.getByTestId('probe').textContent).toContain('a@example.com');
  });
});
