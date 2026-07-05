/**
 * Guards the profile-field allowlists against the drift that silently dropped
 * religion/caste/family/horoscope/numberOfSiblings on PUT /profile/me.
 */
const {
  PROFILE_EDITABLE_FIELDS,
  PROFILE_STRIPPER_ALLOWLIST,
  NULLABLE_NONSTRING_FIELDS,
} = require('../../constants/profileFields');
const { allowedProfileFields } = require('../../validators');
const Profile = require('../../models/Profile');

describe('profile field allowlists', () => {
  test('validator stripper is wired to the single source of truth', () => {
    expect(allowedProfileFields).toBe(PROFILE_STRIPPER_ALLOWLIST);
  });

  test('stripper allowlist = editable fields + photo fields (nothing else)', () => {
    expect(PROFILE_STRIPPER_ALLOWLIST).toEqual([
      ...PROFILE_EDITABLE_FIELDS,
      'profilePhoto',
      'photos',
    ]);
  });

  test('numberOfSiblings is editable (the reset-to-0 regression)', () => {
    expect(PROFILE_EDITABLE_FIELDS).toContain('numberOfSiblings');
  });

  test('every previously-dropped field is now editable', () => {
    [
      'religion', 'caste', 'subCaste', 'gotra', 'motherTongue',
      'maritalStatus', 'numberOfChildren',
      'placeOfBirth', 'birthTime', 'manglikStatus', 'zodiacSign', 'rashi', 'nakshatra',
      'familyType', 'familyStatus', 'fatherOccupation', 'motherOccupation', 'numberOfSiblings',
    ].forEach((f) => expect(PROFILE_EDITABLE_FIELDS).toContain(f));
  });

  test('server-controlled / sensitive fields are NEVER client-settable', () => {
    for (const field of ['onboardingComplete', 'completionPercentage', 'verified', 'isActive', 'id', 'userId']) {
      expect(PROFILE_EDITABLE_FIELDS).not.toContain(field);
      expect(PROFILE_STRIPPER_ALLOWLIST).not.toContain(field);
    }
    // account/auth fields must never survive the stripper either
    for (const field of ['password', 'email', 'phone', 'identifier', 'phoneVerification', 'emailVerification']) {
      expect(PROFILE_STRIPPER_ALLOWLIST).not.toContain(field);
    }
  });

  test('every editable field is a real Profile column (no typos/ghost fields)', () => {
    const columns = new Set(Object.keys(Profile.rawAttributes));
    PROFILE_EDITABLE_FIELDS.forEach((f) => expect(columns.has(f)).toBe(true));
  });

  test('nullable enum/int coercion list is a subset of editable fields', () => {
    NULLABLE_NONSTRING_FIELDS.forEach((f) => expect(PROFILE_EDITABLE_FIELDS).toContain(f));
  });

  test('stripper simulation keeps editable, drops account + server fields', () => {
    const body = {
      caste: 'Khatri', numberOfSiblings: '3', manglikStatus: 'non_manglik',
      password: 'hunter2', onboardingComplete: true, email: 'x@y.com', id: 'uuid',
    };
    const allowed = new Set(PROFILE_STRIPPER_ALLOWLIST);
    const stripped = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.has(k))
    );
    expect(stripped).toEqual({ caste: 'Khatri', numberOfSiblings: '3', manglikStatus: 'non_manglik' });
    expect(stripped).not.toHaveProperty('password');
    expect(stripped).not.toHaveProperty('onboardingComplete');
  });
});
