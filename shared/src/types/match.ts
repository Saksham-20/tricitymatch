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
  // Associations
  MatchedProfile?: ProfileSummary;
}

export interface MatchActionResponse {
  message: string;
  isMutualMatch: boolean;
  match: Match;
}
