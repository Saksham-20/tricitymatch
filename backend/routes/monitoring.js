/**
 * Monitoring Routes
 * Health checks, metrics, and observability endpoints
 */

const express = require('express');
const router = express.Router();
const config = require('../config/env');
const { auth: authenticate, adminAuth } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');
const { getRedisClient } = require('../utils/cache');

// Health check utilities
const {
  livenessCheck,
  readinessCheck,
  fullHealthCheck
} = require('../utils/healthCheck');

// Metrics utilities
const {
  getPrometheusMetrics,
  getJsonMetrics
} = require('../utils/metrics');

// Queue utilities
const { getQueueStats } = require('../utils/queue');

// Cache utilities
const { getStats: getCacheStats } = require('../utils/cache');

// Alert utilities
const {
  getActiveAlerts,
  getAlertHistory,
  getAlertStats
} = require('../utils/alerts');

/**
 * @swagger
 * /monitoring/health:
 *   get:
 *     summary: Basic health check (liveness)
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/health', (req, res) => {
  const health = livenessCheck();
  res.json(health);
});

/**
 * @swagger
 * /monitoring/health/live:
 *   get:
 *     summary: Kubernetes liveness probe
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/health/live', (req, res) => {
  res.status(200).send('OK');
});

/**
 * @swagger
 * /monitoring/health/ready:
 *   get:
 *     summary: Kubernetes readiness probe
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Service is ready to accept traffic
 *       503:
 *         description: Service is not ready
 */
router.get('/health/ready', asyncHandler(async (req, res) => {
  const redisClient = getRedisClient();
  const health = await readinessCheck(redisClient);
  
  const statusCode = health.status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(health);
}));

/**
 * @swagger
 * /monitoring/health/full:
 *   get:
 *     summary: Full health check with all components
 *     tags: [Monitoring]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Full health report
 */
router.get('/health/full', asyncHandler(async (req, res) => {
  const redisClient = getRedisClient();
  const health = await fullHealthCheck(redisClient);
  
  // Add queue stats
  try {
    health.queues = await getQueueStats();
  } catch (error) {
    health.queues = { error: error.message };
  }
  
  // Add cache stats
  try {
    health.cache = await getCacheStats();
  } catch (error) {
    health.cache = { error: error.message };
  }
  
  res.json(health);
}));

/**
 * @swagger
 * /monitoring/metrics:
 *   get:
 *     summary: Prometheus metrics endpoint
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Prometheus-formatted metrics
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(getPrometheusMetrics());
});

/**
 * @swagger
 * /monitoring/metrics/json:
 *   get:
 *     summary: Metrics in JSON format
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: JSON metrics
 */
router.get('/metrics/json', (req, res) => {
  res.json(getJsonMetrics());
});

/**
 * @swagger
 * /monitoring/info:
 *   get:
 *     summary: Application info
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Application information
 */
router.get('/info', (req, res) => {
  res.json({
    name: 'TricityMatch API',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.env,
    nodeVersion: process.version,
    uptime: process.uptime(),
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    }
  });
});

/**
 * Debug endpoint (only in development)
 */
if (config.isDevelopment) {
  router.get('/debug', authenticate, adminAuth, asyncHandler(async (req, res) => {
    const redisClient = getRedisClient();
    
    res.json({
      environment: config.env,
      config: {
        database: {
          host: config.database.host,
          database: config.database.database,
          // Don't expose password
        },
        redis: config.redis?.url ? 'configured' : 'not configured',
        email: config.email?.host ? 'configured' : 'not configured',
        razorpay: config.razorpay?.keyId ? 'configured' : 'not configured',
        cloudinary: config.cloudinary?.cloudName ? 'configured' : 'not configured'
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: process.uptime()
      },
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      cache: await getCacheStats(),
      queues: await getQueueStats()
    });
  }));
}

/**
 * @swagger
 * /monitoring/alerts:
 *   get:
 *     summary: Get active alerts
 *     tags: [Monitoring]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of active alerts
 */
router.get('/alerts', authenticate, adminAuth, (req, res) => {
  res.json({
    active: getActiveAlerts(),
    stats: getAlertStats()
  });
});

/**
 * @swagger
 * /monitoring/alerts/history:
 *   get:
 *     summary: Get alert history
 *     tags: [Monitoring]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Alert history
 */
router.get('/alerts/history', authenticate, adminAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  res.json({
    history: getAlertHistory(limit),
    stats: getAlertStats()
  });
});

/**
 * @swagger
 * /monitoring/queues:
 *   get:
 *     summary: Get queue statistics
 *     tags: [Monitoring]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Queue statistics
 */
router.get('/queues', authenticate, adminAuth, asyncHandler(async (req, res) => {
  const stats = await getQueueStats();
  res.json(stats);
}));

/**
 * @swagger
 * /monitoring/cache:
 *   get:
 *     summary: Get cache statistics
 *     tags: [Monitoring]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics
 */
router.get('/cache', authenticate, adminAuth, asyncHandler(async (req, res) => {
  const stats = await getCacheStats();
  res.json(stats);
}));

module.exports = router;
