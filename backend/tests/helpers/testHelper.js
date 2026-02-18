/**
 * Test Helper Utilities
 * Common utilities for integration and unit tests
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Create a test JWT token
 */
const createTestToken = (userId, type = 'access', expiresIn = '15m') => {
  return jwt.sign(
    { userId, type },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Create an expired test token
 */
const createExpiredToken = (userId, type = 'access') => {
  return jwt.sign(
    { userId, type },
    process.env.JWT_SECRET,
    { expiresIn: '-1s' }
  );
};

/**
 * Hash a password for testing
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, 10);
};

/**
 * Create test user in database
 */
const createTestUser = async (User, Profile, overrides = {}) => {
  const userData = {
    email: global.testUtils.randomEmail(),
    password: await hashPassword('TestPass123!'),
    firstName: 'Test',
    lastName: 'User',
    phone: global.testUtils.randomPhone(),
    role: 'user',
    status: 'active',
    ...overrides
  };

  const user = await User.create(userData);
  
  // Create associated profile
  await Profile.create({
    userId: user.id,
    dateOfBirth: '1995-05-15',
    gender: overrides.gender || 'male',
    city: 'Chandigarh',
    state: 'Punjab',
  });

  return user;
};

/**
 * Create test admin user
 */
const createTestAdmin = async (User, Profile) => {
  return createTestUser(User, Profile, {
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User'
  });
};

/**
 * Create test subscription
 */
const createTestSubscription = async (Subscription, userId, planType = 'premium') => {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 30);

  return Subscription.create({
    userId,
    planType,
    status: 'active',
    startDate: now,
    endDate,
    amount: planType === 'elite' ? 4999 : 2999
  });
};

/**
 * Clean up test data
 */
const cleanupTestData = async (models) => {
  const { User, Profile, Match, Message, Subscription, RefreshToken, Verification, ProfileView } = models;
  
  // Delete in order to respect foreign key constraints
  await Message?.destroy({ where: {}, force: true });
  await Match?.destroy({ where: {}, force: true });
  await RefreshToken?.destroy({ where: {}, force: true });
  await Subscription?.destroy({ where: {}, force: true });
  await Verification?.destroy({ where: {}, force: true });
  await ProfileView?.destroy({ where: {}, force: true });
  await Profile?.destroy({ where: {}, force: true });
  await User?.destroy({ where: {}, force: true });
};

/**
 * Mock request object
 */
const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  cookies: {},
  user: null,
  ip: '127.0.0.1',
  get: jest.fn((header) => overrides.headers?.[header]),
  ...overrides
});

/**
 * Mock response object
 */
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock next function
 */
const mockNext = () => jest.fn();

/**
 * Assert error response
 */
const expectErrorResponse = (res, statusCode, messagePattern = null) => {
  expect(res.status).toHaveBeenCalledWith(statusCode);
  expect(res.json).toHaveBeenCalled();
  
  const responseData = res.json.mock.calls[0][0];
  expect(responseData.success).toBe(false);
  
  if (messagePattern) {
    expect(responseData.message).toMatch(messagePattern);
  }
};

/**
 * Assert success response
 */
const expectSuccessResponse = (res, statusCode = 200) => {
  expect(res.status).toHaveBeenCalledWith(statusCode);
  expect(res.json).toHaveBeenCalled();
  
  const responseData = res.json.mock.calls[0][0];
  expect(responseData.success).toBe(true);
};

module.exports = {
  createTestToken,
  createExpiredToken,
  hashPassword,
  createTestUser,
  createTestAdmin,
  createTestSubscription,
  cleanupTestData,
  mockRequest,
  mockResponse,
  mockNext,
  expectErrorResponse,
  expectSuccessResponse
};
