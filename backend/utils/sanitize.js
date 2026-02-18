/**
 * Sanitization Utilities
 * Common sanitization and validation helpers
 */

// HTML entities for basic XSS prevention
const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

// Escape HTML special characters
const escapeHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`=/]/g, char => htmlEntities[char]);
};

// Sanitize user input for database storage
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace (but keep single spaces and newlines)
    .replace(/[\t\r]+/g, ' ')
    .trim();
};

// Sanitize message content (more aggressive for chat)
const sanitizeMessage = (content) => {
  if (typeof content !== 'string') return '';
  
  return content
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters except newlines
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Escape HTML entities
    .replace(/[&<>"']/g, char => htmlEntities[char])
    // Remove potentially dangerous protocols
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    // Normalize excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Sanitize email address
const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return '';
  return email.toLowerCase().trim().replace(/\s+/g, '');
};

// Sanitize phone number (keep only digits and + for international)
const sanitizePhone = (phone) => {
  if (typeof phone !== 'string') return '';
  return phone.replace(/[^\d+]/g, '').slice(0, 15);
};

// Remove MongoDB operators from object (NoSQL injection prevention)
const removeMongoOperators = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(removeMongoOperators);
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip keys starting with $
    if (key.startsWith('$')) continue;
    
    result[key] = typeof value === 'object' 
      ? removeMongoOperators(value) 
      : value;
  }
  return result;
};

// Escape special characters in SQL LIKE patterns
const escapeLikePattern = (pattern) => {
  if (typeof pattern !== 'string') return pattern;
  return pattern.replace(/[%_\\]/g, '\\$&');
};

// Validate UUID format
const isValidUUID = (str) => {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Validate email format
const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Validate URL format
const isValidUrl = (url) => {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

// Truncate string to max length
const truncate = (str, maxLength, suffix = '...') => {
  if (typeof str !== 'string') return str;
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
};

// Normalize whitespace
const normalizeWhitespace = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/\s+/g, ' ').trim();
};

// Strip all HTML tags
const stripHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
};

// Generate a safe filename
const safeFilename = (filename) => {
  if (typeof filename !== 'string') return 'file';
  return filename
    .replace(/[^a-z0-9._-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 100);
};

// Mask sensitive data (email, phone)
const maskEmail = (email) => {
  if (typeof email !== 'string' || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2 
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : '*'.repeat(local.length);
  return `${maskedLocal}@${domain}`;
};

const maskPhone = (phone) => {
  if (typeof phone !== 'string' || phone.length < 4) return '****';
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
};

// Parse and validate JSON safely
const safeJsonParse = (str, defaultValue = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
};

// Deep clone object (removes functions and circular refs)
const safeClone = (obj) => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return null;
  }
};

module.exports = {
  escapeHtml,
  sanitizeString,
  sanitizeMessage,
  sanitizeEmail,
  sanitizePhone,
  removeMongoOperators,
  escapeLikePattern,
  isValidUUID,
  isValidEmail,
  isValidUrl,
  truncate,
  normalizeWhitespace,
  stripHtml,
  safeFilename,
  maskEmail,
  maskPhone,
  safeJsonParse,
  safeClone,
};
