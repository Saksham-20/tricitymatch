'use strict';

/**
 * Why a member can be reported. One list feeds the Report model enum, the route
 * validator and the controller, so they cannot drift (they used to be three
 * hand-copied arrays).
 *
 * HIGH_RISK reasons are the ones where delay can mean harm or a legal duty:
 * they are surfaced ahead of the queue for human review. See the moderation
 * queue (admin) — reports are never actioned automatically.
 *
 * Someone else's or doctored photos (impersonation) and nude or sexual images
 * are on that list because the Terms promise to act on them within 24 hours.
 * `inappropriate_content` is the only reason a member can pick for nude or
 * sexual images, so the whole reason is urgent: a separate reason would need a
 * new value in the database enum.
 */

const REPORT_REASONS = [
  'fake_profile',
  'harassment',
  'spam',
  'inappropriate_content',
  'underage',
  'other',
  // Added 2026-09-29 (audit P0-6/P0-15): the categories a matrimonial service
  // actually needs beyond a generic "spam".
  'financial_scam',
  'threats',
  'stolen_photos',
  'misleading_info',
];

const HIGH_RISK_REASONS = ['threats', 'underage', 'financial_scam', 'stolen_photos', 'inappropriate_content'];

module.exports = { REPORT_REASONS, HIGH_RISK_REASONS };
