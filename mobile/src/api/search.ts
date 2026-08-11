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

/**
 * Look up one profile by its shareable code (`TCS-XXXXXXXX`).
 *
 * The server answers 404 both when no profile matches and when the 8-hex
 * prefix is ambiguous — it refuses to guess between two members rather than
 * open an arbitrary one. Either way the caller shows "no profile found".
 */
export const getProfileByCode = async (code: string): Promise<ProfileSummary & { isSelf?: boolean }> => {
  const res = await apiClient.get<{ profile: ProfileSummary & { isSelf?: boolean } }>(
    '/search/by-code',
    { params: { code } }
  );
  return res.data.profile;
};

/** Curated "you might like" set — the same source the website's suggestions use. */
export const getSuggestions = async (limit = 10): Promise<ProfileSummary[]> => {
  const res = await apiClient.get<{ suggestions: ProfileSummary[] }>('/search/suggestions', {
    params: { limit },
  });
  return res.data.suggestions ?? [];
};

// NOTE: saved-searches have no backend endpoint yet — the save UI is hidden in FilterPanel.
// See CLAUDE.md Known Issues. Re-add functions here when the server side ships.
