/**
 * Error Handler Unit Tests
 * Tests for centralized error handling
 */

const { 
  AppError, 
  createError, 
  ErrorTypes,
  errorHandler,
  asyncHandler 
} = require('../../middlewares/errorHandler');
const { mockRequest, mockResponse, mockNext } = require('../helpers/testHelper');

describe('Error Handler', () => {
  describe('AppError', () => {
    it('should create an error with correct properties', () => {
      const error = new AppError('Test error', 400, 'VALIDATION_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should have default values', () => {
      const error = new AppError('Test error');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('ERROR');
    });
  });

  describe('createError factory', () => {
    it('should create badRequest error (400)', () => {
      const error = createError.badRequest('Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe(ErrorTypes.BAD_REQUEST);
    });

    it('should create unauthorized error (401)', () => {
      const error = createError.unauthorized('Not logged in');

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Not logged in');
      expect(error.code).toBe(ErrorTypes.AUTHENTICATION_ERROR);
    });

    it('should create forbidden error (403)', () => {
      const error = createError.forbidden('Access denied');

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe(ErrorTypes.AUTHORIZATION_ERROR);
    });

    it('should create notFound error (404)', () => {
      const error = createError.notFound('Resource not found');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe(ErrorTypes.NOT_FOUND);
    });

    it('should create conflict error (409)', () => {
      const error = createError.conflict('Already exists');

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Already exists');
      expect(error.code).toBe(ErrorTypes.CONFLICT);
    });

    it('should create rateLimit error (429)', () => {
      const error = createError.rateLimit('Rate limited');

      expect(error.statusCode).toBe(429);
      expect(error.message).toBe('Rate limited');
      expect(error.code).toBe(ErrorTypes.RATE_LIMIT);
    });

    it('should create internal error (500)', () => {
      const error = createError.internal('Server error');

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Server error');
      expect(error.code).toBe(ErrorTypes.INTERNAL_ERROR);
    });
  });

  describe('errorHandler middleware', () => {
    let req, res, next;

    // config env flags are resolved once at module load, so toggling
    // process.env.NODE_ENV at runtime has no effect — re-require the handler
    // with a mocked config to exercise dev vs prod branches.
    const loadHandlerWith = (flags) => {
      jest.resetModules();
      jest.doMock('../../config/env', () => ({
        isProduction: false,
        isDevelopment: false,
        isTest: true,
        upload: { maxFileSize: 5 * 1024 * 1024 },
        ...flags,
      }));
      return require('../../middlewares/errorHandler');
    };

    afterEach(() => {
      jest.resetModules();
      jest.dontMock('../../config/env');
    });

    beforeEach(() => {
      req = mockRequest({ ip: '127.0.0.1' });
      res = mockResponse();
      next = mockNext();
    });

    it('should handle AppError correctly', () => {
      const error = new AppError('Custom error', 400, ErrorTypes.VALIDATION_ERROR);

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: ErrorTypes.VALIDATION_ERROR,
          message: 'Custom error',
        }),
      }));
    });

    it('should handle generic Error as 500', () => {
      const error = new Error('Unexpected error');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
      }));
    });

    it('should include stack trace in development', () => {
      const { errorHandler: devHandler, AppError: DevAppError } = loadHandlerWith({ isDevelopment: true });
      const error = new DevAppError('Test error', 400);

      devHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.error.stack).toBeDefined();
    });

    it('should not include stack trace in production', () => {
      const { errorHandler: prodHandler, AppError: ProdAppError } = loadHandlerWith({ isProduction: true });
      const error = new ProdAppError('Test error', 400);

      prodHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.error.stack).toBeUndefined();
    });
  });

  describe('asyncHandler', () => {
    it('should pass through successful async operations', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      
      const asyncFn = asyncHandler(async (req, res) => {
        res.json({ success: true });
      });
      
      await asyncFn(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch errors and pass to next', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      
      const error = new Error('Async error');
      const asyncFn = asyncHandler(async () => {
        throw error;
      });
      
      await asyncFn(req, res, next);
      
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
