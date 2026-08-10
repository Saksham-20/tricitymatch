/**
 * Authentication API Integration Tests
 * Tests for auth endpoints
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Mock the models before importing routes
jest.mock('../../models', () => {
  const mockUser = {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn()
  };
  
  const mockProfile = {
    create: jest.fn()
  };
  
  // Mirror every static the controller actually calls. A missing one (hashToken
  // was the culprit) surfaces as a 500 from inside the route, so the assertion
  // failure looked like a broken endpoint rather than a stale mock.
  const mockRefreshToken = {
    generateToken: jest.fn(() => 'refresh-token'),
    hashToken: jest.fn((token) => `hashed:${token}`),
    findValidToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    revokeFamily: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue([0]),
    destroy: jest.fn().mockResolvedValue(0)
  };
  
  return {
    User: mockUser,
    Profile: mockProfile,
    RefreshToken: mockRefreshToken,
    Subscription: { findOne: jest.fn() }
  };
});

// Mock database
jest.mock('../../config/database', () => ({
  transaction: jest.fn((callback) => callback({}))
}));

// Mock email
jest.mock('../../utils/email', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true)
}));

// Mock logger
jest.mock('../../middlewares/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  logSecurityEvent: jest.fn(),
  logAudit: jest.fn(),
  requestLogger: (req, res, next) => next()
}));

// Mock security middleware
// Any *Limiter export resolves to a pass-through middleware. Hand-listing them
// meant adding a new limiter to the real module silently broke this suite with
// "Route.post() requires a callback function but got [object Undefined]".
jest.mock('../../middlewares/security', () => {
  const passThrough = (req, res, next) => next();
  const explicit = {
    checkAccountLockout: passThrough,
    recordFailedLogin: jest.fn(),
    clearLoginAttempts: jest.fn(),
  };
  return new Proxy(explicit, {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      if (typeof prop === 'string' && prop.endsWith('Limiter')) return passThrough;
      return undefined;
    },
    has: () => true,
  });
});

const { User, Profile, RefreshToken } = require('../../models');
const bcrypt = require('bcryptjs');

// The controllers treat users as Sequelize instances — withDerivedUserFields()
// calls toJSON(), password reset calls save(). Plain object literals therefore
// blew up inside the route and every assertion just saw a 500. asInstance()
// gives a fixture the instance surface the code actually uses.
const asInstance = (attrs) => ({
  ...attrs,
  toJSON() {
    const { toJSON, save, update, get, comparePassword, ...rest } = this;
    return { ...rest };
  },
  save: jest.fn().mockResolvedValue(true),
  update: jest.fn().mockResolvedValue(true),
  get(key) { return key ? this[key] : this; },
});

describe('Auth API', () => {
  let app;

  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    // Import routes after mocks are set up
    const authRoutes = require('../../routes/authRoutes');
    app.use('/api/auth', authRoutes);
    
    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/signup', () => {
    const validSignupData = {
      email: 'test@example.com',
      password: 'StrongPass123!',
      firstName: 'John',
      lastName: 'Doe',
      phone: '9876543210',
      dateOfBirth: '1995-05-15',
      gender: 'male'
    };

    it('should create a new user with valid data', async () => {
      const mockCreatedUser = asInstance({
        id: 'user-uuid',
        email: validSignupData.email,
        firstName: validSignupData.firstName,
        lastName: validSignupData.lastName,
        role: 'user',
        status: 'active'
      });

      User.findOne.mockResolvedValue(null); // No existing user
      User.create.mockResolvedValue(mockCreatedUser);
      // signup/login re-read the user (with Profile) before responding
      User.findByPk.mockResolvedValue(mockCreatedUser);
      Profile.create.mockResolvedValue({});
      RefreshToken.generateToken.mockReturnValue('refresh-token');
      RefreshToken.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/signup')
        .send(validSignupData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(validSignupData.email);
    });

    it('should reject signup with existing email', async () => {
      User.findOne.mockResolvedValue({ id: 'existing-user' });

      const response = await request(app)
        .post('/api/auth/signup')
        .send(validSignupData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should reject signup with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          ...validSignupData,
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject signup with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          ...validSignupData,
          password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject signup for underage user', async () => {
      const today = new Date();
      const underageDate = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());

      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          ...validSignupData,
          dateOfBirth: underageDate.toISOString().split('T')[0]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('StrongPass123!', 10);
      const mockUser = asInstance({
        id: 'user-uuid',
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        status: 'active',
        comparePassword: jest.fn().mockResolvedValue(true)
      });

      User.findOne.mockResolvedValue(mockUser);
      User.findByPk.mockResolvedValue(mockUser);
      RefreshToken.generateToken.mockReturnValue('refresh-token');
      RefreshToken.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'StrongPass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const mockUser = asInstance({
        id: 'user-uuid',
        email: 'test@example.com',
        password: 'hashed-password',
        comparePassword: jest.fn().mockResolvedValue(false)
      });

      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login with non-existent email', async () => {
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login for inactive user', async () => {
      const mockUser = asInstance({
        id: 'user-uuid',
        email: 'test@example.com',
        password: 'hashed',
        status: 'banned',
        comparePassword: jest.fn().mockResolvedValue(true)
      });

      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'StrongPass123!'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send reset email for existing user', async () => {
      const mockUser = asInstance({
        id: 'user-uuid',
        email: 'test@example.com',
        firstName: 'John',
        password: 'hashed-password'
      });

      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should always return success to prevent email enumeration
    });

    it('should return success even for non-existent email', async () => {
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      // Should still return success to prevent email enumeration
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user data for authenticated user', async () => {
      const mockUser = asInstance({
        id: 'user-uuid',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        status: 'active',
        Profile: {
          city: 'Chandigarh',
          state: 'Punjab'
        }
      });

      User.findByPk.mockResolvedValue(mockUser);

      // Create a valid token
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { userId: 'user-uuid', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
