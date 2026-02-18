/**
 * Sanitization utilities for XSS prevention
 * Uses DOMPurify for HTML sanitization
 */

import DOMPurify from 'dompurify';

// Configure DOMPurify with strict settings
const purifyConfig = {
  ALLOWED_TAGS: [], // No HTML tags allowed by default
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
};

// For rich text content (if ever needed)
const richTextConfig = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ADD_ATTR: ['target', 'rel'],
  FORCE_BODY: true,
};

/**
 * Sanitize plain text - strips all HTML
 * Use for user-generated content like messages, bios, etc.
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return DOMPurify.sanitize(text, purifyConfig);
};

/**
 * Sanitize rich text - allows limited HTML
 * Use only when you need to preserve some formatting
 */
export const sanitizeRichText = (html) => {
  if (!html || typeof html !== 'string') return '';
  
  // Add rel="noopener noreferrer" to all links
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
    }
  });
  
  const result = DOMPurify.sanitize(html, richTextConfig);
  
  // Remove the hook after use
  DOMPurify.removeHook('afterSanitizeAttributes');
  
  return result;
};

/**
 * Escape HTML entities without using DOMPurify
 * Lighter weight option for simple text
 */
export const escapeHtml = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return text.replace(/[&<>"'/]/g, (char) => htmlEntities[char]);
};

/**
 * Remove potential XSS from URL
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  
  // Remove javascript: and data: protocols
  const dangerous = /^(javascript|data|vbscript):/i;
  if (dangerous.test(url.trim())) {
    return '';
  }
  
  // Ensure URL starts with http/https or is relative
  if (!/^(https?:\/\/|\/)/i.test(url.trim())) {
    return '';
  }
  
  return url;
};

/**
 * Sanitize object - recursively sanitizes all string values
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
};

/**
 * Check if string contains potential XSS
 */
export const containsXss = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onerror, etc.
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
    /expression\s*\(/gi, // CSS expression
  ];
  
  return xssPatterns.some((pattern) => pattern.test(text));
};

export default {
  sanitizeText,
  sanitizeRichText,
  escapeHtml,
  sanitizeUrl,
  sanitizeObject,
  containsXss,
};
