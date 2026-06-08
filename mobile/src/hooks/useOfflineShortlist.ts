import { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import FastImage from 'react-native-fast-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cache, CACHE_KEYS } from '../utils/cache';
import { getShortlisted } from '../api/matches';
import { queryKeys } from '../constants/queryKeys';
import type { Match } from '../types';

const SHORTLIST_CACHE_LIMIT = 200;
const STALE_MS = 30 * 60 * 1000; // 30 min

function readCachedShortlist(): Match[] {
  const index = cache.getString(CACHE_KEYS.SHORTLIST_INDEX);
  if (!index) return [];
  try {
    const ids: string[] = JSON.parse(index);
    return ids.flatMap((id) => {
      const raw = cache.getString(`${CACHE_KEYS.SHORTLIST_PREFIX}${id}`);
      if (!raw) return [];
      try { return [JSON.parse(raw) as Match]; } catch { return []; }
    });
  } catch {
    return [];
  }
}

function writeCachedShortlist(matches: Match[]): void {
  const limited = matches.slice(0, SHORTLIST_CACHE_LIMIT);
  const ids = limited.map((m) => m.id);
  cache.setString(CACHE_KEYS.SHORTLIST_INDEX, JSON.stringify(ids));
  for (const match of limited) {
    cache.setString(`${CACHE_KEYS.SHORTLIST_PREFIX}${match.id}`, JSON.stringify(match));
  }
  cache.setNumber(CACHE_KEYS.SHORTLIST_SYNC_TIME, Date.now());
}

function clearShortlistCache(): void {
  const index = cache.getString(CACHE_KEYS.SHORTLIST_INDEX);
  if (index) {
    try {
      const ids: string[] = JSON.parse(index);
      for (const id of ids) {
        cache.delete(`${CACHE_KEYS.SHORTLIST_PREFIX}${id}`);
      }
    } catch { /* ignore */ }
  }
  cache.delete(CACHE_KEYS.SHORTLIST_INDEX);
}

function prewarmImages(matches: Match[]): void {
  const urls = matches
    .flatMap((m) => [m.MatchedProfile?.profilePhoto, ...(m.MatchedProfile?.photos ?? [])])
    .filter((u): u is string => !!u)
    .slice(0, 50) // limit network budget
    .map((uri) => ({ uri }));

  if (urls.length > 0) {
    FastImage.preload(urls);
  }
}

export interface OfflineShortlistResult {
  shortlist: Match[];
  isOffline: boolean;
  isStale: boolean;
  lastSyncedLabel: string | null;
  refetch: () => void;
}

export function useOfflineShortlist(): OfflineShortlistResult {
  const queryClient = useQueryClient();
  const [isOffline, setIsOffline] = useState(false);
  const [cachedData, setCachedData] = useState<Match[]>([]);

  // Subscribe to network state
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected ?? true));
    });
    // Read initial state
    NetInfo.fetch().then((state) => {
      setIsOffline(!(state.isConnected ?? true));
    });
    return unsub;
  }, []);

  // Load cached data on mount (used when offline)
  useEffect(() => {
    const cached = readCachedShortlist();
    if (cached.length > 0) {
      setCachedData(cached);
    }
  }, []);

  const { data: liveData, refetch } = useQuery({
    queryKey: queryKeys.shortlisted,
    queryFn: getShortlisted,
    enabled: !isOffline,
    staleTime: STALE_MS,
  });

  // When live data arrives, cache it and prewarm images
  useEffect(() => {
    if (liveData && liveData.length > 0) {
      writeCachedShortlist(liveData);
      setCachedData(liveData);
      prewarmImages(liveData);
    }
  }, [liveData]);

  const shortlist = isOffline ? cachedData : (liveData ?? cachedData);

  const syncTime = cache.getNumber(CACHE_KEYS.SHORTLIST_SYNC_TIME);
  let lastSyncedLabel: string | null = null;
  if (syncTime) {
    const diffMin = Math.floor((Date.now() - syncTime) / 60000);
    if (diffMin < 1) lastSyncedLabel = 'Synced just now';
    else if (diffMin < 60) lastSyncedLabel = `Synced ${diffMin}m ago`;
    else {
      const diffHr = Math.floor(diffMin / 60);
      lastSyncedLabel = `Synced ${diffHr}h ago`;
    }
  }

  const isStale = !!syncTime && Date.now() - syncTime > STALE_MS;

  const handleRefetch = useCallback(() => {
    if (!isOffline) {
      queryClient.invalidateQueries({ queryKey: queryKeys.shortlisted });
      refetch();
    }
  }, [isOffline, queryClient, refetch]);

  return { shortlist, isOffline, isStale, lastSyncedLabel, refetch: handleRefetch };
}

export { clearShortlistCache };
