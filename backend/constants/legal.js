/**
 * Version tag stamped onto Users.termsVersion at account creation (DPDP consent
 * record). MUST move in lockstep with the "Last updated" date shown on the
 * legal pages:
 *   - frontend/src/config/index.js  → legal.termsUpdated / legal.privacyUpdated
 *   - mobile/src/constants/config.ts → LEGAL_UPDATED
 * Bump all of them together whenever the Terms or Privacy Policy change.
 */
module.exports = {
  TERMS_VERSION: '2026-08-26',
};
