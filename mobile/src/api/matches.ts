import { apiClient } from './client';
import type { Match, MatchAction, MatchActionResponse, ProfileSummary } from '../types';

// Backend wraps list responses as { success, <key>, pagination } — unwrap to the inner key.

// The match list endpoints return a FLAT profile-ish item, not the nested
// { MatchedProfile, compatibilityScore } shape the screens read. Map it here.
interface RawMatchItem {
  userId: string;
  firstName: string;
  lastName: string;
  city?: string;
  profilePhoto?: string | null;
  gender?: string;
  dateOfBirth?: string;
  education?: string;
  profession?: string;
  compatibilityScore?: string | number | null;
  matchedAt?: string;
  likedAt?: string;
}

const toMatch = (m: RawMatchItem, isMutual: boolean): Match => {
  const score = m.compatibilityScore != null ? Number(m.compatibilityScore) : null;
  const when = m.matchedAt ?? m.likedAt ?? '';
  return {
    id: m.userId,
    userId: '',
    matchedUserId: m.userId,
    action: 'like' as MatchAction,
    compatibilityScore: score,
    isMutual,
    mutualMatchDate: m.matchedAt ?? null,
    createdAt: when,
    updatedAt: when,
    MatchedProfile: {
      id: m.userId,
      firstName: m.firstName,
      lastName: m.lastName,
      city: m.city,
      profilePhoto: m.profilePhoto ?? null,
      dateOfBirth: m.dateOfBirth ?? null,
      education: m.education,
      profession: m.profession,
      gender: m.gender,
      compatibilityScore: score ?? undefined,
    } as unknown as ProfileSummary,
  };
};

export const performMatchAction = async (
  userId: string,
  action: MatchAction
): Promise<MatchActionResponse> => {
  const res = await apiClient.post<MatchActionResponse>(`/match/${userId}`, { action });
  return res.data;
};

export const getDailyFeed = async (): Promise<ProfileSummary[]> => {
  const res = await apiClient.get<{ matches: ProfileSummary[] }>('/match/daily');
  return res.data.matches ?? [];
};

export const getMutualMatches = async (): Promise<Match[]> => {
  const res = await apiClient.get<{ mutualMatches: RawMatchItem[] }>('/match/mutual');
  return (res.data.mutualMatches ?? []).map((m) => toMatch(m, true));
};

export const getShortlisted = async (): Promise<Match[]> => {
  const res = await apiClient.get<{ shortlisted: RawMatchItem[] }>('/match/shortlist');
  return (res.data.shortlisted ?? []).map((m) => toMatch(m, false));
};

export const getLikedMe = async (): Promise<Match[]> => {
  const res = await apiClient.get<{ likes: RawMatchItem[] }>('/match/likes');
  return (res.data.likes ?? []).map((m) => toMatch(m, false));
};

export const unlockContact = async (userId: string): Promise<{ phone: string }> => {
  const res = await apiClient.post<{ contact: { phone: string } }>(`/profile/${userId}/unlock-contact`);
  return res.data.contact;
};
