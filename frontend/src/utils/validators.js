/**
 * Form Validation Utilities
 * Client-side validation (backend has final authority)
 */

// Email validation
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 254;
};

// Phone validation (Indian format)
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const re = /^[6-9]\d{9}$/;
  return re.test(phone);
};

// Strong password validation (matches backend requirements)
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  
  // Minimum 8 characters
  if (password.length < 8) return false;
  
  // Maximum 128 characters
  if (password.length > 128) return false;
  
  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) return false;
  
  // At least one lowercase letter
  if (!/[a-z]/.test(password)) return false;
  
  // At least one number
  if (!/[0-9]/.test(password)) return false;
  
  // At least one special character
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
  
  return true;
};

// Get password validation errors for better UX
export const getPasswordErrors = (password) => {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return ['Password is required'];
  }
  
  if (password.length < 8) {
    errors.push('At least 8 characters');
  }
  
  if (password.length > 128) {
    errors.push('Maximum 128 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('One uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('One lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('One number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('One special character (!@#$%^&*(),.?":{}|<>)');
  }
  
  return errors;
};

// Password strength indicator (0-4)
export const getPasswordStrength = (password) => {
  if (!password) return 0;
  
  let strength = 0;
  
  // Length
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  
  // Complexity
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
  
  return Math.min(strength, 4);
};

// Name validation
export const validateName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  // 2-100 characters, letters, spaces, hyphens, apostrophes
  return trimmed.length >= 2 && 
         trimmed.length <= 100 && 
         /^[a-zA-Z\s'-]+$/.test(trimmed);
};

// Age validation from date of birth
export const validateAge = (dateOfBirth, minAge = 18, maxAge = 100) => {
  if (!dateOfBirth) return false;
  
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  
  // Invalid date
  if (isNaN(birthDate.getTime())) return false;
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age >= minAge && age <= maxAge;
};

// Calculate age from date of birth
export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  
  if (isNaN(birthDate.getTime())) return null;
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Height validation (in cm)
export const validateHeight = (height, min = 100, max = 250) => {
  const h = parseInt(height, 10);
  return !isNaN(h) && h >= min && h <= max;
};

// Bio/About validation
export const validateBio = (bio, maxLength = 2000) => {
  if (!bio) return true; // Bio is optional
  if (typeof bio !== 'string') return false;
  return bio.trim().length <= maxLength;
};

// City validation
export const validateCity = (city) => {
  if (!city || typeof city !== 'string') return false;
  const trimmed = city.trim();
  return trimmed.length >= 2 && 
         trimmed.length <= 100 && 
         /^[a-zA-Z\s'-]+$/.test(trimmed);
};

// Interest tags validation
export const validateTags = (tags, maxTags = 20) => {
  if (!Array.isArray(tags)) return false;
  if (tags.length > maxTags) return false;
  return tags.every(tag => 
    typeof tag === 'string' && 
    tag.trim().length >= 1 && 
    tag.trim().length <= 50
  );
};

// URL validation
export const validateUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

// Form validation helper
export const validateForm = (data, rules) => {
  const errors = {};
  
  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field];
    
    for (const rule of fieldRules) {
      const error = rule(value, data);
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Common validation rules
export const rules = {
  required: (message = 'This field is required') => (value) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return message;
    }
    return null;
  },
  
  minLength: (min, message) => (value) => {
    if (value && value.length < min) {
      return message || `Minimum ${min} characters required`;
    }
    return null;
  },
  
  maxLength: (max, message) => (value) => {
    if (value && value.length > max) {
      return message || `Maximum ${max} characters allowed`;
    }
    return null;
  },
  
  email: (message = 'Invalid email address') => (value) => {
    if (value && !validateEmail(value)) {
      return message;
    }
    return null;
  },
  
  phone: (message = 'Invalid phone number') => (value) => {
    if (value && !validatePhone(value)) {
      return message;
    }
    return null;
  },
  
  password: (message = 'Password does not meet requirements') => (value) => {
    if (value && !validatePassword(value)) {
      return message;
    }
    return null;
  },
  
  match: (fieldName, message) => (value, data) => {
    if (value !== data[fieldName]) {
      return message || `Does not match ${fieldName}`;
    }
    return null;
  },
};