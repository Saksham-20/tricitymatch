/**
 * Single source of truth for user-editable Profile fields.
 *
 * Two consumers derive from PROFILE_EDITABLE_FIELDS and MUST stay in sync — a
 * drift here was the root cause of the silent data-loss bug where the profile
 * editor sent religion/caste/family/horoscope/numberOfSiblings but the validator
 * stripped them before the controller ran:
 *   1. validators/index.js  — the `body().custom()` mass-assignment stripper.
 *      Its allowlist = PROFILE_EDITABLE_FIELDS + ['profilePhoto','photos'] so the
 *      photo fields survive validation for the controller's file/gallery logic.
 *   2. controllers/profileController.js — the update loop iterates exactly
 *      PROFILE_EDITABLE_FIELDS (photos + profilePhoto are handled from req.files,
 *      not the loop).
 *
 * DELIBERATELY EXCLUDED (server-controlled — never client-settable via PUT /me):
 *   - onboardingComplete   (set at signup; a gating flag)
 *   - completionPercentage (computed server-side)
 *   - verified, isActive, id, userId, timestamps
 */

// Enum/int columns that are nullable in the DB. An empty string from a
// multipart form must be coerced to null (not passed through) or Postgres
// throws a 22P02 / invalid-enum error (a 500). String free-text fields are
// intentionally NOT here — '' is a valid "clear this field" for them.
const NULLABLE_NONSTRING_FIELDS = [
  // enums
  'gender', 'skinTone', 'diet', 'smoking', 'drinking',
  'maritalStatus', 'manglikStatus', 'familyType', 'familyStatus',
  // integers
  'height', 'weight', 'income', 'numberOfChildren', 'numberOfSiblings',
  'preferredAgeMin', 'preferredAgeMax', 'preferredHeightMin', 'preferredHeightMax',
];

const PROFILE_EDITABLE_FIELDS = [
  // Basic
  'firstName', 'lastName', 'gender', 'dateOfBirth', 'height', 'weight',
  // Location
  'city', 'state',
  // Lifestyle
  'skinTone', 'diet', 'smoking', 'drinking',
  // Education & career
  'education', 'degree', 'profession', 'income',
  // Religion & community
  'religion', 'caste', 'subCaste', 'gotra', 'motherTongue',
  // Marital
  'maritalStatus', 'numberOfChildren',
  // Horoscope / Kundli
  'placeOfBirth', 'birthTime', 'manglikStatus', 'zodiacSign', 'rashi', 'nakshatra',
  // Family
  'familyType', 'familyStatus', 'fatherOccupation', 'motherOccupation', 'numberOfSiblings',
  // Preferences
  'preferredAgeMin', 'preferredAgeMax', 'preferredHeightMin', 'preferredHeightMax',
  'preferredEducation', 'preferredProfession', 'preferredCity',
  // Rich/JSON
  'personalityValues', 'familyPreferences', 'lifestylePreferences',
  'bio', 'interestTags', 'profilePrompts', 'quizAnswers',
  'spotifyPlaylist', 'socialMediaLinks', 'personalityType', 'languages',
  // Privacy toggles (already client-editable pre-fix)
  'showPhone', 'showEmail', 'incognitoMode', 'photoBlurUntilMatch',
];

// The validator stripper must additionally let the photo fields through so the
// controller can read them from req.body (set-as-profile-photo-from-gallery).
const PROFILE_STRIPPER_ALLOWLIST = [...PROFILE_EDITABLE_FIELDS, 'profilePhoto', 'photos'];

module.exports = {
  PROFILE_EDITABLE_FIELDS,
  PROFILE_STRIPPER_ALLOWLIST,
  NULLABLE_NONSTRING_FIELDS,
};
