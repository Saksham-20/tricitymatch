/**
 * Jest Test Setup
 * Configuration and utilities for all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!';
process.env.JWT_EXPIRY = '15m';
process.env.REFRESH_TOKEN_EXPIRY = '7d';
process.env.COOKIE_SECRET = 'test-cookie-secret-for-testing';
process.env.PORT = '5001';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Database configuration for tests
process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'tricitymatch_test';
process.env.DB_USER = process.env.TEST_DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'postgres';

// Disable external services in tests
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
process.env.EMAIL_HOST = '';
process.env.EMAIL_USER = '';
process.env.EMAIL_PASS = '';

// Increase timeout for database operations
jest.setTimeout(30000);

// Mock console methods to reduce noise (optional)
// Uncomment to suppress console output during tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Global test utilities
global.testUtils = {
  /**
   * Generate a random email for testing
   */
  randomEmail: () => `test.${Date.now()}.${Math.random().toString(36).substr(2, 9)}@test.com`,

  /**
   * Generate a random phone number for testing
   */
  randomPhone: () => `9${Math.floor(100000000 + Math.random() * 900000000)}`,

  /**
   * Wait for a specified time
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate test user data
   */
  generateUserData: (overrides = {}) => ({
    email: global.testUtils.randomEmail(),
    password: 'TestPass123!',
    firstName: 'Test',
    lastName: 'User',
    phone: global.testUtils.randomPhone(),
    dateOfBirth: '1995-05-15',
    gender: 'male',
    ...overrides
  }),

  /**
   * Generate test profile data
   */
  generateProfileData: (overrides = {}) => ({
    bio: 'Test bio for profile',
    city: 'Chandigarh',
    state: 'Punjab',
    height: 175,
    education: 'Graduate',
    profession: 'Engineer',
    diet: 'vegetarian',
    smoking: 'never',
    drinking: 'occasionally',
    ...overrides
  })
};

// Suppress unhandled promise rejection warnings in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
});

beforeAll(async () => {
  // Any global setup before all tests
});

afterAll(async () => {
  // Any global cleanup after all tests
});
