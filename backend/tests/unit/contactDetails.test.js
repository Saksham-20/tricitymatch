/**
 * Which number is revealed, and whether the owner's sharing choice lets a
 * given viewer have it.
 */
jest.mock('../../utils/entitlements', () => ({ isMutualMatch: jest.fn() }));

const { isMutualMatch } = require('../../utils/entitlements');
const { revealablePhone, contactOf, contactShareFor } = require('../../utils/contactDetails');

beforeEach(() => jest.clearAllMocks());

describe('revealablePhone', () => {
  test('a verified login number is revealed', () => {
    expect(revealablePhone({ phone: '9876543210', phoneVerified: true })).toBe('9876543210');
  });
  test('an unverified login number is never revealed', () => {
    expect(revealablePhone({ phone: '9876543210', phoneVerified: false })).toBeNull();
  });
  test('a separate contact number wins over the login number', () => {
    expect(revealablePhone({ phone: '9876543210', phoneVerified: true, contactPhone: '9123456789' })).toBe('9123456789');
  });
  test('nothing for a missing user', () => {
    expect(revealablePhone(null)).toBeNull();
    expect(contactOf(null)).toEqual({ phone: null, email: null });
  });
});

describe('contactShareFor', () => {
  test('defaults to everyone, so existing members are unchanged', async () => {
    expect(await contactShareFor({}, 'owner', 'viewer')).toMatchObject({ level: 'everyone', allowed: true });
    expect(await contactShareFor(undefined, 'owner', 'viewer')).toMatchObject({ allowed: true });
    expect(isMutualMatch).not.toHaveBeenCalled();
  });
  test('hidden blocks everyone, even a mutual match', async () => {
    isMutualMatch.mockResolvedValue(true);
    expect(await contactShareFor({ contact: 'hidden' }, 'owner', 'viewer'))
      .toEqual({ level: 'hidden', allowed: false, reason: 'CONTACT_NOT_SHARED' });
  });
  test('matches lets a mutual match through and blocks a stranger', async () => {
    isMutualMatch.mockResolvedValueOnce(true);
    expect(await contactShareFor({ contact: 'matches' }, 'owner', 'viewer')).toMatchObject({ allowed: true });
    isMutualMatch.mockResolvedValueOnce(false);
    expect(await contactShareFor({ contact: 'matches' }, 'owner', 'viewer'))
      .toEqual({ level: 'matches', allowed: false, reason: 'CONTACT_MATCHES_ONLY' });
  });
  test('an unknown level falls back to everyone', async () => {
    expect(await contactShareFor({ contact: 'secret' }, 'owner', 'viewer')).toMatchObject({ allowed: true });
  });
});

describe('the contact group in field visibility', () => {
  const { sanitizeFieldVisibility, applyFieldVisibility } = require('../../constants/fieldVisibility');
  test('is accepted by the sanitiser and rejects unknown levels', () => {
    expect(sanitizeFieldVisibility({ contact: 'matches', income: 'hidden' })).toEqual({ contact: 'matches', income: 'hidden' });
    expect(sanitizeFieldVisibility({ contact: 'nobody' })).toEqual({});
  });
  test('has no Profile column, so applying it never blanks other fields', () => {
    const profile = { income: 5, birthTime: 'x', fieldVisibility: { contact: 'hidden' } };
    expect(applyFieldVisibility(profile, { isMutual: false })).toMatchObject({ income: 5, birthTime: 'x' });
  });
});
