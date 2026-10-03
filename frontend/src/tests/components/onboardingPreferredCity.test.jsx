/**
 * Editing a profile whose preferred cities were never chosen (null) must not
 * turn the signup form's pre-ticked cities into a saved requirement (DISC-17).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { OnboardingProvider, useOnboarding } from '../../context/OnboardingContext';

let seen;
const Probe = () => { seen = useOnboarding().formData; return null; };
const mount = (props) => render(<OnboardingProvider {...props}><Probe /></OnboardingProvider>);

describe('preferredCity hydration', () => {
  it('edit mode: null stays empty', () => {
    mount({ mode: 'edit', existingProfile: { firstName: 'Asha', preferredCity: null } });
    expect(seen.preferredCity).toEqual([]);
  });

  it('edit mode: a stored list is kept', () => {
    mount({ mode: 'edit', existingProfile: { firstName: 'Asha', preferredCity: ['Mohali'] } });
    expect(seen.preferredCity).toEqual(['Mohali']);
  });

  it('signup still pre-ticks the core cities as a hint', () => {
    localStorage.clear();
    mount({ mode: 'signup' });
    expect(seen.preferredCity).toEqual(['Chandigarh', 'Mohali', 'Panchkula']);
  });
});
