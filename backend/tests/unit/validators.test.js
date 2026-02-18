/**
 * Validators Unit Tests
 * Tests for input validation schemas
 */

const { validationResult } = require('express-validator');
const { mockRequest, mockResponse, mockNext } = require('../helpers/testHelper');
const validators = require('../../validators');

// Helper to run validation and get errors
const runValidation = async (validationArray, reqData) => {
  const req = mockRequest(reqData);
  const res = mockResponse();

  // Run each validator
  for (const validation of validationArray) {
    await validation.run(req);
  }

  return validationResult(req);
};

describe('Validators', () => {
  describe('signupValidation', () => {
    it('should pass with valid signup data', async () => {
      const result = await runValidation(validators.signupValidation, {
        body: {
          email: 'test@example.com',
          password: 'StrongPass123!',
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          dateOfBirth: '1995-05-15',
          gender: 'male'
        }
      });

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid email', async () => {
      const result = await runValidation(validators.signupValidation, {
        body: {
          email: 'invalid-email',
          password: 'StrongPass123!',
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          dateOfBirth: '1995-05-15',
          gender: 'male'
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'email')).toBe(true);
    });

    it('should fail with weak password', async () => {
      const result = await runValidation(validators.signupValidation, {
        body: {
          email: 'test@example.com',
          password: 'weak',
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          dateOfBirth: '1995-05-15',
          gender: 'male'
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'password')).toBe(true);
    });

    it('should fail with invalid phone number', async () => {
      const result = await runValidation(validators.signupValidation, {
        body: {
          email: 'test@example.com',
          password: 'StrongPass123!',
          firstName: 'John',
          lastName: 'Doe',
          phone: '12345', // Invalid phone
          dateOfBirth: '1995-05-15',
          gender: 'male'
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'phone')).toBe(true);
    });

    it('should fail with underage date of birth', async () => {
      const today = new Date();
      const underageDate = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
      
      const result = await runValidation(validators.signupValidation, {
        body: {
          email: 'test@example.com',
          password: 'StrongPass123!',
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          dateOfBirth: underageDate.toISOString().split('T')[0],
          gender: 'male'
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'dateOfBirth')).toBe(true);
    });

    it('should fail with invalid gender', async () => {
      const result = await runValidation(validators.signupValidation, {
        body: {
          email: 'test@example.com',
          password: 'StrongPass123!',
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          dateOfBirth: '1995-05-15',
          gender: 'invalid'
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'gender')).toBe(true);
    });
  });

  describe('loginValidation', () => {
    it('should pass with valid login data', async () => {
      const result = await runValidation(validators.loginValidation, {
        body: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with missing email', async () => {
      const result = await runValidation(validators.loginValidation, {
        body: {
          password: 'password123'
        }
      });

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail with missing password', async () => {
      const result = await runValidation(validators.loginValidation, {
        body: {
          email: 'test@example.com'
        }
      });

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('updateProfileValidation', () => {
    it('should pass with valid profile update data', async () => {
      const result = await runValidation(validators.updateProfileValidation, {
        body: {
          bio: 'A short bio about myself',
          city: 'Chandigarh',
          state: 'Punjab',
          height: 175,
          diet: 'vegetarian'
        }
      });

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with bio exceeding max length', async () => {
      const result = await runValidation(validators.updateProfileValidation, {
        body: {
          bio: 'a'.repeat(2001) // Exceeds 2000 char limit
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'bio')).toBe(true);
    });

    it('should fail with invalid height', async () => {
      const result = await runValidation(validators.updateProfileValidation, {
        body: {
          height: 50 // Below minimum
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'height')).toBe(true);
    });

    it('should fail with invalid diet option', async () => {
      const result = await runValidation(validators.updateProfileValidation, {
        body: {
          diet: 'invalid-diet'
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'diet')).toBe(true);
    });
  });

  describe('sendMessageValidation', () => {
    it('should pass with valid message data', async () => {
      const result = await runValidation(validators.sendMessageValidation, {
        body: {
          receiverId: '550e8400-e29b-41d4-a716-446655440000',
          content: 'Hello, how are you?'
        }
      });

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with empty content', async () => {
      const result = await runValidation(validators.sendMessageValidation, {
        body: {
          receiverId: '550e8400-e29b-41d4-a716-446655440000',
          content: ''
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'content')).toBe(true);
    });

    it('should fail with invalid UUID', async () => {
      const result = await runValidation(validators.sendMessageValidation, {
        body: {
          receiverId: 'not-a-uuid',
          content: 'Hello'
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'receiverId')).toBe(true);
    });
  });

  describe('searchValidation', () => {
    it('should pass with valid search parameters', async () => {
      const result = await runValidation(validators.searchValidation, {
        query: {
          minAge: '25',
          maxAge: '35',
          gender: 'female',
          city: 'Chandigarh'
        }
      });

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with minAge greater than maxAge', async () => {
      const result = await runValidation(validators.searchValidation, {
        query: {
          minAge: '40',
          maxAge: '30'
        }
      });

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail with negative age', async () => {
      const result = await runValidation(validators.searchValidation, {
        query: {
          minAge: '-5'
        }
      });

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('matchActionValidation', () => {
    it('should pass with valid like action', async () => {
      const result = await runValidation(validators.matchActionValidation, {
        params: {
          userId: '550e8400-e29b-41d4-a716-446655440000'
        },
        body: {
          action: 'like'
        }
      });

      expect(result.isEmpty()).toBe(true);
    });

    it('should pass with valid shortlist action', async () => {
      const result = await runValidation(validators.matchActionValidation, {
        params: {
          userId: '550e8400-e29b-41d4-a716-446655440000'
        },
        body: {
          action: 'shortlist'
        }
      });

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid action', async () => {
      const result = await runValidation(validators.matchActionValidation, {
        params: {
          userId: '550e8400-e29b-41d4-a716-446655440000'
        },
        body: {
          action: 'invalid'
        }
      });

      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(e => e.path === 'action')).toBe(true);
    });
  });

  describe('paginationRules', () => {
    it('should pass with valid pagination', async () => {
      const result = await runValidation(validators.paginationRules, {
        query: {
          page: '1',
          limit: '20'
        }
      });

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with negative page', async () => {
      const result = await runValidation(validators.paginationRules, {
        query: {
          page: '-1'
        }
      });

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail with limit exceeding maximum', async () => {
      const result = await runValidation(validators.paginationRules, {
        query: {
          limit: '200' // Exceeds max of 100
        }
      });

      expect(result.isEmpty()).toBe(false);
    });
  });
});
