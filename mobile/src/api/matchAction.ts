import type { MatchActionResponse } from '../types';

/**
 * POST /match/:id answers `{ success, match, isMutual }`. The shared type (and every screen)
 * reads `isMutualMatch`, so for as long as the client trusted the type instead of the wire the
 * mutual-match celebration and the "It's a match" bar state could never fire from a profile.
 * Normalise once, here, keeping either spelling so a server that ever sends both stays correct.
 */
export function normalizeMatchActionResponse(
  raw: Partial<MatchActionResponse> & { isMutual?: boolean },
): MatchActionResponse {
  return {
    ...raw,
    isMutualMatch: raw.isMutualMatch ?? raw.isMutual ?? raw.match?.isMutual ?? false,
  } as MatchActionResponse;
}
