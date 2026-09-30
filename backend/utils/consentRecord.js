'use strict';

/**
 * The consent evidence stored on Users.consent (DPDP): what was accepted, when,
 * from where, and the optional choices that are NOT a condition of the service.
 */

const { TERMS_VERSION } = require('../constants/legal');

const truthy = (v) => v === true || v === 'true';

const clientMeta = (req) => ({
  ip: req.ip || null,
  userAgent: String(req.get?.('user-agent') || '').slice(0, 200) || null,
});

/**
 * @param {object} req
 * @param {object} [opts]
 * @param {boolean} [opts.marketing]        optional: promotional email
 * @param {string}  [opts.createdFor]       who the profile is for ('self' | 'parent' | ...)
 * @param {boolean} [opts.subjectAttested]  operator attests the subject is of legal age and agrees
 */
const buildConsent = (req, { marketing = false, createdFor = null, subjectAttested = false } = {}, now = new Date()) => ({
  termsVersion: TERMS_VERSION,
  acceptedAt: now.toISOString(),
  ...clientMeta(req),
  marketing: truthy(marketing),
  ...(createdFor && createdFor !== 'self' ? { createdFor } : {}),
  ...(subjectAttested ? { subjectAttestedAt: now.toISOString() } : {}),
  history: [],
});

/** Record a re-acceptance, keeping what came before (capped). */
const renewConsent = (previous, req, now = new Date()) => {
  const prior = previous && typeof previous === 'object' ? previous : {};
  const history = [
    ...(Array.isArray(prior.history) ? prior.history : []),
    ...(prior.termsVersion ? [{ termsVersion: prior.termsVersion, acceptedAt: prior.acceptedAt || null }] : []),
  ].slice(-10);
  return { ...prior, termsVersion: TERMS_VERSION, acceptedAt: now.toISOString(), ...clientMeta(req), history };
};

module.exports = { buildConsent, renewConsent, truthy };
