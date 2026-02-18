/**
 * Health Check System
 * Comprehensive health monitoring for production readiness
 */

const sequelize = require('../config/database');
const config = require('../config/env');

// Health check status constants
const STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
};

// Track application start time
const startTime = Date.now();

/**
 * Check database connectivity and performance
 */
const checkDatabase = async () => {
  const start = Date.now();
  
  try {
    await sequelize.authenticate();
    const duration = Date.now() - start;
    
    // Check connection pool status
    const pool = sequelize.connectionManager.pool;
    const poolInfo = pool ? {
      size: pool.size,
      available: pool.available,
      pending: pool.pending,
      max: pool.max,
      min: pool.min
    } : null;

    return {
      status: duration < 1000 ? STATUS.HEALTHY : STATUS.DEGRADED,
      responseTime: duration,
      pool: poolInfo,
      message: duration < 1000 ? 'Database connection healthy' : 'Database response slow'
    };
  } catch (error) {
    return {
      status: STATUS.UNHEALTHY,
      responseTime: Date.now() - start,
      error: error.message,
      message: 'Database connection failed'
    };
  }
};

/**
 * Check Redis connectivity (if configured)
 */
const checkRedis = async (redisClient) => {
  if (!redisClient) {
    return {
      status: STATUS.HEALTHY,
      message: 'Redis not configured (optional)'
    };
  }

  const start = Date.now();
  
  try {
    await redisClient.ping();
    const duration = Date.now() - start;
    
    const info = await redisClient.info('memory');
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const usedMemory = memoryMatch ? memoryMatch[1] : 'unknown';

    return {
      status: duration < 100 ? STATUS.HEALTHY : STATUS.DEGRADED,
      responseTime: duration,
      memory: usedMemory,
      message: 'Redis connection healthy'
    };
  } catch (error) {
    return {
      status: STATUS.UNHEALTHY,
      responseTime: Date.now() - start,
      error: error.message,
      message: 'Redis connection failed'
    };
  }
};

/**
 * Check memory usage
 */
const checkMemory = () => {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  const heapUsagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  // Consider unhealthy if heap usage > 90%
  const status = heapUsagePercent > 90 
    ? STATUS.UNHEALTHY 
    : heapUsagePercent > 75 
      ? STATUS.DEGRADED 
      : STATUS.HEALTHY;

  return {
    status,
    heapUsed: `${heapUsedMB}MB`,
    heapTotal: `${heapTotalMB}MB`,
    rss: `${rssMB}MB`,
    heapUsagePercent: `${heapUsagePercent}%`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  };
};

/**
 * Check CPU usage
 */
const checkCPU = () => {
  const cpuUsage = process.cpuUsage();
  const uptimeSeconds = process.uptime();
  
  // Calculate CPU percentage (rough estimate)
  const userCPUPercent = ((cpuUsage.user / 1000000) / uptimeSeconds * 100).toFixed(2);
  const systemCPUPercent = ((cpuUsage.system / 1000000) / uptimeSeconds * 100).toFixed(2);

  return {
    status: STATUS.HEALTHY,
    userCPU: `${userCPUPercent}%`,
    systemCPU: `${systemCPUPercent}%`,
    uptime: `${Math.round(uptimeSeconds)}s`
  };
};

/**
 * Check disk space (simplified - checks uploads directory)
 */
const checkDiskSpace = async () => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    
    // Just check if we can write to uploads directory
    const testFile = path.join(uploadsDir, '.health-check');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);

    return {
      status: STATUS.HEALTHY,
      message: 'Disk write access OK'
    };
  } catch (error) {
    return {
      status: STATUS.DEGRADED,
      message: 'Disk write check failed',
      error: error.message
    };
  }
};

/**
 * Basic liveness check - is the app running?
 */
const livenessCheck = () => {
  return {
    status: STATUS.HEALTHY,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  };
};

/**
 * Readiness check - is the app ready to receive traffic?
 */
const readinessCheck = async (redisClient = null) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(redisClient)
  };

  // Overall status is unhealthy if database is unhealthy
  const overallStatus = checks.database.status === STATUS.UNHEALTHY
    ? STATUS.UNHEALTHY
    : Object.values(checks).some(c => c.status === STATUS.DEGRADED)
      ? STATUS.DEGRADED
      : STATUS.HEALTHY;

  return {
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString()
  };
};

/**
 * Full health check with all components
 */
const fullHealthCheck = async (redisClient = null) => {
  const [database, redis] = await Promise.all([
    checkDatabase(),
    checkRedis(redisClient)
  ]);

  const memory = checkMemory();
  const cpu = checkCPU();
  const disk = await checkDiskSpace();

  const checks = { database, redis, memory, cpu, disk };

  // Determine overall status
  const statuses = Object.values(checks).map(c => c.status);
  const overallStatus = statuses.includes(STATUS.UNHEALTHY)
    ? STATUS.UNHEALTHY
    : statuses.includes(STATUS.DEGRADED)
      ? STATUS.DEGRADED
      : STATUS.HEALTHY;

  return {
    status: overallStatus,
    version: process.env.npm_package_version || '1.0.0',
    environment: config.env,
    uptime: process.uptime(),
    uptimeFormatted: formatUptime(process.uptime()),
    startedAt: new Date(startTime).toISOString(),
    timestamp: new Date().toISOString(),
    checks
  };
};

/**
 * Format uptime to human readable string
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
};

module.exports = {
  STATUS,
  checkDatabase,
  checkRedis,
  checkMemory,
  checkCPU,
  checkDiskSpace,
  livenessCheck,
  readinessCheck,
  fullHealthCheck,
  formatUptime
};
