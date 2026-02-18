/**
 * Validators Unit Tests
 * Tests for frontend validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePhone,
  validatePassword,
  getPasswordErrors,
  getPasswordStrength,
  validateName,
  validateAge,
  calculateAge,
  validateHeight,
  validateBio,
  validateUrl
} from '../../utils/validators';

describe('Validators', () => {
  describe('validateEmail', () => {
    it('should accept valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('should reject very long email', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      expect(validateEmail(longEmail)).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should accept valid Indian phone numbers', () => {
      expect(validatePhone('9876543210')).toBe(true);
      expect(validatePhone('6123456789')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('')).toBe(false);
      expect(validatePhone('12345')).toBe(false);
      expect(validatePhone('1234567890')).toBe(false); // Doesn't start with 6-9
      expect(validatePhone('98765432101')).toBe(false); // Too long
    });
  });

  describe('validatePassword', () => {
    it('should accept strong password', () => {
      expect(validatePassword('StrongPass123!')).toBe(true);
      expect(validatePassword('MyP@ssw0rd')).toBe(true);
    });

    it('should reject weak password', () => {
      expect(validatePassword('')).toBe(false);
      expect(validatePassword('short')).toBe(false);
      expect(validatePassword('alllowercase1!')).toBe(false); // No uppercase
      expect(validatePassword('ALLUPPERCASE1!')).toBe(false); // No lowercase
      expect(validatePassword('NoNumbers!')).toBe(false);
      expect(validatePassword('NoSpecial123')).toBe(false);
    });
  });

  describe('getPasswordErrors', () => {
    it('should return empty array for valid password', () => {
      const errors = getPasswordErrors('StrongPass123!');
      expect(errors).toHaveLength(0);
    });

    it('should return all errors for empty password', () => {
      const errors = getPasswordErrors('');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should return specific errors', () => {
      const errors = getPasswordErrors('short');
      expect(errors).toContain('At least 8 characters');
      expect(errors).toContain('One uppercase letter');
      expect(errors).toContain('One number');
      expect(errors).toContain('One special character (!@#$%^&*(),.?":{}|<>)');
    });
  });

  describe('getPasswordStrength', () => {
    it('should return 0 for empty password', () => {
      expect(getPasswordStrength('')).toBe(0);
    });

    it('should return higher score for stronger passwords', () => {
      const weak = getPasswordStrength('weak');
      const medium = getPasswordStrength('Medium1');
      const strong = getPasswordStrength('StrongPass123!');

      expect(weak).toBeLessThan(medium);
      expect(medium).toBeLessThan(strong);
    });

    it('should cap at 4', () => {
      const maxStrength = getPasswordStrength('VeryStrongPassword123!@#');
      expect(maxStrength).toBeLessThanOrEqual(4);
    });
  });

  describe('validateName', () => {
    it('should accept valid names', () => {
      expect(validateName('John')).toBe(true);
      expect(validateName('Mary Jane')).toBe(true);
      expect(validateName("O'Brien")).toBe(true);
      expect(validateName('Jean-Pierre')).toBe(true);
    });

    it('should reject invalid names', () => {
      expect(validateName('')).toBe(false);
      expect(validateName('J')).toBe(false); // Too short
      expect(validateName('John123')).toBe(false); // Contains numbers
      expect(validateName('John@Doe')).toBe(false); // Contains special chars
    });
  });

  describe('validateAge / calculateAge', () => {
    it('should calculate age correctly', () => {
      const today = new Date();
      const thirtyYearsAgo = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
      
      expect(calculateAge(thirtyYearsAgo.toISOString())).toBe(30);
    });

    it('should validate age range', () => {
      const today = new Date();
      
      // 25 years old - valid
      const validDate = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
      expect(validateAge(validDate.toISOString())).toBe(true);
      
      // 17 years old - invalid (underage)
      const underageDate = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
      expect(validateAge(underageDate.toISOString())).toBe(false);
      
      // 101 years old - invalid (too old)
      const tooOldDate = new Date(today.getFullYear() - 101, today.getMonth(), today.getDate());
      expect(validateAge(tooOldDate.toISOString())).toBe(false);
    });

    it('should handle invalid dates', () => {
      expect(validateAge('')).toBe(false);
      expect(validateAge('invalid')).toBe(false);
      expect(calculateAge('invalid')).toBe(null);
    });
  });

  describe('validateHeight', () => {
    it('should accept valid heights', () => {
      expect(validateHeight(170)).toBe(true);
      expect(validateHeight(100)).toBe(true);
      expect(validateHeight(250)).toBe(true);
    });

    it('should reject invalid heights', () => {
      expect(validateHeight(50)).toBe(false); // Too short
      expect(validateHeight(300)).toBe(false); // Too tall
      expect(validateHeight('invalid')).toBe(false);
    });
  });

  describe('validateBio', () => {
    it('should accept valid bio', () => {
      expect(validateBio('This is my bio')).toBe(true);
      expect(validateBio('')).toBe(true); // Optional
      expect(validateBio(null)).toBe(true);
    });

    it('should reject too long bio', () => {
      const longBio = 'a'.repeat(2001);
      expect(validateBio(longBio)).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://example.com/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('')).toBe(false);
      expect(validateUrl('not a url')).toBe(false);
      expect(validateUrl('ftp://example.com')).toBe(false);
      expect(validateUrl('javascript:alert(1)')).toBe(false);
    });
  });
});
