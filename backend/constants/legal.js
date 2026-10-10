/**
 * Version tag stamped onto Users.termsVersion at account creation (DPDP consent
 * record). MUST move in lockstep with the "Last updated" date shown on the
 * legal pages:
 *   - frontend/src/config/index.js  → legal.termsUpdated / legal.privacyUpdated
 *   - mobile/src/constants/config.ts → LEGAL_UPDATED
 * Bump all of them together whenever the Terms or Privacy Policy change. The
 * version is the LATER of the two web dates, as YYYY-MM-DD; a unit test
 * (tests/unit/termsVersionLockstep.test.js) fails when they drift apart.
 */
const TERMS_VERSION = '2026-10-10';

/**
 * Marker for an account an admin created on a member's behalf (assisted
 * signup). Nobody has accepted anything yet, so it is not the current version
 * and needsReconsent() puts the accept screen in front of the member at their
 * first sign-in. Accepting replaces it with the real version.
 */
const ASSISTED_SIGNUP_TERMS = 'assisted-signup';

/**
 * A member must accept again when the Terms move on from the version they
 * accepted. NULL means the account pre-dates the consent record (they accepted
 * the original notice at signup), which is deliberately NOT a reason to lock
 * every existing member out on deploy.
 */
const needsReconsent = (user) => Boolean(user && user.termsVersion && user.termsVersion !== TERMS_VERSION);

module.exports = {
  TERMS_VERSION,
  ASSISTED_SIGNUP_TERMS,
  needsReconsent,
};
