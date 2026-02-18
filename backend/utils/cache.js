/**
 * Caching Layer
 * Redis-based caching with fallback to in-memory cache
 */

const config = require('../config/env');
const { log } = require('../middlewares/logger');
const { recordCacheAccess } = require('./metrics');

// In-memory cache fallback
const memoryCache = new Map();
const memoryCacheTTL = new Map();

// Redis client (lazy initialization)
let redisClient = null;
let redisConnected = false;

/**
 * Initialize Redis connection
 */
const initRedis = async () => {
  if (!config.redis?.url) {
    log.info('Redis not configured, using in-memory cache');
    return null;
  }

  try {
    const Redis = require('ioredis');
    
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      connectTimeout: 10000,
      lazyConnect: true,
      keepAlive: 10000,
    });

    redisClient.on('connect', () => {
      redisConnected = true;
      log.info('Redis connected');
    });

    redisClient.on('error', (err) => {
      log.error('Redis error', { error: err.message });
      redisConnected = false;
    });

    redisClient.on('close', () => {
      redisConnected = false;
      log.warn('Redis connection closed');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    log.warn('Redis initialization failed, using in-memory cache', { error: error.message });
    return null;
  }
};

/**
 * Get Redis client (initializes if needed)
 */
const getRedisClient = () => redisClient;

/**
 * Check if Redis is available
 */
const isRedisAvailable = () => redisConnected && redisClient;

/**
 * Get value from cache
 */
const get = async (key) => {
  try {
    if (isRedisAvailable()) {
      const value = await redisClient.get(key);
      const hit = value !== null;
      recordCacheAccess(hit);
      return value ? JSON.parse(value) : null;
    }
    
    // Fallback to memory cache
    const cached = memoryCache.get(key);
    if (cached) {
      const ttl = memoryCacheTTL.get(key);
      if (ttl && Date.now() > ttl) {
        memoryCache.delete(key);
        memoryCacheTTL.delete(key);
        recordCacheAccess(false);
        return null;
      }
      recordCacheAccess(true);
      return cached;
    }
    
    recordCacheAccess(false);
    return null;
  } catch (error) {
    log.error('Cache get error', { key, error: error.message });
    recordCacheAccess(false);
    return null;
  }
};

/**
 * Set value in cache
 */
const set = async (key, value, ttlSeconds = 300) => {
  try {
    const serialized = JSON.stringify(value);
    
    if (isRedisAvailable()) {
      if (ttlSeconds > 0) {
        await redisClient.setex(key, ttlSeconds, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
    } else {
      // Fallback to memory cache
      memoryCache.set(key, value);
      if (ttlSeconds > 0) {
        memoryCacheTTL.set(key, Date.now() + (ttlSeconds * 1000));
      }
    }
    
    return true;
  } catch (error) {
    log.error('Cache set error', { key, error: error.message });
    return false;
  }
};

/**
 * Delete value from cache
 */
const del = async (key) => {
  try {
    if (isRedisAvailable()) {
      await redisClient.del(key);
    } else {
      memoryCache.delete(key);
      memoryCacheTTL.delete(key);
    }
    return true;
  } catch (error) {
    log.error('Cache delete error', { key, error: error.message });
    return false;
  }
};

/**
 * Delete multiple keys matching pattern
 */
const delPattern = async (pattern) => {
  try {
    if (isRedisAvailable()) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      // Memory cache pattern matching
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          memoryCache.delete(key);
          memoryCacheTTL.delete(key);
        }
      }
    }
    return true;
  } catch (error) {
    log.error('Cache delete pattern error', { pattern, error: error.message });
    return false;
  }
};

/**
 * Get or set value (cache-aside pattern)
 */
const getOrSet = async (key, fetchFn, ttlSeconds = 300) => {
  // Try to get from cache
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch fresh data
  const value = await fetchFn();
  
  // Cache the result
  if (value !== null && value !== undefined) {
    await set(key, value, ttlSeconds);
  }
  
  return value;
};

/**
 * Invalidate cache for a user
 */
const invalidateUser = async (userId) => {
  await delPattern(`user:${userId}:*`);
  await delPattern(`profile:${userId}:*`);
};

/**
 * Cache key generators
 */
const keys = {
  user: (userId) => `user:${userId}`,
  userProfile: (userId) => `user:${userId}:profile`,
  userSubscription: (userId) => `user:${userId}:subscription`,
  profile: (profileId) => `profile:${profileId}`,
  searchResults: (hash) => `search:${hash}`,
  suggestions: (userId, page) => `suggestions:${userId}:${page}`,
  mutualMatches: (userId) => `matches:${userId}:mutual`,
  conversations: (userId) => `conversations:${userId}`,
  onlineStatus: (userId) => `online:${userId}`,
  rateLimit: (identifier, action) => `ratelimit:${action}:${identifier}`,
  session: (sessionId) => `session:${sessionId}`,
};

/**
 * Hash function for cache keys
 */
const hashKey = (obj) => {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

/**
 * Memory cache cleanup (for fallback cache)
 */
const cleanupMemoryCache = () => {
  const now = Date.now();
  for (const [key, ttl] of memoryCacheTTL.entries()) {
    if (now > ttl) {
      memoryCache.delete(key);
      memoryCacheTTL.delete(key);
    }
  }
};

// Run cleanup every minute
setInterval(cleanupMemoryCache, 60000);

/**
 * Get cache statistics
 */
const getStats = async () => {
  if (isRedisAvailable()) {
    const info = await redisClient.info('memory');
    const keyCount = await redisClient.dbsize();
    
    return {
      type: 'redis',
      connected: true,
      keys: keyCount,
      memory: info.match(/used_memory_human:(\S+)/)?.[1] || 'unknown'
    };
  }
  
  return {
    type: 'memory',
    connected: true,
    keys: memoryCache.size,
    memory: 'N/A'
  };
};

/**
 * Close Redis connection
 */
const close = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisConnected = false;
  }
};

module.exports = {
  initRedis,
  getRedisClient,
  isRedisAvailable,
  get,
  set,
  del,
  delPattern,
  getOrSet,
  invalidateUser,
  keys,
  hashKey,
  getStats,
  close
};
