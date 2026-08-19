import type { ProfileSummary } from './profile';

export type MatchAction = 'like' | 'shortlist' | 'pass';
export type InterestStatus = 'pending' | 'accepted' | 'declined';

export interface Match {
  id: string;
  userId: string;
  matchedUserId: string;
  action: MatchAction;
  compatibilityScore: number | null;
  isMutual: boolean;
  mutualMatchDate: string | null;
  createdAt: string;
  updatedAt: string;
  /** D3 like-with-note — optional note the liker attached (like action only). */
  note?: string | null;
  /** D3/ES8 — content SNAPSHOT of the liked thing (never index-keyed). */
  likedItem?: { type: 'photo'; photoUrl: string } | { type: 'prompt'; promptText: string } | null;
  // Associations
  MatchedProfile?: ProfileSummary;
}

export interface MatchActionResponse {
  message: string;
  isMutualMatch: boolean;
  match: Match;
}
