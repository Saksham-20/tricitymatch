// Client-side allowlist of profile fields that may be sent to PUT /profile/me.
// Mirrors the backend PROFILE_EDITABLE_FIELDS (+ photo fields). The backend
// stripper is the real trust boundary, but building the request from a whitelist
// means we NEVER put password/identifier/email/verification flags on the wire.
export const PROFILE_SUBMIT_FIELDS = [
  'firstName', 'lastName', 'gender', 'dateOfBirth', 'height', 'weight',
  'city', 'state', 'isNri', 'residenceCountry', 'residenceStatus', 'familyLocation',
  'skinTone', 'diet', 'smoking', 'drinking',
  'education', 'degree', 'profession', 'income',
  'religion', 'caste', 'subCaste', 'gotra', 'motherTongue',
  'maritalStatus', 'numberOfChildren',
  'placeOfBirth', 'birthTime', 'manglikStatus', 'zodiacSign', 'rashi', 'nakshatra',
  'familyType', 'familyStatus', 'fatherOccupation', 'motherOccupation', 'numberOfSiblings',
  'brothers', 'sisters', 'familyValues', 'livingArrangement',
  'nationality', 'willingToRelocate', 'institution', 'industry',
  'preferredAgeMin', 'preferredAgeMax', 'preferredHeightMin', 'preferredHeightMax',
  'preferredEducation', 'preferredProfession', 'preferredCity', 'mustHavePreferences',
  'personalityValues', 'familyPreferences', 'lifestylePreferences',
  'bio', 'interestTags', 'profilePrompts', 'quizAnswers',
  'spotifyPlaylist', 'socialMediaLinks', 'personalityType', 'languages',
  'showPhone', 'showEmail', 'incognitoMode', 'photoBlurUntilMatch', 'excludeSameGotra',
  'profilePhoto', 'photos',
];

const SUBMIT_SET = new Set(PROFILE_SUBMIT_FIELDS);

// Array fields the backend coerces via `value ? [value] : []`, so sending an
// empty string clears them. Lets a member remove ALL interests / preferred
// cities and have it persist (previously an empty array appended nothing, the
// key was absent, and the backend kept the old value). `photos` is excluded —
// it's handled as file uploads, not a clearable text array.
const CLEARABLE_ARRAY_FIELDS = new Set(['preferredCity', 'interestTags', 'languages', 'mustHavePreferences']);

// Fields the editor must never blank: identity (locked/critical server-side)
// and city (required for search). The server ignores '' for these anyway.
const NEVER_CLEARED = new Set(['firstName', 'lastName', 'gender', 'dateOfBirth', 'city', 'profilePhoto', 'photos']);

const isEmptyValue = (v) => v === '' || v === null || v === undefined;

/**
 * Build a multipart FormData for PUT /profile/me from the onboarding formData,
 * appending ONLY whitelisted profile fields. Handles File (photos), arrays
 * (multi-appended so multer parses an array), objects (JSON-stringified), and
 * primitives (skipping '', null, undefined).
 *
 * Edit mode passes `baseline` (the hydrated values the member started from): a
 * scalar that held a value there and is now empty is sent as '' so the server
 * clears it. Without a baseline (signup) an empty value is simply not sent, as
 * there is nothing stored to clear.
 */
export const buildProfileFormData = (formData = {}, { baseline } = {}) => {
  const fd = new FormData();
  Object.entries(formData).forEach(([key, value]) => {
    if (!SUBMIT_SET.has(key)) return; // never send account/verification fields
    if (value instanceof File) {
      fd.append(key, value);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        // Send an explicit empty so the backend clears it (skip photos & others).
        if (CLEARABLE_ARRAY_FIELDS.has(key)) fd.append(key, '');
      } else {
        value.forEach((item) => fd.append(key, item));
      }
    } else if (typeof value === 'object' && value !== null) {
      fd.append(key, JSON.stringify(value));
    } else if (!isEmptyValue(value)) {
      fd.append(key, value);
    }
  });
  if (baseline) {
    PROFILE_SUBMIT_FIELDS.forEach((key) => {
      if (NEVER_CLEARED.has(key) || CLEARABLE_ARRAY_FIELDS.has(key)) return;
      const now = formData[key];
      const before = baseline[key];
      // Only plain scalars are cleared this way; objects/arrays have their own paths.
      if (isEmptyValue(now) && !isEmptyValue(before) && typeof before !== 'object' && !fd.has(key)) {
        fd.append(key, '');
      }
    });
  }
  return fd;
};
