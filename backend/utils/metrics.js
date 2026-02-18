/**
 * Application Metrics
 * Prometheus-compatible metrics collection
 */

// In-memory metrics storage
const metrics = {
  // HTTP metrics
  httpRequestsTotal: new Map(), // { method_path_status: count }
  httpRequestDuration: [], // Array of { method, path, status, duration }
  
  // Business metrics
  signupsTotal: 0,
  loginsTotal: 0,
  loginFailuresTotal: 0,
  matchesCreated: 0,
  messagessSent: 0,
  subscriptionsActivated: 0,
  
  // System metrics
  activeConnections: 0,
  socketConnections: 0,
  
  // Error metrics
  errorsTotal: new Map(), // { type: count }
  
  // Cache metrics
  cacheHits: 0,
  cacheMisses: 0,
  
  // Rate limit metrics
  rateLimitHits: 0
};

// Keep only last N duration samples
const MAX_DURATION_SAMPLES = 10000;

/**
 * Record HTTP request metrics
 */
const recordHttpRequest = (method, path, statusCode, durationMs) => {
  // Normalize path (remove IDs)
  const normalizedPath = normalizePath(path);
  const key = `${method}_${normalizedPath}_${statusCode}`;
  
  // Increment counter
  const current = metrics.httpRequestsTotal.get(key) || 0;
  metrics.httpRequestsTotal.set(key, current + 1);
  
  // Record duration
  metrics.httpRequestDuration.push({
    method,
    path: normalizedPath,
    status: statusCode,
    duration: durationMs,
    timestamp: Date.now()
  });
  
  // Trim old samples
  if (metrics.httpRequestDuration.length > MAX_DURATION_SAMPLES) {
    metrics.httpRequestDuration = metrics.httpRequestDuration.slice(-MAX_DURATION_SAMPLES);
  }
};

/**
 * Normalize path by replacing UUIDs and IDs with placeholders
 */
const normalizePath = (path) => {
  return path
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Remove query string
    .split('?')[0];
};

/**
 * Increment business metric
 */
const incrementMetric = (metricName, value = 1) => {
  if (typeof metrics[metricName] === 'number') {
    metrics[metricName] += value;
  }
};

/**
 * Record error
 */
const recordError = (errorType) => {
  const current = metrics.errorsTotal.get(errorType) || 0;
  metrics.errorsTotal.set(errorType, current + 1);
};

/**
 * Set gauge metric
 */
const setGauge = (metricName, value) => {
  if (metricName in metrics) {
    metrics[metricName] = value;
  }
};

/**
 * Record cache hit/miss
 */
const recordCacheAccess = (hit) => {
  if (hit) {
    metrics.cacheHits++;
  } else {
    metrics.cacheMisses++;
  }
};

/**
 * Calculate percentile from duration samples
 */
const calculatePercentile = (samples, percentile) => {
  if (samples.length === 0) return 0;
  
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

/**
 * Get HTTP latency statistics
 */
const getLatencyStats = (method = null, path = null, timeWindowMs = 60000) => {
  const now = Date.now();
  const cutoff = now - timeWindowMs;
  
  let samples = metrics.httpRequestDuration
    .filter(s => s.timestamp >= cutoff);
  
  if (method) {
    samples = samples.filter(s => s.method === method);
  }
  if (path) {
    samples = samples.filter(s => s.path === path);
  }
  
  const durations = samples.map(s => s.duration);
  
  if (durations.length === 0) {
    return { count: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  }
  
  return {
    count: durations.length,
    avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    p50: calculatePercentile(durations, 50),
    p95: calculatePercentile(durations, 95),
    p99: calculatePercentile(durations, 99),
    max: Math.max(...durations)
  };
};

/**
 * Get metrics in Prometheus format
 */
const getPrometheusMetrics = () => {
  const lines = [];
  const timestamp = Date.now();
  
  // HTTP request counters
  lines.push('# HELP http_requests_total Total number of HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, value] of metrics.httpRequestsTotal) {
    const [method, path, status] = key.split('_');
    lines.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${value}`);
  }
  
  // HTTP latency histogram (simplified)
  const latency = getLatencyStats();
  lines.push('# HELP http_request_duration_ms HTTP request duration in milliseconds');
  lines.push('# TYPE http_request_duration_ms summary');
  lines.push(`http_request_duration_ms{quantile="0.5"} ${latency.p50}`);
  lines.push(`http_request_duration_ms{quantile="0.95"} ${latency.p95}`);
  lines.push(`http_request_duration_ms{quantile="0.99"} ${latency.p99}`);
  lines.push(`http_request_duration_ms_count ${latency.count}`);
  
  // Business metrics
  lines.push('# HELP signups_total Total user signups');
  lines.push('# TYPE signups_total counter');
  lines.push(`signups_total ${metrics.signupsTotal}`);
  
  lines.push('# HELP logins_total Total successful logins');
  lines.push('# TYPE logins_total counter');
  lines.push(`logins_total ${metrics.loginsTotal}`);
  
  lines.push('# HELP login_failures_total Total failed login attempts');
  lines.push('# TYPE login_failures_total counter');
  lines.push(`login_failures_total ${metrics.loginFailuresTotal}`);
  
  lines.push('# HELP matches_created_total Total matches created');
  lines.push('# TYPE matches_created_total counter');
  lines.push(`matches_created_total ${metrics.matchesCreated}`);
  
  lines.push('# HELP messages_sent_total Total messages sent');
  lines.push('# TYPE messages_sent_total counter');
  lines.push(`messages_sent_total ${metrics.messagessSent}`);
  
  lines.push('# HELP subscriptions_activated_total Total subscriptions activated');
  lines.push('# TYPE subscriptions_activated_total counter');
  lines.push(`subscriptions_activated_total ${metrics.subscriptionsActivated}`);
  
  // Connection metrics
  lines.push('# HELP active_connections Current active HTTP connections');
  lines.push('# TYPE active_connections gauge');
  lines.push(`active_connections ${metrics.activeConnections}`);
  
  lines.push('# HELP socket_connections Current WebSocket connections');
  lines.push('# TYPE socket_connections gauge');
  lines.push(`socket_connections ${metrics.socketConnections}`);
  
  // Cache metrics
  lines.push('# HELP cache_hits_total Cache hits');
  lines.push('# TYPE cache_hits_total counter');
  lines.push(`cache_hits_total ${metrics.cacheHits}`);
  
  lines.push('# HELP cache_misses_total Cache misses');
  lines.push('# TYPE cache_misses_total counter');
  lines.push(`cache_misses_total ${metrics.cacheMisses}`);
  
  // Error metrics
  lines.push('# HELP errors_total Total errors by type');
  lines.push('# TYPE errors_total counter');
  for (const [type, count] of metrics.errorsTotal) {
    lines.push(`errors_total{type="${type}"} ${count}`);
  }
  
  // Rate limit metrics
  lines.push('# HELP rate_limit_hits_total Rate limit triggers');
  lines.push('# TYPE rate_limit_hits_total counter');
  lines.push(`rate_limit_hits_total ${metrics.rateLimitHits}`);
  
  // Process metrics
  const memory = process.memoryUsage();
  lines.push('# HELP process_memory_heap_bytes Process heap memory');
  lines.push('# TYPE process_memory_heap_bytes gauge');
  lines.push(`process_memory_heap_bytes ${memory.heapUsed}`);
  
  lines.push('# HELP process_memory_rss_bytes Process RSS memory');
  lines.push('# TYPE process_memory_rss_bytes gauge');
  lines.push(`process_memory_rss_bytes ${memory.rss}`);
  
  lines.push('# HELP process_uptime_seconds Process uptime');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${Math.round(process.uptime())}`);
  
  return lines.join('\n');
};

/**
 * Get metrics in JSON format
 */
const getJsonMetrics = () => {
  const latency = getLatencyStats();
  const memory = process.memoryUsage();
  
  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    http: {
      requests: Object.fromEntries(metrics.httpRequestsTotal),
      latency
    },
    business: {
      signups: metrics.signupsTotal,
      logins: metrics.loginsTotal,
      loginFailures: metrics.loginFailuresTotal,
      matchesCreated: metrics.matchesCreated,
      messagesSent: metrics.messagessSent,
      subscriptionsActivated: metrics.subscriptionsActivated
    },
    connections: {
      active: metrics.activeConnections,
      websocket: metrics.socketConnections
    },
    cache: {
      hits: metrics.cacheHits,
      misses: metrics.cacheMisses,
      hitRate: metrics.cacheHits + metrics.cacheMisses > 0
        ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(2) + '%'
        : 'N/A'
    },
    errors: Object.fromEntries(metrics.errorsTotal),
    rateLimitHits: metrics.rateLimitHits,
    memory: {
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`
    }
  };
};

/**
 * Express middleware to collect HTTP metrics
 */
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  metrics.activeConnections++;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    recordHttpRequest(req.method, req.path, res.statusCode, duration);
    metrics.activeConnections--;
  });
  
  next();
};

/**
 * Reset metrics (useful for testing)
 */
const resetMetrics = () => {
  metrics.httpRequestsTotal.clear();
  metrics.httpRequestDuration = [];
  metrics.signupsTotal = 0;
  metrics.loginsTotal = 0;
  metrics.loginFailuresTotal = 0;
  metrics.matchesCreated = 0;
  metrics.messagessSent = 0;
  metrics.subscriptionsActivated = 0;
  metrics.activeConnections = 0;
  metrics.socketConnections = 0;
  metrics.errorsTotal.clear();
  metrics.cacheHits = 0;
  metrics.cacheMisses = 0;
  metrics.rateLimitHits = 0;
};

module.exports = {
  metrics,
  recordHttpRequest,
  incrementMetric,
  recordError,
  setGauge,
  recordCacheAccess,
  getLatencyStats,
  getPrometheusMetrics,
  getJsonMetrics,
  metricsMiddleware,
  resetMetrics
};
