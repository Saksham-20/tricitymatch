import { apiClient } from './client';
import type { ProfileSummary, SearchFilters } from '../types';

interface SearchResponse {
  profiles: ProfileSummary[];
  total: number;
  nextCursor: string | null;
}

// SearchScreen drives infinite scroll with an opaque `cursor`; the backend paginates by
// `page` and returns { profiles, pagination:{page,limit,total,pages} }. Translate between them.
export const search = async (filters: SearchFilters & { cursor?: string }): Promise<SearchResponse> => {
  const { cursor, ...rest } = filters;
  const page = cursor ? Number(cursor) : 1;
  const res = await apiClient.get<{
    profiles: ProfileSummary[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>('/search', { params: { ...rest, page } });
  const { page: cur, pages, total } = res.data.pagination ?? { page: 1, pages: 1, total: 0 };
  return {
    profiles: res.data.profiles ?? [],
    total,
    nextCursor: cur < pages ? String(cur + 1) : null,
  };
};

// NOTE: saved-searches have no backend endpoint yet — the save UI is hidden in FilterPanel.
// See CLAUDE.md Known Issues. Re-add functions here when the server side ships.
