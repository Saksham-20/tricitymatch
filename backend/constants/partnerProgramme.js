'use strict';

/**
 * Version of the Partner Guide (the rules and earnings terms a marketing
 * partner agrees to). An ISO date, because the guide shows it as "last updated".
 *
 * Bump this whenever the rules or the money terms change in a way a partner
 * must re-accept; every partner is then asked again before creating new codes
 * or adding leads (see utils/partnerOnboarding.requirePartnerAgreement).
 */
const PARTNER_GUIDE_VERSION = '2026-10-05';

module.exports = { PARTNER_GUIDE_VERSION };
