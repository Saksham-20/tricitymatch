import { apiClient } from './client';
import type { Match, MatchAction, MatchActionResponse, ProfileSummary } from '../types';

export const performMatchAction = async (
  userId: string,
  action: MatchAction
): Promise<MatchActionResponse> => {
  const res = await apiClient.post<MatchActionResponse>(`/match/${userId}`, { action });
  return res.data;
};

export const getDailyFeed = async (): Promise<ProfileSummary[]> => {
  const res = await apiClient.get<ProfileSummary[]>('/matches/feed');
  return res.data;
};

export const getMutualMatches = async (): Promise<Match[]> => {
  const res = await apiClient.get<Match[]>('/match/matches');
  return res.data;
};

export const getShortlisted = async (): Promise<Match[]> => {
  const res = await apiClient.get<Match[]>('/match/shortlisted');
  return res.data;
};

export const getLikedMe = async (): Promise<Match[]> => {
  const res = await apiClient.get<Match[]>('/match/liked-me');
  return res.data;
};

export const getSentInterests = async (): Promise<Match[]> => {
  const res = await apiClient.get<Match[]>('/match/sent');
  return res.data;
};

export const unlockContact = async (userId: string): Promise<{ phone: string }> => {
  const res = await apiClient.post<{ phone: string }>(`/match/${userId}/unlock-contact`);
  return res.data;
};
