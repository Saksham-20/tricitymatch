import { detectContactType } from '../components/onboarding/SmartContactField';

/**
 * Fields only the "create it for someone else" (guardian) signup uses, with
 * their blank values. A personal signup must never carry them: the server
 * refuses a signup that says the profile is for someone else unless the
 * operator attests to it, and the personal form has no such checkbox.
 */
export const GUARDIAN_RESET = {
  creatingFor: 'self',
  relationshipToProfile: '',
  yourName: '',
  yourPhone: '',
  yourEmail: '',
  account_attest: false,
};

/**
 * True when a personal signup still holds what the server needs to create the
 * account: the password and the single-use proof that the sign-in contact was
 * verified. Neither is ever saved with the draft, so a resumed draft lacks both.
 */
export const hasSignupCredentials = (formData = {}) => {
  if (!formData.password) return false;
  const type = detectContactType(formData.identifier);
  if (type === 'email') return Boolean(formData.emailProof);
  if (type === 'phone') return Boolean(formData.phoneProof);
  return false;
};

/**
 * The POST /auth/signup body for the onboarding form.
 *
 * @param {object} formData  onboarding form state
 * @param {object} options
 * @param {'signup'|'create_for_other'} options.mode
 * @param {string} [options.invite]  raw member-invite token from the URL
 */
export const buildSignupPayload = (formData, { mode, invite } = {}) => {
  const payload = { ...formData };
  // The raw token, not the resolved name: the server re-validates it at
  // signup time (the inviter may have been deleted since the page loaded),
  // and sends it even when the kicker never rendered — a token that failed
  // to RESOLVE (rate limit, transient 500) may still be perfectly valid.
  if (invite) payload.invite = invite;
  // What the member actually ticked, stated in the request itself. The server
  // rejects a signup that does not assert termsAccepted.
  payload.termsAccepted = !!formData.account_agree;
  payload.marketingConsent = !!formData.account_marketing;
  payload.subjectAttestation = !!formData.account_attest;
  if (payload.phone) payload.phone = String(payload.phone).replace(/[\s-]/g, '');
  if (!payload.email) delete payload.email; // phone-only signup
  if (mode === 'signup') {
    // A personal signup is for the member themselves, whatever an old guardian
    // draft left behind.
    payload.creatingFor = 'self';
    ['relationshipToProfile', 'subjectAttestation', 'yourName', 'yourPhone', 'yourEmail', 'account_attest']
      .forEach((key) => { delete payload[key]; });
  }
  return payload;
};
