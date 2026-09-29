'use strict';

/**
 * Chat message retention (audit P1-10).
 *
 * The job used to filter on a column that does not exist and so never removed a
 * row; retention was then made opt-in and left off. It now runs on a stated
 * period (config.chat.messageRetentionMonths, 24 by default, 0 = keep forever),
 * published in the Privacy Policy.
 *
 * Two things a plain DELETE would get wrong:
 *  - a conversation with an OPEN report must survive until the report is decided
 *    (the evidence is exactly what a reviewer needs to read);
 *  - voice notes are files at Cloudinary, so they are destroyed with their row.
 */

const { QueryTypes } = require('sequelize');
const config = require('../config/env');
const { log } = require('../middlewares/logger');

const BATCH = 500;
const MAX_BATCHES = 40; // 20k rows per run; the job is daily

const runMessageRetention = async (now = new Date()) => {
  const months = Number(config.chat.messageRetentionMonths) || 0;
  if (months <= 0) {
    log.info('Message retention disabled (MESSAGE_RETENTION_MONTHS=0): keeping messages indefinitely');
    return { cleaned: 0, disabled: true };
  }

  const sequelize = require('../config/database');
  const { destroyMedia } = require('./memberMedia');

  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);

  let cleaned = 0;
  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const rows = await sequelize.query(
      `SELECT m."id", m."mediaUrl"
         FROM "Messages" m
        WHERE m."createdAt" < :cutoff
          AND NOT EXISTS (
            SELECT 1 FROM "Reports" r
             WHERE r."status" IN ('pending', 'reviewing')
               AND ((r."reporterId" = m."senderId" AND r."reportedUserId" = m."receiverId")
                 OR (r."reporterId" = m."receiverId" AND r."reportedUserId" = m."senderId"))
          )
        ORDER BY m."createdAt" ASC
        LIMIT :batch`,
      { replacements: { cutoff, batch: BATCH }, type: QueryTypes.SELECT }
    );
    if (rows.length === 0) break;

    const media = rows.map((r) => r.mediaUrl).filter(Boolean);
    if (media.length) {
      try { await destroyMedia(media); } catch (err) {
        log.warn('Retention: voice-note delete failed (rows still removed)', { error: err.message });
      }
    }
    await sequelize.query('DELETE FROM "Messages" WHERE "id" IN (:ids)', {
      replacements: { ids: rows.map((r) => r.id) },
    });
    cleaned += rows.length;
    if (rows.length < BATCH) break;
  }

  log.info('Cleaned up old messages', { count: cleaned, retentionMonths: months });
  return { cleaned, retentionMonths: months };
};

module.exports = { runMessageRetention };
