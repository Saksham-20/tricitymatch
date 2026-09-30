/**
 * Version tag stamped onto Users.termsVersion at account creation (DPDP consent
 * record). MUST move in lockstep with the "Last updated" date shown on the
 * legal pages:
 *   - frontend/src/config/index.js  → legal.termsUpdated / legal.privacyUpdated
 *   - mobile/src/constants/config.ts → LEGAL_UPDATED
 * Bump all of them together whenever the Terms or Privacy Policy change.
 */
const TERMS_VERSION = '2026-08-26';

/**
 * A member must accept again when the Terms move on from the version they
 * accepted. NULL means the account pre-dates the consent record (they accepted
 * the original notice at signup), which is deliberately NOT a reason to lock
 * every existing member out on deploy.
 */
const needsReconsent = (user) => Boolean(user && user.termsVersion && user.termsVersion !== TERMS_VERSION);

module.exports = {
  TERMS_VERSION,
  needsReconsent,
};
