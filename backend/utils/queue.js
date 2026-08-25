/**
 * Background Job Queue
 * Bull-based job processing with Redis (or in-memory fallback)
 */

const config = require('../config/env');
const { sanitizeSavedSearchList } = require('./savedSearches');
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
  // Same gate class as F-026 (utils/cache.js): docker-compose configures Redis via
  // REDIS_HOST/PORT/PASSWORD and never REDIS_URL, so gating on url alone left the
  // Bull queues (weekly digest, cleanup, saved-search alerts) running in-memory on
  // production while the Redis container sat next to them.
  if (!config.redis?.isConfigured?.()) {
    log.info('Redis not configured, using in-memory job processing');
    startMemoryQueueProcessor();
    return;
  }

  try {
    const Bull = require('bull');
    const redisOptions = {
      redis: config.redis.url
        ? config.redis.url
        : {
          host: config.redis.host,
          port: config.redis.port,
          ...(config.redis.password ? { password: config.redis.password } : {}),
        },
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
/**
 * Lifecycle jobs, extracted from their queue registrations so they can be
 * unit-tested without Redis — the dev stack has none, so a job that lives
 * only inside a Bull closure is one nobody can exercise until production
 * runs it for the first time, against real members.
 */
const runSubscriptionLifecycle = async () => {
  const { Subscription, User, Profile } = require('../models');
  const { Op } = require('sequelize');
  const email = require('./email');
  const { getPlanDetails } = require('./razorpay');
  const { PAID_PLANS } = require('../constants/plans');

  const counts = { abandoned: 0, renewal: 0, expired: 0, winback: 0 };
  const now = Date.now();
  // Hard ceiling per stage per run. A lifecycle job with no cap is one bad
  // query away from mailing the entire table in a single pass — which is
  // exactly how a batch run burns a provider's daily quota and takes OTP mail
  // down with it. Anything beyond the cap is picked up on the next hourly run.
  const BATCH = 200;
  const withUser = {
    model: User,
    attributes: ['id', 'email'],
    include: [{ model: Profile, attributes: ['firstName'] }],
  };
  const nameOf = (sub) => sub.User?.Profile?.firstName || 'there';
  const labelOf = (planType) => getPlanDetails(planType)?.name || planType;

  // Marks a mail as sent. Merges rather than replaces: the row accumulates
  // one key per lifecycle moment over its life.
  const mark = async (sub, key) => {
    await sub.update({ lifecycleMail: { ...(sub.lifecycleMail || {}), [key]: new Date().toISOString() } });
  };
  const alreadySent = (sub, key) => Boolean((sub.lifecycleMail || {})[key]);
  // `deliver` returns {success:false} rather than throwing when no provider is
  // configured, so marking on a bare call would silently burn the one send this
  // member ever gets. Only a real delivery counts.
  const delivered = (result) => !result || result.success !== false;

  // 1. Abandoned checkout — an order created 1–72h ago that was never paid.
  //    The floor gives a genuinely slow payer time to finish; the ceiling
  //    stops us mailing about a decision made three days ago.
  const abandoned = await Subscription.findAll({
    where: {
      status: 'pending',
      razorpayPaymentId: null,
      createdAt: {
        [Op.lt]: new Date(now - 60 * 60 * 1000),
        [Op.gt]: new Date(now - 72 * 60 * 60 * 1000),
      },
    },
    include: [withUser],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });
  for (const sub of abandoned) {
    if (alreadySent(sub, 'abandoned') || !sub.User?.email) continue;
    try {
      const result = await email.sendCheckoutAbandoned(sub.User.email, nameOf(sub), labelOf(sub.planType), sub.amount);
      if (!delivered(result)) continue;
      await mark(sub, 'abandoned');
      counts.abandoned += 1;
    } catch (err) {
      log.warn('Abandoned-checkout mail failed', { subscriptionId: sub.id, error: err.message });
    }
  }

  // 2. Renewal warning — seven days out.
  const endingSoon = await Subscription.findAll({
    where: {
      status: 'active',
      planType: { [Op.in]: PAID_PLANS },
      endDate: { [Op.gt]: new Date(), [Op.lt]: new Date(now + 7 * 24 * 60 * 60 * 1000) },
    },
    include: [withUser],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });
  for (const sub of endingSoon) {
    if (alreadySent(sub, 'renewal') || !sub.User?.email) continue;
    const daysLeft = Math.max(1, Math.ceil((new Date(sub.endDate) - now) / (24 * 60 * 60 * 1000)));
    try {
      const result = await email.sendRenewalReminder(
        sub.User.email, nameOf(sub), labelOf(sub.planType),
        new Date(sub.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        daysLeft
      );
      if (!delivered(result)) continue;
      await mark(sub, 'renewal');
      counts.renewal += 1;
    } catch (err) {
      log.warn('Renewal mail failed', { subscriptionId: sub.id, error: err.message });
    }
  }

  // 3. Just expired — within the last day, so this runs once whichever hour
  //    the expire job flipped it.
  const justExpired = await Subscription.findAll({
    where: {
      status: 'expired',
      planType: { [Op.in]: PAID_PLANS },
      endDate: { [Op.gt]: new Date(now - 24 * 60 * 60 * 1000), [Op.lt]: new Date() },
    },
    include: [withUser],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });
  for (const sub of justExpired) {
    if (alreadySent(sub, 'expired') || !sub.User?.email) continue;
    try {
      const result = await email.sendMembershipExpired(sub.User.email, nameOf(sub), labelOf(sub.planType));
      if (!delivered(result)) continue;
      await mark(sub, 'expired');
      counts.expired += 1;
    } catch (err) {
      log.warn('Expiry mail failed', { subscriptionId: sub.id, error: err.message });
    }
  }

  // 4. Win-back a fortnight later — but only when there is something real to
  //    come back for. A "look what you're missing" mail listing nothing is
  //    worse than no mail, so a zero count skips the send AND the mark, and
  //    it gets another chance tomorrow.
  const lapsed = await Subscription.findAll({
    where: {
      status: 'expired',
      planType: { [Op.in]: PAID_PLANS },
      endDate: {
        [Op.gt]: new Date(now - 21 * 24 * 60 * 60 * 1000),
        [Op.lt]: new Date(now - 14 * 24 * 60 * 60 * 1000),
      },
    },
    include: [withUser],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });
  for (const sub of lapsed) {
    if (alreadySent(sub, 'winback') || !sub.User?.email) continue;
    const newProfiles = await Profile.count({
      where: { isActive: true, createdAt: { [Op.gt]: sub.endDate } },
    });
    if (newProfiles < 1) continue;
    try {
      const result = await email.sendWinBack(sub.User.email, nameOf(sub), newProfiles);
      if (!delivered(result)) continue;
      await mark(sub, 'winback');
      counts.winback += 1;
    } catch (err) {
      log.warn('Win-back mail failed', { subscriptionId: sub.id, error: err.message });
    }
  }

  log.info('Subscription lifecycle mail sent', counts);
  return counts;
};
const runPhotoNudge = async () => {
  const { User, Profile } = require('../models');
  const { Op } = require('sequelize');
  const email = require('./email');

  const now = Date.now();
  // Same reasoning as the subscription job: cap the fan-out per run.
  const BATCH = 100;
  const candidates = await User.findAll({
    where: {
      status: 'active',
      createdAt: { [Op.lt]: new Date(now - 24 * 60 * 60 * 1000) },
    },
    include: [{
      model: Profile,
      required: true,
      // Postgres: an empty array is not NULL, so both cases have to be named.
      where: {
        onboardingComplete: true,
        [Op.or]: [{ photos: null }, { photos: { [Op.eq]: [] } }],
      },
      attributes: ['firstName', 'photos'],
    }],
    order: [['createdAt', 'ASC']],
    limit: BATCH,
  });

  let sent = 0;
  for (const user of candidates) {
    const ledger = user.lifecycleMail || {};
    const ageDays = (now - new Date(user.createdAt)) / (24 * 60 * 60 * 1000);
    const key = !ledger.photoNudge1 ? 'photoNudge1' : (!ledger.photoNudge2 && ageDays >= 7 ? 'photoNudge2' : null);
    if (!key || !user.email) continue;
    try {
      const result = await email.sendAddPhotoNudge(user.email, user.Profile?.firstName || 'there');
      // Same rule as the subscription mails: an undelivered nudge must not
      // consume the member's one-and-only ask.
      if (result && result.success === false) continue;
      await user.update({ lifecycleMail: { ...ledger, [key]: new Date().toISOString() } });
      sent += 1;
    } catch (err) {
      log.warn('Photo nudge failed', { userId: user.id, error: err.message });
    }
  }

  log.info('Photo nudges sent', { sent, candidates: candidates.length });
  return { sent };
};

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
    
    // This job filtered on `deletedAt`, a column that does not exist on
    // Messages -- there is no soft delete on that model and no migration ever
    // added one. So it has never removed a single row: chat bodies, voice-note
    // URLs and reply quotes are retained indefinitely.
    //
    // Retention is a policy decision (and for a matrimonial product, silently
    // destroying conversation history is not a change to make unprompted), so
    // this is opt-in. Set MESSAGE_RETENTION_MONTHS to a positive number to
    // enable it; unset or 0 keeps the previous behaviour of retaining forever,
    // but now says so out loud instead of failing silently.
    const retentionMonths = Number(process.env.MESSAGE_RETENTION_MONTHS) || 0;
    if (retentionMonths <= 0) {
      log.info('Message retention disabled — set MESSAGE_RETENTION_MONTHS to enable', {
        retained: 'indefinitely',
      });
      return { cleaned: 0, disabled: true };
    }

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

    const result = await Message.destroy({
      where: { createdAt: { [Op.lt]: cutoffDate } },
    });

    log.info('Cleaned up old messages', { count: result, retentionMonths });
    return { cleaned: result, retentionMonths };
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

        // Profiles this member could act on but has not yet.
        //
        // This used to additionally require `createdAt >= weekAgo`, so only
        // brand-new joiners counted — and in a market taking one or two signups
        // a week the digest reached almost nobody (3 of 13 on 24 Aug 2026). The
        // mail exists to be a weekly reason to come back, and "someone you have
        // not seen yet" is that reason whether they joined on Tuesday or in
        // June. New joiners are still counted first so a genuinely fresh week
        // still leads with fresh faces.
        const baseWhere = {
          isActive: true,
          incognitoMode: { [Op.ne]: true },
          gender: oppositeGender,
          userId: { [Op.ne]: user.id, ...(interactedIds.length > 0 ? { [Op.notIn]: interactedIds } : {}) },
          ...(Object.keys(ageWhere).length > 0 ? { dateOfBirth: ageWhere } : {})
        };

        const newThisWeek = await Profile.count({
          where: { ...baseWhere, createdAt: { [Op.gte]: weekAgo } }
        });
        const matchCount = newThisWeek > 0
          ? newThisWeek
          : await Profile.count({ where: baseWhere });

        if (matchCount > 0) {
          // Email digest
          await sendWeeklyDigest(user.email, profile.firstName || 'there', matchCount, '');

          // Push notification (APP-047) — best-effort, non-blocking
          if (user.fcmTokens?.length) {
            const { sendPushNotification } = require('./fcm');
            const pushTitle = `${matchCount} new profile${matchCount === 1 ? '' : 's'} match your preferences`;
            const pushBody = `${profile.firstName ? `Hi ${profile.firstName}! ` : ''}Browse your weekly matches now.`;
            sendPushNotification(user.fcmTokens, pushTitle, pushBody, {
              type: 'weekly_digest',
              matchCount: String(matchCount),
            }).then(({ failedTokens }) => {
              if (failedTokens.length > 0) {
                const cleanedTokens = user.fcmTokens.filter((t) => !failedTokens.includes(t));
                User.update({ fcmTokens: cleanedTokens }, { where: { id: user.id } }).catch(() => {});
              }
            }).catch(() => {});
          }

          sent++;
        }
      } catch (err) {
        log.warn('Weekly digest failed for user', { userId: user.id, error: err.message });
      }
    }

    log.info('Weekly digest sent', { sent, total: users.length });
    return { sent };
  });

  // APP-048 — Saved Search Alert: notify users when a new profile matches a saved search
  queue.process('saved-search-alerts', async (job) => {
    const { User, Profile } = require('../models');
    const { Op } = require('sequelize');
    const { get: cacheGet, set: cacheSet } = require('./cache');
    const { notify } = require('./notifyUser');

    // Fetch all users who have saved searches stored (as MMKV on device)
    // Backend-side: we use profile.lifestylePreferences.savedSearches (stored during save-search API call)
    // We check profiles created in last 24h against each user's preferences
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const users = await User.findAll({
      where: { status: 'active' },
      include: [{
        model: Profile,
        where: { isActive: true, gender: { [Op.in]: ['male', 'female'] } },
        attributes: ['gender', 'city', 'state', 'religion', 'caste', 'preferredAgeMin', 'preferredAgeMax',
                     'preferredEducation', 'preferredProfession', 'lifestylePreferences', 'firstName'],
      }],
      attributes: ['id', 'fcmTokens'],
      limit: 1000,
    });

    let notified = 0;

    for (const user of users) {
      try {
        const profile = user.Profile;
        if (!profile) continue;

        // Extract saved searches from lifestylePreferences.savedSearches
        // Defensive: these rows predate the sanitiser being applied on the profile
    // update path, so re-validate rather than trusting whatever is stored.
    const savedSearches = sanitizeSavedSearchList(profile.lifestylePreferences?.savedSearches);
        if (!Array.isArray(savedSearches) || savedSearches.length === 0) continue;

        for (const search of savedSearches) {
          const { name, filters } = search;
          if (!filters) continue;

          // Rate limit: max 1 alert per saved search per day
          const alertKey = `search_alert:${user.id}:${name}`;
          const alreadySent = await cacheGet(alertKey);
          if (alreadySent) continue;

          const where = {
            isActive: true,
            incognitoMode: { [Op.ne]: true },
            userId: { [Op.ne]: user.id },
            createdAt: { [Op.gte]: dayAgo },
          };

          if (filters.gender) where.gender = filters.gender;
          if (filters.religion) where.religion = filters.religion;
          if (filters.caste) where.caste = filters.caste;
          if (filters.city?.length) where.city = { [Op.in]: filters.city };

          if (filters.ageMin || filters.ageMax) {
            const dobWhere = {};
            if (filters.ageMin) {
              const maxDob = new Date();
              maxDob.setFullYear(maxDob.getFullYear() - filters.ageMin);
              dobWhere[Op.lte] = maxDob;
            }
            if (filters.ageMax) {
              const minDob = new Date();
              minDob.setFullYear(minDob.getFullYear() - filters.ageMax - 1);
              dobWhere[Op.gte] = minDob;
            }
            if (Object.keys(dobWhere).length) where.dateOfBirth = dobWhere;
          }

          const count = await Profile.count({ where });
          if (count > 0) {
            await notify(
              user.id,
              'system',
              `New match for "${name}"`,
              `${count} new profile${count === 1 ? '' : 's'} match${count === 1 ? 'es' : ''} your saved search.`,
            );
            await cacheSet(alertKey, '1', 86400); // 24h dedup
            notified++;
          }
        }
      } catch (err) {
        log.warn('Saved search alert failed for user', { userId: user.id, error: err.message });
      }
    }

    log.info('Saved search alerts sent', { notified, total: users.length });
    return { notified };
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

  /**
   * Subscription lifecycle mail.
   *
   * Until this existed a plan could be started and abandoned, or run all the
   * way to expiry, in complete silence — the expire job above flipped a status
   * and told nobody. Four moments, each sent at most once per subscription:
   * the `lifecycleMail` JSONB on the row is the ledger, written AFTER a
   * successful send so a crash mid-run retries rather than skips.
   *
   * Every send is individually try/caught: one bad address must not stop the
   * rest of the run.
   */
  queue.process('subscription-lifecycle', () => runSubscriptionLifecycle());
  queue.process('photo-nudge', () => runPhotoNudge());
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

    // Weekly new-matches digest — every Monday at 10 AM (email + push, APP-047)
    await cleanupQueue.add('send-weekly-digest', {}, {
      repeat: { cron: '0 10 * * 1' }
    });

    // Saved search alerts — every day at 9 AM (APP-048)
    await cleanupQueue.add('saved-search-alerts', {}, {
      repeat: { cron: '0 9 * * *' }
    });

    // Subscription lifecycle mail — hourly, because the abandoned-checkout
    // window is measured in hours and a next-day chase is a cold lead.
    await cleanupQueue.add('subscription-lifecycle', {}, {
      repeat: { cron: '30 * * * *' }
    });

    // No-photo nudge — once a day, late morning.
    await cleanupQueue.add('photo-nudge', {}, {
      repeat: { cron: '0 11 * * *' }
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
  runSubscriptionLifecycle,
  runPhotoNudge,
  initQueues,
  addJob,
  getQueue,
  scheduleCleanupJobs,
  getQueueStats,
  closeQueues
};
