import type { Gender, ProfileSummary } from '../types';

const GENDERS: readonly string[] = ['male', 'female', 'other'];

/**
 * The API returns gender as a plain string, while ProfileSummary types it as a
 * union. The old `as unknown as` casts hid that mismatch entirely; narrowing it
 * here means an unexpected value becomes `null` (rendered as "not stated")
 * rather than a string that fails an === comparison somewhere downstream.
 */
const toGender = (value: unknown): Gender | null =>
  typeof value === 'string' && GENDERS.includes(value) ? (value as Gender) : null;

/**
 * Build a complete `ProfileSummary` from the partial shapes the list endpoints
 * return.
 *
 * Several endpoints (conversations, match lists, profile viewers) return a
 * trimmed profile: enough to render a row, not the full record. The client used
 * to bridge that gap with `as unknown as ProfileSummary`, which silences the
 * compiler about EVERY missing field at once. That is not a style problem — the
 * object really is missing required fields at runtime, so `profile.photos.map(...)`
 * on a screen that assumed a full summary throws on undefined, and `city` renders
 * as the string "undefined".
 *
 * Filling the gaps explicitly here means:
 *   - the defaults are visible and chosen, not accidental
 *   - a NEW required field on ProfileSummary becomes a compile error in one
 *     place instead of silently arriving as undefined in a dozen screens
 *
 * Fields the caller genuinely knows are passed through; everything else gets a
 * neutral empty value of the right type.
 */
type PartialSummary = Omit<Partial<ProfileSummary>, 'gender'> & {
  userId: string;
  /** Loosened on purpose — callers pass the raw API string. */
  gender?: string | null;
};

export const toProfileSummary = (partial: PartialSummary): ProfileSummary => ({
  id: partial.id ?? partial.userId,
  userId: partial.userId,
  firstName: partial.firstName ?? '',
  lastName: partial.lastName ?? '',
  gender: toGender(partial.gender),
  dateOfBirth: partial.dateOfBirth ?? null,
  height: partial.height ?? null,
  city: partial.city ?? '',
  state: partial.state ?? '',
  religion: partial.religion ?? null,
  caste: partial.caste ?? null,
  profession: partial.profession ?? null,
  education: partial.education ?? null,
  profilePhoto: partial.profilePhoto ?? null,
  // Empty array, never undefined — screens map over this directly.
  photos: partial.photos ?? [],
  completionPercentage: partial.completionPercentage ?? 0,
  isVerified: partial.isVerified ?? false,
  compatibilityScore: partial.compatibilityScore,
  isBoosted: partial.isBoosted ?? false,
});
