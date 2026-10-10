/**
 * FUN-01 / FUN-02: the self-signup request body and the "can this draft still
 * sign up?" check. A guardian draft must never leak into a personal signup, and
 * a resumed draft (no password, no proof) must not be sent at all.
 */
import { describe, it, expect } from 'vitest';
import { buildSignupPayload, hasSignupCredentials, GUARDIAN_RESET } from '../../utils/signupPayload';

const guardianDraft = {
  identifier: 'me@example.com',
  email: 'me@example.com',
  password: 'Str0ng!Pass',
  emailProof: 'proof-123',
  account_agree: true,
  account_marketing: false,
  account_attest: true,
  creatingFor: 'other',
  relationshipToProfile: 'parent',
  yourName: 'Asha',
  yourPhone: '9876543210',
  yourEmail: 'asha@example.com',
  firstName: 'Ravi',
};

describe('buildSignupPayload', () => {
  it('a personal signup is always for self and carries no guardian fields', () => {
    const body = buildSignupPayload(guardianDraft, { mode: 'signup' });
    expect(body.creatingFor).toBe('self');
    for (const key of ['relationshipToProfile', 'subjectAttestation', 'yourName', 'yourPhone', 'yourEmail', 'account_attest']) {
      expect(body).not.toHaveProperty(key);
    }
    expect(body.termsAccepted).toBe(true);
    expect(body.marketingConsent).toBe(false);
    expect(body.firstName).toBe('Ravi');
  });

  it('the guardian flow keeps who it is for and the attestation', () => {
    const body = buildSignupPayload(guardianDraft, { mode: 'create_for_other' });
    expect(body.creatingFor).toBe('other');
    expect(body.relationshipToProfile).toBe('parent');
    expect(body.subjectAttestation).toBe(true);
    expect(body.yourName).toBe('Asha');
  });

  it('adds the invite token, tidies the phone and drops an empty email', () => {
    const body = buildSignupPayload(
      { identifier: '98765 43210', phone: '98765 43210', email: '', password: 'x', phoneProof: 'p', account_agree: true },
      { mode: 'signup', invite: 'inv-1' },
    );
    expect(body.invite).toBe('inv-1');
    expect(body.phone).toBe('9876543210');
    expect(body).not.toHaveProperty('email');
  });
});

describe('hasSignupCredentials', () => {
  it('needs the password and the proof for the sign-in contact', () => {
    expect(hasSignupCredentials({ identifier: 'me@example.com', password: 'x', emailProof: 'p' })).toBe(true);
    expect(hasSignupCredentials({ identifier: '9876543210', password: 'x', phoneProof: 'p' })).toBe(true);
  });

  it('a resumed draft (no password or no proof) cannot sign up', () => {
    expect(hasSignupCredentials({ identifier: 'me@example.com', password: '', emailProof: 'p' })).toBe(false);
    expect(hasSignupCredentials({ identifier: 'me@example.com', password: 'x', emailProof: '' })).toBe(false);
    // A phone proof does not stand in for the email the member signs in with.
    expect(hasSignupCredentials({ identifier: 'me@example.com', password: 'x', phoneProof: 'p' })).toBe(false);
    expect(hasSignupCredentials({ identifier: '', password: 'x', emailProof: 'p' })).toBe(false);
  });
});

it('GUARDIAN_RESET blanks every guardian-only field', () => {
  expect(GUARDIAN_RESET).toEqual({
    creatingFor: 'self', relationshipToProfile: '', yourName: '', yourPhone: '', yourEmail: '', account_attest: false,
  });
});
