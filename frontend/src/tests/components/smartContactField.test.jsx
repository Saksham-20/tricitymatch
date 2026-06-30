/**
 * The combined signup uses one smart box that must reliably tell an email from
 * an Indian mobile and reduce a messy phone string to its 10 national digits.
 * These pure helpers gate which OTP channel (email vs SMS) the user is sent to.
 */
import { describe, it, expect } from 'vitest';
import { detectContactType, phoneDigits } from '../../components/onboarding/SmartContactField';

describe('detectContactType', () => {
  it('reads anything with a letter or @ as email', () => {
    expect(detectContactType('user@example.com')).toBe('email');
    expect(detectContactType('john')).toBe('email');
    expect(detectContactType('9876a')).toBe('email');
  });

  it('reads a digit-only string as phone', () => {
    expect(detectContactType('9876543210')).toBe('phone');
    expect(detectContactType('+91 98765 43210')).toBe('phone');
    expect(detectContactType('098765 43210')).toBe('phone');
  });

  it('returns null for empty / whitespace', () => {
    expect(detectContactType('')).toBeNull();
    expect(detectContactType('   ')).toBeNull();
  });
});

describe('phoneDigits', () => {
  it('strips +91, leading 0, and spaces down to 10 digits', () => {
    expect(phoneDigits('+91 98765 43210')).toBe('9876543210');
    expect(phoneDigits('098765-43210')).toBe('9876543210');
    expect(phoneDigits('919876543210')).toBe('9876543210');
    expect(phoneDigits('9876543210')).toBe('9876543210');
  });
});
