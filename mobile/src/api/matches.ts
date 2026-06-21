import { apiClient } from './client';
import type { Match, MatchAction, MatchActionResponse, ProfileSummary } from '../types';

// Backend wraps list responses as { success, <key>, pagination } — unwrap to the inner key.

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
  const res = await apiClient.get<{ mutualMatches: Match[] }>('/match/mutual');
  return res.data.mutualMatches ?? [];
};

export const getShortlisted = async (): Promise<Match[]> => {
  const res = await apiClient.get<{ shortlisted: Match[] }>('/match/shortlist');
  return res.data.shortlisted ?? [];
};

export const getLikedMe = async (): Promise<Match[]> => {
  const res = await apiClient.get<{ likes: Match[] }>('/match/likes');
  return res.data.likes ?? [];
};

export const unlockContact = async (userId: string): Promise<{ phone: string }> => {
  const res = await apiClient.post<{ contact: { phone: string } }>(`/profile/${userId}/unlock-contact`);
  return res.data.contact;
};
