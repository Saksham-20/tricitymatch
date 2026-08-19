import { apiClient } from './client';

export interface CommunityStats {
  newThisWeek: number;
  totalMembers: number;
}

/** GET /stats/community — cached social-proof counters for the dashboard. */
export const getCommunityStats = async (): Promise<CommunityStats> => {
  const res = await apiClient.get<{ stats: CommunityStats }>('/stats/community');
  return res.data.stats;
};
