// Client-side allowlist of profile fields that may be sent to PUT /profile/me.
// Mirrors the backend PROFILE_EDITABLE_FIELDS (+ photo fields). The backend
// stripper is the real trust boundary, but building the request from a whitelist
// means we NEVER put password/identifier/email/verification flags on the wire.
export const PROFILE_SUBMIT_FIELDS = [
  'firstName', 'lastName', 'gender', 'dateOfBirth', 'height', 'weight',
  'city', 'state', 'skinTone', 'diet', 'smoking', 'drinking',
  'education', 'degree', 'profession', 'income',
  'religion', 'caste', 'subCaste', 'gotra', 'motherTongue',
  'maritalStatus', 'numberOfChildren',
  'placeOfBirth', 'birthTime', 'manglikStatus', 'zodiacSign', 'rashi', 'nakshatra',
  'familyType', 'familyStatus', 'fatherOccupation', 'motherOccupation', 'numberOfSiblings',
  'preferredAgeMin', 'preferredAgeMax', 'preferredHeightMin', 'preferredHeightMax',
  'preferredEducation', 'preferredProfession', 'preferredCity',
  'personalityValues', 'familyPreferences', 'lifestylePreferences',
  'bio', 'interestTags', 'profilePrompts', 'quizAnswers',
  'spotifyPlaylist', 'socialMediaLinks', 'personalityType', 'languages',
  'showPhone', 'showEmail', 'incognitoMode', 'photoBlurUntilMatch',
  'profilePhoto', 'photos',
];

const SUBMIT_SET = new Set(PROFILE_SUBMIT_FIELDS);

/**
 * Build a multipart FormData for PUT /profile/me from the onboarding formData,
 * appending ONLY whitelisted profile fields. Handles File (photos), arrays
 * (multi-appended so multer parses an array), objects (JSON-stringified), and
 * primitives (skipping '', null, undefined).
 */
export const buildProfileFormData = (formData = {}) => {
  const fd = new FormData();
  Object.entries(formData).forEach(([key, value]) => {
    if (!SUBMIT_SET.has(key)) return; // never send account/verification fields
    if (value instanceof File) {
      fd.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => fd.append(key, item));
    } else if (typeof value === 'object' && value !== null) {
      fd.append(key, JSON.stringify(value));
    } else if (value !== null && value !== undefined && value !== '') {
      fd.append(key, value);
    }
  });
  return fd;
};
