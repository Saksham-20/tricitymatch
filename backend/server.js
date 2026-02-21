/**
 * TricityMatch Backend Server
 * Production-grade Express.js application
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');

// Load configuration (must be first)
const config = require('./config/env');

// Import middleware
const { 
  securityHeaders, 
  corsOptions, 
  apiLimiter,
  sanitizeRequest,
  requestId,
  extractIp 
} = require('./middlewares/security');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const logger = require('./middlewares/logger');

// Import routes and socket handler
const sequelize = require('./config/database');
const routes = require('./routes');
const monitoringRoutes = require('./routes/monitoring');
const initializeSocket = require('./socket/socketHandler');

// Import monitoring utilities
const { initRedis, close: closeCache } = require('./utils/cache');
const { initQueues, scheduleCleanupJobs, closeQueues } = require('./utils/queue');
const { metricsMiddleware, setGauge } = require('./utils/metrics');
const { requestPerformanceMiddleware } = require('./utils/performance');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with security configuration
const io = new Server(server, {
  cors: {
    origin: config.isProduction 
      ? config.server.frontendUrl 
      : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

initializeSocket(io);

// ==================== SECURITY MIDDLEWARE ====================

// Trust proxy (required for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Request ID for tracing
app.use(requestId);

// Extract real IP address
app.use(extractIp);

// Security headers (Helmet)
app.use(securityHeaders);

// CORS configuration
app.use(cors(corsOptions));

// Cookie parser with secret
app.use(cookieParser(config.security.cookieSecret));

// Compression
app.use(compression());

// ==================== BODY PARSING WITH SIZE LIMITS ====================

// Capture raw body for webhook signature verification (before JSON parsing)
app.use('/api/subscription/webhook', express.raw({ 
  type: 'application/json',
  limit: '10kb'
}), (req, res, next) => {
  req.rawBody = req.body;
  try {
    req.body = JSON.parse(req.body.toString());
  } catch (e) {
    req.body = {};
  }
  next();
});

// JSON body parser with size limit
app.use(express.json({ 
  limit: config.security.maxRequestSize,
  strict: true
}));

// URL-encoded body parser with size limit
app.use(express.urlencoded({ 
  extended: true, 
  limit: config.security.maxRequestSize 
}));

// Sanitize request data
app.use(sanitizeRequest);

// ==================== MONITORING & METRICS ====================

// Metrics collection middleware (before other middleware to capture all requests)
app.use(metricsMiddleware);

// Performance monitoring middleware
app.use(requestPerformanceMiddleware({
  slowThreshold: config.isProduction ? 3000 : 5000,
  logAll: config.isDevelopment
}));

// ==================== LOGGING ====================

// Request logging
if (config.isDevelopment) {
  app.use(logger);
} else {
  // Production logging - only errors and important requests
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (res.statusCode >= 400 || duration > 5000) {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          requestId: req.id,
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration,
          ip: req.clientIp,
          userId: req.user?.id
        }));
      }
    });
    next();
  });
}

// ==================== RATE LIMITING ====================

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// ==================== STATIC FILES ====================

// Serve uploaded files (with security headers)
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true,
  lastModified: true,
}));

// ==================== ROUTES ====================

// Monitoring routes (before rate limiting for health checks)
app.use('/monitoring', monitoringRoutes);
app.use('/api/monitoring', monitoringRoutes);

// API routes with version prefix
app.use('/api/v1', routes);
app.use('/api', routes); // Keep backward compatibility

// ==================== API DOCUMENTATION ====================

// Swagger UI (only in development or when explicitly enabled)
if (config.isDevelopment || process.env.ENABLE_SWAGGER === 'true') {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpec = require('./config/swagger');
  
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'TricityMatch API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    }
  }));
  
  // JSON spec endpoint
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  console.log('📚 API Documentation available at /api/docs');
}

// ==================== HEALTH CHECKS ====================
// Note: Comprehensive health checks are available at /monitoring/health/*

// Simple health check endpoint (for load balancers)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env
  });
});

// Readiness check (includes database)
app.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      error: config.isDevelopment ? error.message : 'Database connection failed'
    });
  }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ==================== DATABASE & SERVER STARTUP ====================

const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    // Sync models in development (use migrations in production)
    if (config.isDevelopment) {
      await sequelize.sync({ alter: false });
      console.log('✓ Database models synced');
    }

    // Initialize Redis cache (optional - degrades gracefully)
    try {
      await initRedis();
      console.log('✓ Redis cache initialized');
    } catch (error) {
      console.log('⚠ Redis not available, using in-memory cache');
    }

    // Initialize background job queues
    try {
      await initQueues();
      await scheduleCleanupJobs();
      console.log('✓ Background job queues initialized');
    } catch (error) {
      console.log('⚠ Job queues not available, using in-memory queue');
    }

    // Track socket connections in metrics
    io.on('connection', () => {
      setGauge('socketConnections', io.engine.clientsCount);
    });
    io.on('disconnect', () => {
      setGauge('socketConnections', io.engine.clientsCount);
    });

    // Start server
    server.listen(config.server.port, () => {
      const cloudinaryStatus = config.cloudinary?.isConfigured?.()
        ? 'Cloudinary: configured'
        : 'Cloudinary: NOT configured (local disk)';
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                  TricityMatch Server                       ║
╠════════════════════════════════════════════════════════════╣
║  Status:      Running                                      ║
║  Environment: ${config.env.padEnd(43)}║
║  Port:        ${String(config.server.port).padEnd(43)}║
║  Frontend:    ${config.server.frontendUrl.substring(0, 43).padEnd(43)}║
║  ${cloudinaryStatus.padEnd(54)}║
║  Monitoring:  /monitoring/health, /monitoring/metrics      ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('✗ Unable to start server:', error);
    process.exit(1);
  }
};

// ==================== GRACEFUL SHUTDOWN ====================

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received: starting graceful shutdown`);
  
  // Close server to stop accepting new connections
  server.close(async () => {
    console.log('✓ HTTP server closed');
    
    // Close socket connections
    io.close(() => {
      console.log('✓ Socket.io connections closed');
    });
    
    // Close background job queues
    try {
      await closeQueues();
      console.log('✓ Job queues closed');
    } catch (error) {
      console.error('✗ Error closing job queues:', error);
    }
    
    // Close Redis cache
    try {
      await closeCache();
      console.log('✓ Cache connections closed');
    } catch (error) {
      console.error('✗ Error closing cache:', error);
    }
    
    // Close database connection
    try {
      await sequelize.close();
      console.log('✓ Database connection closed');
    } catch (error) {
      console.error('✗ Error closing database:', error);
    }
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, but log for monitoring
});

// Start the server
startServer();

module.exports = { app, server, io };
