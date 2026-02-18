/**
 * Swagger/OpenAPI Configuration
 * API documentation setup
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TricityMatch API',
      version: '1.0.0',
      description: `
        TricityMatch Matrimonial Platform API Documentation
        
        ## Authentication
        Most endpoints require authentication via JWT tokens stored in httpOnly cookies.
        After successful login, the server sets access and refresh tokens as cookies.
        
        ## Rate Limiting
        API endpoints are rate-limited to prevent abuse:
        - Auth endpoints: 5 requests per minute
        - General API: 100 requests per minute
        - Search: 30 requests per minute
        
        ## Error Handling
        All errors follow a consistent format:
        \`\`\`json
        {
          "success": false,
          "message": "Error description",
          "type": "ERROR_TYPE"
        }
        \`\`\`
      `,
      contact: {
        name: 'TricityMatch Support',
        email: 'support@tricitymatch.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API Server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Profile', description: 'User profile management' },
      { name: 'Search', description: 'Profile search and discovery' },
      { name: 'Match', description: 'Matching and likes' },
      { name: 'Chat', description: 'Messaging between matches' },
      { name: 'Subscription', description: 'Premium subscription management' },
      { name: 'Admin', description: 'Administrative endpoints' },
      { name: 'Verification', description: 'Profile verification' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken',
          description: 'JWT access token stored in httpOnly cookie',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for backward compatibility',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['user', 'admin'] },
            status: { type: 'string', enum: ['active', 'suspended', 'deleted'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Profile: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            dateOfBirth: { type: 'string', format: 'date' },
            gender: { type: 'string', enum: ['male', 'female', 'other'] },
            bio: { type: 'string', maxLength: 2000 },
            city: { type: 'string' },
            state: { type: 'string' },
            height: { type: 'integer', minimum: 100, maximum: 250 },
            education: { type: 'string' },
            profession: { type: 'string' },
            diet: { type: 'string', enum: ['vegetarian', 'non-vegetarian', 'vegan', 'eggetarian'] },
            smoking: { type: 'string', enum: ['never', 'occasionally', 'regularly'] },
            drinking: { type: 'string', enum: ['never', 'occasionally', 'socially', 'regularly'] },
            profilePhoto: { type: 'string', format: 'uri' },
            photos: { type: 'array', items: { type: 'string', format: 'uri' } },
            completionPercentage: { type: 'integer', minimum: 0, maximum: 100 },
          },
        },
        Match: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            matchedUserId: { type: 'string', format: 'uuid' },
            actionType: { type: 'string', enum: ['like', 'shortlist', 'pass'] },
            isMutual: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            senderId: { type: 'string', format: 'uuid' },
            receiverId: { type: 'string', format: 'uuid' },
            content: { type: 'string', maxLength: 5000 },
            isRead: { type: 'boolean' },
            isEdited: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            planType: { type: 'string', enum: ['free', 'premium', 'elite'] },
            status: { type: 'string', enum: ['pending', 'active', 'expired', 'cancelled'] },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            amount: { type: 'number' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            type: { type: 'string' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Items per page',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        ForbiddenError: {
          description: 'Access denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      errors: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            field: { type: 'string' },
                            message: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  },
  apis: ['./routes/*.js', './docs/*.yaml'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
