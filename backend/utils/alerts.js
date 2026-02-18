/**
 * Alerting System
 * Monitors application health and triggers alerts based on thresholds
 */

const { log } = require('../middlewares/logger');
const { STATUS } = require('./healthCheck');

/**
 * Alert severity levels
 */
const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

/**
 * Alert types
 */
const ALERT_TYPES = {
  HIGH_ERROR_RATE: 'high_error_rate',
  HIGH_LATENCY: 'high_latency',
  HIGH_MEMORY: 'high_memory',
  HIGH_CPU: 'high_cpu',
  DATABASE_SLOW: 'database_slow',
  DATABASE_DOWN: 'database_down',
  REDIS_DOWN: 'redis_down',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  AUTH_FAILURES: 'auth_failures',
  DISK_SPACE_LOW: 'disk_space_low',
  QUEUE_BACKLOG: 'queue_backlog'
};

/**
 * Default alert thresholds
 */
const DEFAULT_THRESHOLDS = {
  // Error rate (errors per minute)
  errorRateWarning: 10,
  errorRateCritical: 50,

  // Latency (ms)
  latencyP95Warning: 2000,
  latencyP95Critical: 5000,
  latencyP99Warning: 5000,
  latencyP99Critical: 10000,

  // Memory usage (percentage)
  memoryWarning: 80,
  memoryCritical: 95,

  // CPU usage (percentage)
  cpuWarning: 80,
  cpuCritical: 95,

  // Database
  databaseLatencyWarning: 100,
  databaseLatencyCritical: 500,

  // Disk space (percentage free)
  diskSpaceWarning: 20,
  diskSpaceCritical: 10,

  // Authentication failures (per minute)
  authFailuresWarning: 20,
  authFailuresCritical: 50,

  // Rate limiting (hits per minute)
  rateLimitWarning: 100,
  rateLimitCritical: 500,

  // Queue backlog
  queueBacklogWarning: 1000,
  queueBacklogCritical: 5000
};

// Active alerts storage
const activeAlerts = new Map();

// Alert history (last 100)
const alertHistory = [];
const MAX_HISTORY = 100;

// Alert handlers
const alertHandlers = [];

/**
 * Register an alert handler
 */
const registerAlertHandler = (handler) => {
  alertHandlers.push(handler);
};

/**
 * Trigger an alert
 */
const triggerAlert = async (type, severity, message, data = {}) => {
  const alertId = `${type}-${severity}`;
  const now = Date.now();

  // Check if alert is already active (debounce)
  if (activeAlerts.has(alertId)) {
    const existing = activeAlerts.get(alertId);
    // Update count but don't re-trigger within 5 minutes
    if (now - existing.lastTriggered < 5 * 60 * 1000) {
      existing.count++;
      existing.lastUpdated = now;
      return;
    }
  }

  const alert = {
    id: alertId,
    type,
    severity,
    message,
    data,
    timestamp: new Date().toISOString(),
    lastTriggered: now,
    lastUpdated: now,
    count: 1
  };

  activeAlerts.set(alertId, alert);

  // Add to history
  alertHistory.unshift(alert);
  if (alertHistory.length > MAX_HISTORY) {
    alertHistory.pop();
  }

  // Log the alert
  const logFn = severity === SEVERITY.CRITICAL ? log.error :
                severity === SEVERITY.WARNING ? log.warn : log.info;
  logFn(`Alert: ${message}`, {
    type: 'alert',
    alert
  });

  // Notify all handlers
  for (const handler of alertHandlers) {
    try {
      await handler(alert);
    } catch (error) {
      log.error('Alert handler failed', { error: error.message, alertId });
    }
  }

  return alert;
};

/**
 * Resolve an alert
 */
const resolveAlert = async (type, severity) => {
  const alertId = `${type}-${severity}`;
  
  if (activeAlerts.has(alertId)) {
    const alert = activeAlerts.get(alertId);
    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    activeAlerts.delete(alertId);

    log.info(`Alert resolved: ${alert.message}`, {
      type: 'alert_resolved',
      alert
    });

    return alert;
  }

  return null;
};

/**
 * Check metrics and trigger alerts
 */
const checkMetrics = async (metrics, thresholds = DEFAULT_THRESHOLDS) => {
  const alerts = [];

  // Check error rate
  if (metrics.errorRate !== undefined) {
    if (metrics.errorRate >= thresholds.errorRateCritical) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.HIGH_ERROR_RATE,
        SEVERITY.CRITICAL,
        `Critical error rate: ${metrics.errorRate} errors/min`,
        { errorRate: metrics.errorRate }
      ));
    } else if (metrics.errorRate >= thresholds.errorRateWarning) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.HIGH_ERROR_RATE,
        SEVERITY.WARNING,
        `High error rate: ${metrics.errorRate} errors/min`,
        { errorRate: metrics.errorRate }
      ));
    } else {
      resolveAlert(ALERT_TYPES.HIGH_ERROR_RATE, SEVERITY.WARNING);
      resolveAlert(ALERT_TYPES.HIGH_ERROR_RATE, SEVERITY.CRITICAL);
    }
  }

  // Check latency
  if (metrics.latencyP95 !== undefined) {
    if (metrics.latencyP95 >= thresholds.latencyP95Critical) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.HIGH_LATENCY,
        SEVERITY.CRITICAL,
        `Critical P95 latency: ${metrics.latencyP95}ms`,
        { latencyP95: metrics.latencyP95 }
      ));
    } else if (metrics.latencyP95 >= thresholds.latencyP95Warning) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.HIGH_LATENCY,
        SEVERITY.WARNING,
        `High P95 latency: ${metrics.latencyP95}ms`,
        { latencyP95: metrics.latencyP95 }
      ));
    } else {
      resolveAlert(ALERT_TYPES.HIGH_LATENCY, SEVERITY.WARNING);
      resolveAlert(ALERT_TYPES.HIGH_LATENCY, SEVERITY.CRITICAL);
    }
  }

  // Check memory
  if (metrics.memoryPercent !== undefined) {
    if (metrics.memoryPercent >= thresholds.memoryCritical) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.HIGH_MEMORY,
        SEVERITY.CRITICAL,
        `Critical memory usage: ${metrics.memoryPercent}%`,
        { memoryPercent: metrics.memoryPercent }
      ));
    } else if (metrics.memoryPercent >= thresholds.memoryWarning) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.HIGH_MEMORY,
        SEVERITY.WARNING,
        `High memory usage: ${metrics.memoryPercent}%`,
        { memoryPercent: metrics.memoryPercent }
      ));
    } else {
      resolveAlert(ALERT_TYPES.HIGH_MEMORY, SEVERITY.WARNING);
      resolveAlert(ALERT_TYPES.HIGH_MEMORY, SEVERITY.CRITICAL);
    }
  }

  // Check CPU
  if (metrics.cpuPercent !== undefined) {
    if (metrics.cpuPercent >= thresholds.cpuCritical) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.HIGH_CPU,
        SEVERITY.CRITICAL,
        `Critical CPU usage: ${metrics.cpuPercent}%`,
        { cpuPercent: metrics.cpuPercent }
      ));
    } else if (metrics.cpuPercent >= thresholds.cpuWarning) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.HIGH_CPU,
        SEVERITY.WARNING,
        `High CPU usage: ${metrics.cpuPercent}%`,
        { cpuPercent: metrics.cpuPercent }
      ));
    } else {
      resolveAlert(ALERT_TYPES.HIGH_CPU, SEVERITY.WARNING);
      resolveAlert(ALERT_TYPES.HIGH_CPU, SEVERITY.CRITICAL);
    }
  }

  // Check database
  if (metrics.databaseLatency !== undefined) {
    if (metrics.databaseLatency >= thresholds.databaseLatencyCritical) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.DATABASE_SLOW,
        SEVERITY.CRITICAL,
        `Critical database latency: ${metrics.databaseLatency}ms`,
        { databaseLatency: metrics.databaseLatency }
      ));
    } else if (metrics.databaseLatency >= thresholds.databaseLatencyWarning) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.DATABASE_SLOW,
        SEVERITY.WARNING,
        `High database latency: ${metrics.databaseLatency}ms`,
        { databaseLatency: metrics.databaseLatency }
      ));
    } else {
      resolveAlert(ALERT_TYPES.DATABASE_SLOW, SEVERITY.WARNING);
      resolveAlert(ALERT_TYPES.DATABASE_SLOW, SEVERITY.CRITICAL);
    }
  }

  // Check disk space
  if (metrics.diskFreePercent !== undefined) {
    if (metrics.diskFreePercent <= thresholds.diskSpaceCritical) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.DISK_SPACE_LOW,
        SEVERITY.CRITICAL,
        `Critical disk space: only ${metrics.diskFreePercent}% free`,
        { diskFreePercent: metrics.diskFreePercent }
      ));
    } else if (metrics.diskFreePercent <= thresholds.diskSpaceWarning) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.DISK_SPACE_LOW,
        SEVERITY.WARNING,
        `Low disk space: ${metrics.diskFreePercent}% free`,
        { diskFreePercent: metrics.diskFreePercent }
      ));
    } else {
      resolveAlert(ALERT_TYPES.DISK_SPACE_LOW, SEVERITY.WARNING);
      resolveAlert(ALERT_TYPES.DISK_SPACE_LOW, SEVERITY.CRITICAL);
    }
  }

  // Check authentication failures
  if (metrics.authFailures !== undefined) {
    if (metrics.authFailures >= thresholds.authFailuresCritical) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.AUTH_FAILURES,
        SEVERITY.CRITICAL,
        `Critical auth failure rate: ${metrics.authFailures}/min - possible brute force attack`,
        { authFailures: metrics.authFailures }
      ));
    } else if (metrics.authFailures >= thresholds.authFailuresWarning) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.AUTH_FAILURES,
        SEVERITY.WARNING,
        `High auth failure rate: ${metrics.authFailures}/min`,
        { authFailures: metrics.authFailures }
      ));
    } else {
      resolveAlert(ALERT_TYPES.AUTH_FAILURES, SEVERITY.WARNING);
      resolveAlert(ALERT_TYPES.AUTH_FAILURES, SEVERITY.CRITICAL);
    }
  }

  // Check rate limiting
  if (metrics.rateLimitHits !== undefined) {
    if (metrics.rateLimitHits >= thresholds.rateLimitCritical) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.RATE_LIMIT_EXCEEDED,
        SEVERITY.CRITICAL,
        `Critical rate limit hits: ${metrics.rateLimitHits}/min - possible DDoS`,
        { rateLimitHits: metrics.rateLimitHits }
      ));
    } else if (metrics.rateLimitHits >= thresholds.rateLimitWarning) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.RATE_LIMIT_EXCEEDED,
        SEVERITY.WARNING,
        `High rate limit hits: ${metrics.rateLimitHits}/min`,
        { rateLimitHits: metrics.rateLimitHits }
      ));
    } else {
      resolveAlert(ALERT_TYPES.RATE_LIMIT_EXCEEDED, SEVERITY.WARNING);
      resolveAlert(ALERT_TYPES.RATE_LIMIT_EXCEEDED, SEVERITY.CRITICAL);
    }
  }

  // Check queue backlog
  if (metrics.queueBacklog !== undefined) {
    if (metrics.queueBacklog >= thresholds.queueBacklogCritical) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.QUEUE_BACKLOG,
        SEVERITY.CRITICAL,
        `Critical queue backlog: ${metrics.queueBacklog} jobs waiting`,
        { queueBacklog: metrics.queueBacklog }
      ));
    } else if (metrics.queueBacklog >= thresholds.queueBacklogWarning) {
      alerts.push(await triggerAlert(
        ALERT_TYPES.QUEUE_BACKLOG,
        SEVERITY.WARNING,
        `High queue backlog: ${metrics.queueBacklog} jobs waiting`,
        { queueBacklog: metrics.queueBacklog }
      ));
    } else {
      resolveAlert(ALERT_TYPES.QUEUE_BACKLOG, SEVERITY.WARNING);
      resolveAlert(ALERT_TYPES.QUEUE_BACKLOG, SEVERITY.CRITICAL);
    }
  }

  return alerts.filter(Boolean);
};

/**
 * Check health status and trigger alerts
 */
const checkHealth = async (healthReport) => {
  const alerts = [];

  // Database health
  if (healthReport.database?.status === STATUS.UNHEALTHY) {
    alerts.push(await triggerAlert(
      ALERT_TYPES.DATABASE_DOWN,
      SEVERITY.CRITICAL,
      'Database is unhealthy',
      { database: healthReport.database }
    ));
  } else {
    resolveAlert(ALERT_TYPES.DATABASE_DOWN, SEVERITY.CRITICAL);
  }

  // Redis health
  if (healthReport.redis?.status === STATUS.UNHEALTHY) {
    alerts.push(await triggerAlert(
      ALERT_TYPES.REDIS_DOWN,
      SEVERITY.WARNING,
      'Redis is unhealthy',
      { redis: healthReport.redis }
    ));
  } else {
    resolveAlert(ALERT_TYPES.REDIS_DOWN, SEVERITY.WARNING);
  }

  return alerts.filter(Boolean);
};

/**
 * Get active alerts
 */
const getActiveAlerts = () => {
  return Array.from(activeAlerts.values());
};

/**
 * Get alert history
 */
const getAlertHistory = (limit = 50) => {
  return alertHistory.slice(0, limit);
};

/**
 * Get alert statistics
 */
const getAlertStats = () => {
  const stats = {
    active: {
      total: activeAlerts.size,
      bySeverity: {
        [SEVERITY.INFO]: 0,
        [SEVERITY.WARNING]: 0,
        [SEVERITY.CRITICAL]: 0
      }
    },
    history: {
      total: alertHistory.length,
      last24Hours: 0,
      byType: {}
    }
  };

  // Count active alerts by severity
  for (const alert of activeAlerts.values()) {
    stats.active.bySeverity[alert.severity]++;
  }

  // Count history
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const alert of alertHistory) {
    const alertTime = new Date(alert.timestamp).getTime();
    if (alertTime > oneDayAgo) {
      stats.history.last24Hours++;
    }
    stats.history.byType[alert.type] = (stats.history.byType[alert.type] || 0) + 1;
  }

  return stats;
};

/**
 * Clear all active alerts (for testing)
 */
const clearAlerts = () => {
  activeAlerts.clear();
  alertHistory.length = 0;
};

// Email alert handler
const emailAlertHandler = async (alert) => {
  // Only send emails for critical alerts
  if (alert.severity !== SEVERITY.CRITICAL) return;

  // Import dynamically to avoid circular dependencies
  const { addJob } = require('./queue');
  
  try {
    await addJob('email', 'alert', {
      alert,
      recipients: process.env.ALERT_EMAILS?.split(',') || []
    });
  } catch (error) {
    log.error('Failed to queue alert email', { error: error.message });
  }
};

// Register default handlers
registerAlertHandler(emailAlertHandler);

module.exports = {
  SEVERITY,
  ALERT_TYPES,
  DEFAULT_THRESHOLDS,
  triggerAlert,
  resolveAlert,
  checkMetrics,
  checkHealth,
  getActiveAlerts,
  getAlertHistory,
  getAlertStats,
  registerAlertHandler,
  clearAlerts
};
