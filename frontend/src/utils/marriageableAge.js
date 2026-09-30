// Minimum age to hold a profile: 21 for men, 18 for women, 21 for "other" and for
// an unknown gender. Mirrors backend/constants/marriageableAge.js — the server is
// the authority; this only gives members the answer before they submit.
export const minAgeFor = (gender) => (gender === 'female' ? 18 : 21);

// For pickers shown BEFORE gender is chosen: the loosest bound, so a woman is not
// blocked from picking her birth year. Submit validation uses minAgeFor(gender).
export const pickerMinAge = (gender) => (gender ? minAgeFor(gender) : 18);

export const minAgeMessage = (gender) => `You must be at least ${minAgeFor(gender)} years old`;
