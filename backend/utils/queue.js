/**
 * Background Job Queue
 * Bull-based job processing with Redis (or in-memory fallback)
 */

const config = require('../config/env');
const { log } = require('../middlewares/logger');

// Job queues
let emailQueue = null;
let notificationQueue = null;
let cleanupQueue = null;

// In-memory fallback queue
const memoryQueue = {
  jobs: [],
  processing: false
};

/**
 * Initialize job queues
 */
const initQueues = async () => {
  if (!config.redis?.url) {
    log.info('Redis not configured, using in-memory job processing');
    startMemoryQueueProcessor();
    return;
  }

  try {
    const Bull = require('bull');
    const redisOptions = {
      redis: config.redis.url,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    };

    // Create queues
    emailQueue = new Bull('email', redisOptions);
    notificationQueue = new Bull('notification', redisOptions);
    cleanupQueue = new Bull('cleanup', redisOptions);

    // Set up processors
    setupEmailProcessor(emailQueue);
    setupNotificationProcessor(notificationQueue);
    setupCleanupProcessor(cleanupQueue);

    // Set up event handlers
    [emailQueue, notificationQueue, cleanupQueue].forEach(queue => {
      queue.on('completed', (job) => {
        log.debug('Job completed', { queue: queue.name, jobId: job.id });
      });

      queue.on('failed', (job, err) => {
        log.error('Job failed', { 
          queue: queue.name, 
          jobId: job.id, 
          error: err.message,
          attempts: job.attemptsMade
        });
      });

      queue.on('stalled', (job) => {
        log.warn('Job stalled', { queue: queue.name, jobId: job.id });
      });
    });

    log.info('Job queues initialized');
  } catch (error) {
    log.warn('Bull queue initialization failed, using in-memory fallback', { error: error.message });
    startMemoryQueueProcessor();
  }
};

/**
 * Setup email queue processor
 */
const setupEmailProcessor = (queue) => {
  queue.process('send-email', async (job) => {
    const { sendEmail } = require('./email');
    const { to, template, data } = job.data;
    
    log.debug('Processing email job', { to, template });
    await sendEmail(to, template, data);
    
    return { sent: true, to };
  });

  queue.process('send-welcome', async (job) => {
    const { sendWelcomeEmail } = require('./email');
    const { to, name } = job.data;
    
    await sendWelcomeEmail(to, name);
    return { sent: true, to };
  });

  queue.process('send-password-reset', async (job) => {
    const { sendPasswordResetEmail } = require('./email');
    const { to, name, resetLink } = job.data;
    
    await sendPasswordResetEmail(to, name, resetLink);
    return { sent: true, to };
  });

  queue.process('send-match-notification', async (job) => {
    const { sendMatchNotification } = require('./email');
    const { to, name, matchName } = job.data;
    
    await sendMatchNotification(to, name, matchName);
    return { sent: true, to };
  });

  queue.process('send-subscription-confirmation', async (job) => {
    const { sendSubscriptionConfirmation } = require('./email');
    const { to, name, plan, expiryDate } = job.data;
    
    await sendSubscriptionConfirmation(to, name, plan, expiryDate);
    return { sent: true, to };
  });
};

/**
 * Setup notification queue processor
 */
const setupNotificationProcessor = (queue) => {
  queue.process('push-notification', async (job) => {
    const { userId, title, body, data } = job.data;
    const { sendPushNotification } = require('./fcm');
    const { User } = require('../models');

    const user = await User.findByPk(userId, { attributes: ['id', 'fcmTokens'] });
    if (!user?.fcmTokens?.length) return { sent: false, reason: 'no_tokens' };

    const { successCount, failedTokens } = await sendPushNotification(
      user.fcmTokens, title, body, data || {}
    );

    if (failedTokens.length > 0) {
      const cleaned = user.fcmTokens.filter(t => !failedTokens.includes(t));
      await User.update({ fcmTokens: cleaned }, { where: { id: userId } });
    }

    return { sent: true, successCount, userId };
  });

  queue.process('in-app-notification', async (job) => {
    const { userId, type, title, body, relatedId } = job.data;
    const { notify } = require('./notifyUser');
    await notify(userId, type, title, body, relatedId);
    return { stored: true, userId };
  });
};

/**
 * Setup cleanup queue processor
 */
const setupCleanupProcessor = (queue) => {
  queue.process('cleanup-expired-tokens', async (job) => {
    const { RefreshToken } = require('../models');
    
    const result = await RefreshToken.cleanupExpired();
    log.info('Cleaned up expired tokens', { count: result });
    
    return { cleaned: result };
  });

  queue.process('cleanup-old-messages', async (job) => {
    const { Message } = require('../models');
    const { Op } = require('sequelize');
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 12); // 12 months ago
    
    // Only delete soft-deleted messages older than 12 months
    const result = await Message.destroy({
      where: {
        deletedAt: { [Op.lt]: cutoffDate }
      },
      force: true
    });
    
    log.info('Cleaned up old messages', { count: result });
    return { cleaned: result };
  });

  queue.process('cleanup-inactive-sessions', async (job) => {
    const { RefreshToken } = require('../models');
    const { Op } = require('sequelize');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

    // Revoke tokens not used in 30 days
    const result = await RefreshToken.update(
      { isRevoked: true, revokedReason: 'inactivity' },
      {
        where: {
          isRevoked: false,
          lastUsedAt: { [Op.lt]: cutoffDate }
        }
      }
    );

    log.info('Cleaned up inactive sessions', { count: result[0] });
    return { cleaned: result[0] };
  });

  queue.process('send-weekly-digest', async (job) => {
    const { User, Profile, Match } = require('../models');
    const { Op } = require('sequelize');
    const { sendWeeklyDigest } = require('./email');

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get active users with complete profiles (have gender set)
    const users = await User.findAll({
      where: { status: 'active' },
      include: [{
        model: Profile,
        where: { isActive: true, gender: { [Op.in]: ['male', 'female'] } },
        attributes: ['gender', 'city', 'preferredAgeMin', 'preferredAgeMax', 'firstName']
      }],
      attributes: ['id', 'email'],
      limit: 500 // batch size — prevents memory overload on large user base
    });

    let sent = 0;
    for (const user of users) {
      try {
        const profile = user.Profile;
        if (!profile || !user.email) continue;

        const oppositeGender = profile.gender === 'male' ? 'female' : 'male';
        const ageMin = profile.preferredAgeMin;
        const ageMax = profile.preferredAgeMax;

        // Get already-interacted user IDs to exclude
        const interacted = await Match.findAll({
          where: { userId: user.id },
          attributes: ['matchedUserId']
        });
        const interactedIds = interacted.map(m => m.matchedUserId);

        // Count new profiles matching preferences joined in last 7 days
        const ageWhere = {};
        if (ageMin) {
          const maxDob = new Date();
          maxDob.setFullYear(maxDob.getFullYear() - ageMin);
          ageWhere[Op.lte] = maxDob;
        }
        if (ageMax) {
          const minDob = new Date();
          minDob.setFullYear(minDob.getFullYear() - ageMax - 1);
          ageWhere[Op.gte] = minDob;
        }

        const matchCount = await Profile.count({
          where: {
            isActive: true,
            incognitoMode: { [Op.ne]: true },
            gender: oppositeGender,
            createdAt: { [Op.gte]: weekAgo },
            userId: { [Op.ne]: user.id, ...(interactedIds.length > 0 ? { [Op.notIn]: interactedIds } : {}) },
            ...(Object.keys(ageWhere).length > 0 ? { dateOfBirth: ageWhere } : {})
          }
        });

        if (matchCount > 0) {
          await sendWeeklyDigest(user.email, profile.firstName || 'there', matchCount, '');
          sent++;
        }
      } catch (err) {
        log.warn('Weekly digest failed for user', { userId: user.id, error: err.message });
      }
    }

    log.info('Weekly digest sent', { sent, total: users.length });
    return { sent };
  });

  queue.process('expire-subscriptions', async (job) => {
    const { Subscription } = require('../models');
    const { Op } = require('sequelize');
    
    const result = await Subscription.update(
      { status: 'expired' },
      {
        where: {
          status: 'active',
          endDate: { [Op.lt]: new Date() }
        }
      }
    );
    
    log.info('Expired subscriptions', { count: result[0] });
    return { expired: result[0] };
  });
};

/**
 * In-memory queue processor (fallback)
 */
const startMemoryQueueProcessor = () => {
  const processJob = async () => {
    if (memoryQueue.processing || memoryQueue.jobs.length === 0) {
      return;
    }

    memoryQueue.processing = true;
    const job = memoryQueue.jobs.shift();

    try {
      await executeJob(job);
      log.debug('Memory job completed', { type: job.type });
    } catch (error) {
      log.error('Memory job failed', { type: job.type, error: error.message });
      
      // Retry logic
      if (job.attempts < 3) {
        job.attempts++;
        job.delay = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => memoryQueue.jobs.push(job), job.delay);
      }
    }

    memoryQueue.processing = false;
    
    // Process next job
    if (memoryQueue.jobs.length > 0) {
      setImmediate(processJob);
    }
  };

  // Check for jobs every second
  setInterval(() => {
    if (memoryQueue.jobs.length > 0 && !memoryQueue.processing) {
      processJob();
    }
  }, 1000);
};

/**
 * Execute a job (for memory queue fallback)
 */
const executeJob = async (job) => {
  switch (job.type) {
    case 'send-email':
    case 'send-welcome':
    case 'send-password-reset':
    case 'send-match-notification':
    case 'send-subscription-confirmation': {
      const email = require('./email');
      if (job.type === 'send-email') {
        await email.sendEmail(job.data.to, job.data.template, job.data.data);
      } else if (job.type === 'send-welcome') {
        await email.sendWelcomeEmail(job.data.to, job.data.name);
      } else if (job.type === 'send-password-reset') {
        await email.sendPasswordResetEmail(job.data.to, job.data.name, job.data.resetLink);
      } else if (job.type === 'send-match-notification') {
        await email.sendMatchNotification(job.data.to, job.data.name, job.data.matchName);
      } else if (job.type === 'send-subscription-confirmation') {
        await email.sendSubscriptionConfirmation(job.data.to, job.data.name, job.data.plan, job.data.expiryDate);
      }
      break;
    }
    default:
      log.warn('Unknown job type', { type: job.type });
  }
};

/**
 * Add job to queue
 */
const addJob = async (queueName, jobType, data, options = {}) => {
  const queue = getQueue(queueName);
  
  if (queue) {
    return queue.add(jobType, data, options);
  }
  
  // Fallback to memory queue
  memoryQueue.jobs.push({
    type: jobType,
    data,
    attempts: 0,
    addedAt: Date.now()
  });
  
  return { id: `memory-${Date.now()}` };
};

/**
 * Get queue by name
 */
const getQueue = (name) => {
  switch (name) {
    case 'email': return emailQueue;
    case 'notification': return notificationQueue;
    case 'cleanup': return cleanupQueue;
    default: return null;
  }
};

/**
 * Schedule recurring cleanup jobs
 */
const scheduleCleanupJobs = async () => {
  if (cleanupQueue) {
    // Clean expired tokens every hour
    await cleanupQueue.add('cleanup-expired-tokens', {}, {
      repeat: { cron: '0 * * * *' } // Every hour
    });

    // Clean old messages every day at 3 AM
    await cleanupQueue.add('cleanup-old-messages', {}, {
      repeat: { cron: '0 3 * * *' }
    });

    // Clean inactive sessions every day at 4 AM
    await cleanupQueue.add('cleanup-inactive-sessions', {}, {
      repeat: { cron: '0 4 * * *' }
    });

    // Expire subscriptions every hour
    await cleanupQueue.add('expire-subscriptions', {}, {
      repeat: { cron: '0 * * * *' }
    });

    // Weekly new-matches digest — every Monday at 10 AM
    await cleanupQueue.add('send-weekly-digest', {}, {
      repeat: { cron: '0 10 * * 1' }
    });

    log.info('Cleanup jobs scheduled');
  }
};

/**
 * Get queue statistics
 */
const getQueueStats = async () => {
  if (emailQueue) {
    const [emailStats, notificationStats, cleanupStats] = await Promise.all([
      emailQueue.getJobCounts(),
      notificationQueue.getJobCounts(),
      cleanupQueue.getJobCounts()
    ]);

    return {
      email: emailStats,
      notification: notificationStats,
      cleanup: cleanupStats
    };
  }

  return {
    type: 'memory',
    pending: memoryQueue.jobs.length,
    processing: memoryQueue.processing
  };
};

/**
 * Close all queues
 */
const closeQueues = async () => {
  const queues = [emailQueue, notificationQueue, cleanupQueue].filter(q => q);
  await Promise.all(queues.map(q => q.close()));
};

module.exports = {
  initQueues,
  addJob,
  getQueue,
  scheduleCleanupJobs,
  getQueueStats,
  closeQueues
};
