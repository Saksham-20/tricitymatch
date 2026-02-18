/**
 * Performance Monitoring Utilities
 * Profiling, timing, and performance tracking
 */

const { log } = require('../middlewares/logger');

/**
 * Performance timer for measuring execution time
 */
class Timer {
  constructor(name, options = {}) {
    this.name = name;
    this.startTime = process.hrtime.bigint();
    this.marks = [];
    this.autoLog = options.autoLog ?? true;
    this.threshold = options.threshold ?? 1000; // Log warning if > 1s
  }

  /**
   * Add a mark/checkpoint
   */
  mark(label) {
    this.marks.push({
      label,
      time: process.hrtime.bigint()
    });
    return this;
  }

  /**
   * Stop timer and get results
   */
  stop() {
    const endTime = process.hrtime.bigint();
    const totalMs = Number(endTime - this.startTime) / 1e6;

    const result = {
      name: this.name,
      totalMs: Math.round(totalMs * 100) / 100,
      marks: this.marks.map((mark, index) => {
        const prevTime = index === 0 ? this.startTime : this.marks[index - 1].time;
        const durationMs = Number(mark.time - prevTime) / 1e6;
        return {
          label: mark.label,
          durationMs: Math.round(durationMs * 100) / 100,
          cumulativeMs: Math.round(Number(mark.time - this.startTime) / 1e6 * 100) / 100
        };
      })
    };

    if (this.autoLog) {
      const logLevel = totalMs > this.threshold ? 'warn' : 'debug';
      log[logLevel](`Timer [${this.name}]: ${result.totalMs}ms`, {
        type: 'performance',
        ...result
      });
    }

    return result;
  }
}

/**
 * Create a new timer
 */
const createTimer = (name, options) => new Timer(name, options);

/**
 * Time an async function
 */
const timeAsync = async (name, fn, options = {}) => {
  const timer = new Timer(name, options);
  try {
    const result = await fn();
    timer.stop();
    return result;
  } catch (error) {
    timer.stop();
    throw error;
  }
};

/**
 * Time a sync function
 */
const timeSync = (name, fn, options = {}) => {
  const timer = new Timer(name, options);
  try {
    const result = fn();
    timer.stop();
    return result;
  } catch (error) {
    timer.stop();
    throw error;
  }
};

/**
 * Performance monitoring decorator for class methods
 */
const monitored = (options = {}) => {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const methodName = options.name || propertyKey;

    descriptor.value = async function (...args) {
      const timer = new Timer(`${target.constructor.name}.${methodName}`, options);
      try {
        const result = await originalMethod.apply(this, args);
        timer.stop();
        return result;
      } catch (error) {
        timer.stop();
        throw error;
      }
    };

    return descriptor;
  };
};

/**
 * Simple profiler for tracking multiple operations
 */
class Profiler {
  constructor(name) {
    this.name = name;
    this.operations = new Map();
    this.startTime = Date.now();
  }

  /**
   * Start tracking an operation
   */
  start(operationName) {
    if (!this.operations.has(operationName)) {
      this.operations.set(operationName, {
        count: 0,
        totalMs: 0,
        minMs: Infinity,
        maxMs: 0,
        current: null
      });
    }
    const op = this.operations.get(operationName);
    op.current = process.hrtime.bigint();
    return this;
  }

  /**
   * End tracking an operation
   */
  end(operationName) {
    const op = this.operations.get(operationName);
    if (!op || !op.current) return this;

    const durationMs = Number(process.hrtime.bigint() - op.current) / 1e6;
    op.count++;
    op.totalMs += durationMs;
    op.minMs = Math.min(op.minMs, durationMs);
    op.maxMs = Math.max(op.maxMs, durationMs);
    op.current = null;
    return this;
  }

  /**
   * Get profiling results
   */
  getResults() {
    const results = {
      name: this.name,
      durationMs: Date.now() - this.startTime,
      operations: {}
    };

    for (const [name, op] of this.operations) {
      results.operations[name] = {
        count: op.count,
        totalMs: Math.round(op.totalMs * 100) / 100,
        avgMs: op.count > 0 ? Math.round((op.totalMs / op.count) * 100) / 100 : 0,
        minMs: op.minMs === Infinity ? 0 : Math.round(op.minMs * 100) / 100,
        maxMs: Math.round(op.maxMs * 100) / 100
      };
    }

    return results;
  }

  /**
   * Log profiling results
   */
  log() {
    const results = this.getResults();
    log.info(`Profiler [${this.name}]`, {
      type: 'performance',
      ...results
    });
    return results;
  }
}

/**
 * Create a new profiler
 */
const createProfiler = (name) => new Profiler(name);

/**
 * Memory usage tracker
 */
class MemoryTracker {
  constructor(name) {
    this.name = name;
    this.snapshots = [];
    this.baseline = process.memoryUsage();
  }

  /**
   * Take a memory snapshot
   */
  snapshot(label) {
    const current = process.memoryUsage();
    this.snapshots.push({
      label,
      timestamp: Date.now(),
      memory: current,
      delta: {
        heapUsed: current.heapUsed - this.baseline.heapUsed,
        heapTotal: current.heapTotal - this.baseline.heapTotal,
        external: current.external - this.baseline.external,
        rss: current.rss - this.baseline.rss
      }
    });
    return this;
  }

  /**
   * Get results
   */
  getResults() {
    const formatBytes = (bytes) => {
      const sign = bytes < 0 ? '-' : '';
      const abs = Math.abs(bytes);
      if (abs < 1024) return `${sign}${abs}B`;
      if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(2)}KB`;
      return `${sign}${(abs / 1024 / 1024).toFixed(2)}MB`;
    };

    return {
      name: this.name,
      baseline: {
        heapUsed: formatBytes(this.baseline.heapUsed),
        heapTotal: formatBytes(this.baseline.heapTotal),
        rss: formatBytes(this.baseline.rss)
      },
      snapshots: this.snapshots.map(s => ({
        label: s.label,
        heapUsed: formatBytes(s.memory.heapUsed),
        delta: formatBytes(s.delta.heapUsed)
      }))
    };
  }

  /**
   * Log results
   */
  log() {
    const results = this.getResults();
    log.info(`MemoryTracker [${this.name}]`, {
      type: 'performance',
      ...results
    });
    return results;
  }
}

/**
 * Create a new memory tracker
 */
const createMemoryTracker = (name) => new MemoryTracker(name);

/**
 * Slow query detector middleware for Sequelize
 */
const slowQueryDetector = (threshold = 1000) => {
  return (queryDetails) => {
    const { sql, executionTime } = queryDetails;
    
    if (executionTime > threshold) {
      log.warn('Slow query detected', {
        type: 'slow_query',
        sql: sql.substring(0, 500), // Truncate for logging
        executionTimeMs: executionTime,
        threshold
      });
    }
  };
};

/**
 * Request performance middleware
 */
const requestPerformanceMiddleware = (options = {}) => {
  const { slowThreshold = 3000, logAll = false } = options;

  return (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;

    // Override res.end to capture timing
    const originalEnd = res.end;
    res.end = function (...args) {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory;

      // Add timing headers
      res.setHeader('X-Response-Time', `${Math.round(durationMs)}ms`);

      // Log slow requests
      if (durationMs > slowThreshold || logAll) {
        const logLevel = durationMs > slowThreshold ? 'warn' : 'debug';
        log[logLevel]('Request performance', {
          type: 'request_performance',
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          memoryDeltaKB: Math.round(memoryDelta / 1024),
          slow: durationMs > slowThreshold
        });
      }

      originalEnd.apply(this, args);
    };

    next();
  };
};

/**
 * Database query counter for N+1 detection
 */
class QueryCounter {
  constructor() {
    this.reset();
  }

  reset() {
    this.queries = [];
    this.startTime = Date.now();
  }

  record(sql, duration) {
    this.queries.push({
      sql: sql.substring(0, 200),
      duration,
      timestamp: Date.now() - this.startTime
    });
  }

  analyze() {
    const result = {
      totalQueries: this.queries.length,
      totalDurationMs: this.queries.reduce((sum, q) => sum + q.duration, 0),
      patterns: {}
    };

    // Detect repeated patterns (N+1 indicator)
    for (const query of this.queries) {
      // Normalize query to detect patterns
      const pattern = query.sql
        .replace(/\d+/g, 'N')
        .replace(/'[^']*'/g, "'?'")
        .substring(0, 100);

      if (!result.patterns[pattern]) {
        result.patterns[pattern] = { count: 0, totalDuration: 0 };
      }
      result.patterns[pattern].count++;
      result.patterns[pattern].totalDuration += query.duration;
    }

    // Flag potential N+1 issues
    result.potentialNPlusOne = Object.entries(result.patterns)
      .filter(([_, stats]) => stats.count > 5)
      .map(([pattern, stats]) => ({
        pattern,
        count: stats.count,
        avgDuration: Math.round(stats.totalDuration / stats.count * 100) / 100
      }));

    return result;
  }
}

/**
 * Create query counter
 */
const createQueryCounter = () => new QueryCounter();

module.exports = {
  Timer,
  createTimer,
  timeAsync,
  timeSync,
  monitored,
  Profiler,
  createProfiler,
  MemoryTracker,
  createMemoryTracker,
  slowQueryDetector,
  requestPerformanceMiddleware,
  QueryCounter,
  createQueryCounter
};
