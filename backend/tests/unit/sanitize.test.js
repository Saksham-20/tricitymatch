/**
 * Sanitization Utilities Unit Tests
 * Tests for XSS and input sanitization
 */

const {
  escapeHtml,
  sanitizeString,
  sanitizeMessage,
  sanitizeEmail,
  sanitizePhone,
  escapeLikePattern,
  isValidUUID,
  isValidEmail,
  isValidUrl,
  truncate,
  maskEmail,
  maskPhone
} = require('../../utils/sanitize');

describe('Sanitization Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("xss")</script>';
      const result = escapeHtml(input);
      
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    it('should handle ampersands', () => {
      const input = 'Tom & Jerry';
      const result = escapeHtml(input);
      
      expect(result).toBe('Tom &amp; Jerry');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle non-string input', () => {
      expect(escapeHtml(null)).toBe(null);
      expect(escapeHtml(undefined)).toBe(undefined);
      expect(escapeHtml(123)).toBe(123);
    });
  });

  describe('sanitizeString', () => {
    it('should remove null bytes', () => {
      const input = 'hello\0world';
      const result = sanitizeString(input);
      
      expect(result).toBe('helloworld');
    });

    it('should remove control characters', () => {
      const input = 'hello\x00\x08\x1Fworld';
      const result = sanitizeString(input);
      
      expect(result).toBe('helloworld');
    });

    it('should trim whitespace', () => {
      const input = '  hello world  ';
      const result = sanitizeString(input);
      
      expect(result).toBe('hello world');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(null)).toBe(null);
      expect(sanitizeString(123)).toBe(123);
    });
  });

  describe('sanitizeMessage', () => {
    it('should escape HTML in messages', () => {
      const input = '<b>Hello</b> there!';
      const result = sanitizeMessage(input);
      
      expect(result).toContain('&lt;b&gt;');
      expect(result).not.toContain('<b>');
    });

    it('should remove javascript: protocol', () => {
      const input = 'Click javascript:alert(1)';
      const result = sanitizeMessage(input);
      
      expect(result).not.toContain('javascript:');
    });

    it('should remove data: protocol', () => {
      const input = 'Image: data:text/html,<script>alert(1)</script>';
      const result = sanitizeMessage(input);
      
      expect(result).not.toContain('data:');
    });

    it('should normalize excessive newlines', () => {
      const input = 'Hello\n\n\n\n\nWorld';
      const result = sanitizeMessage(input);
      
      expect(result).toBe('Hello\n\nWorld');
    });

    it('should handle empty input', () => {
      expect(sanitizeMessage('')).toBe('');
      expect(sanitizeMessage(null)).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('should lowercase email', () => {
      const result = sanitizeEmail('Test@Example.COM');
      expect(result).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      const result = sanitizeEmail('  test@example.com  ');
      expect(result).toBe('test@example.com');
    });

    it('should remove spaces', () => {
      const result = sanitizeEmail('test @ example.com');
      expect(result).toBe('test@example.com');
    });
  });

  describe('sanitizePhone', () => {
    it('should keep only digits and +', () => {
      const result = sanitizePhone('+1 (234) 567-8900');
      expect(result).toBe('+12345678900');
    });

    it('should limit to 15 characters', () => {
      const result = sanitizePhone('+12345678901234567890');
      expect(result.length).toBeLessThanOrEqual(15);
    });
  });

  describe('escapeLikePattern', () => {
    it('should escape % character', () => {
      const result = escapeLikePattern('100%');
      expect(result).toBe('100\\%');
    });

    it('should escape _ character', () => {
      const result = escapeLikePattern('test_value');
      expect(result).toBe('test\\_value');
    });

    it('should escape backslash', () => {
      const result = escapeLikePattern('path\\to\\file');
      expect(result).toBe('path\\\\to\\\\file');
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID v4', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(123)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('should reject very long email', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(isValidEmail(longEmail)).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate HTTP URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=1')).toBe(true);
    });

    it('should reject non-HTTP protocols', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
      expect(isValidUrl('data:text/html,<script>')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const result = truncate('Hello World', 8);
      expect(result).toBe('Hello...');
    });

    it('should not truncate short strings', () => {
      const result = truncate('Hello', 10);
      expect(result).toBe('Hello');
    });

    it('should use custom suffix', () => {
      const result = truncate('Hello World', 8, '…');
      expect(result).toBe('Hello W…');
    });
  });

  describe('maskEmail', () => {
    it('should mask email address', () => {
      const result = maskEmail('john.doe@example.com');
      expect(result).toMatch(/^j.*e@example\.com$/);
    });

    it('should handle short local parts', () => {
      const result = maskEmail('ab@test.com');
      expect(result).toContain('@test.com');
    });

    it('should handle invalid input', () => {
      expect(maskEmail('')).toBe('***@***');
      expect(maskEmail('invalid')).toBe('***@***');
    });
  });

  describe('maskPhone', () => {
    it('should mask phone number', () => {
      const result = maskPhone('9876543210');
      expect(result).toBe('******3210');
    });

    it('should handle short phone numbers', () => {
      const result = maskPhone('123');
      expect(result).toBe('****');
    });
  });
});
