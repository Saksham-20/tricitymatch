/**
 * List cards carry a fixed set of fields. The whole Profile row (about 85 keys)
 * used to leave in every search result.
 */
const { toCardProfile, CARD_KEYS } = require('../../utils/profileVisibility');

describe('toCardProfile', () => {
  const full = {
    id: 'p1', userId: 'u1', firstName: 'Asha', lastName: 'Verma', gender: 'female', dateOfBirth: '1996-04-12', height: 165,
    city: 'Mohali', state: 'Punjab', religion: 'hindu', caste: 'khatri', profession: 'Engineer', education: 'Masters',
    profilePhoto: 'https://x/a.jpg', photos: ['https://x/a.jpg'], completionPercentage: 88,
    isVerified: true, compatibilityScore: 91, matchStatus: null, isMutual: false, isBoosted: false, isPremium: true, premiumPlan: 'premium_plus',
    rankScore: 12, rankFactors: { verified: 5 }, reasons: ['Same city'],
    // things a card must NOT carry
    birthTime: '06:15', placeOfBirth: 'Chandigarh', bio: 'long text', fatherOccupation: 'Banker', motherOccupation: 'Teacher',
    brothers: 1, sisters: 0, familyLocation: 'Mohali', nakshatra: 'ashwini', rashi: 'mesha', gotra: 'kashyap', income: 1200000,
    preferredAgeMin: 24, preferredAgeMax: 32, profilePrompts: { a: 'b' }, socialMediaLinks: [], interestTags: ['x'],
    createdAt: '2026-01-01', updatedAt: '2026-01-02', voiceIntroUrl: 'https://x/v', videoIntroUrl: 'https://x/vid',
    User: { id: 'u1', email: 'a@example.com', phone: '9876543210' }, email: 'a@example.com', phone: '9876543210',
  };

  it('keeps what the web and mobile cards read', () => {
    const card = toCardProfile(full);
    for (const key of ['id', 'userId', 'firstName', 'lastName', 'dateOfBirth', 'city', 'profession', 'education', 'profilePhoto', 'photos', 'isVerified', 'compatibilityScore', 'matchStatus', 'isPremium', 'premiumPlan', 'isBoosted', 'reasons']) {
      expect(card).toHaveProperty(key);
    }
  });

  it.each([
    'birthTime', 'placeOfBirth', 'bio', 'fatherOccupation', 'motherOccupation', 'brothers', 'sisters', 'familyLocation',
    'nakshatra', 'rashi', 'gotra', 'income', 'preferredAgeMin', 'profilePrompts', 'socialMediaLinks', 'interestTags',
    'rankScore', 'rankFactors', 'createdAt', 'updatedAt', 'voiceIntroUrl', 'videoIntroUrl', 'User', 'email', 'phone',
  ])('never carries %s', (key) => {
    expect(toCardProfile(full)).not.toHaveProperty(key);
  });

  it('is a small, fixed set and ignores keys that are absent', () => {
    expect(Object.keys(toCardProfile(full)).length).toBeLessThanOrEqual(CARD_KEYS.length);
    expect(toCardProfile({ userId: 'u' })).toEqual({ userId: 'u' });
    expect(CARD_KEYS.length).toBeLessThan(40);
  });
});
