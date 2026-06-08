import { apiClient } from './client';
import type { ProfileSummary, SearchFilters } from '../types';

interface SearchResponse {
  profiles: ProfileSummary[];
  total: number;
  nextCursor: string | null;
}

export const search = async (filters: SearchFilters): Promise<SearchResponse> => {
  const res = await apiClient.get<SearchResponse>('/search', { params: filters });
  return res.data;
};

export const getSavedSearches = async () => {
  const res = await apiClient.get('/search/saved');
  return res.data;
};

export const saveSearch = async (name: string, filters: SearchFilters) => {
  const res = await apiClient.post('/search/saved', { name, filters });
  return res.data;
};

export const deleteSavedSearch = async (id: string): Promise<void> => {
  await apiClient.delete(`/search/saved/${id}`);
};
