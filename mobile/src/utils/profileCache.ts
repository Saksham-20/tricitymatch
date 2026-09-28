import { queryClient } from '../constants/queryClient';
import { queryKeys } from '../constants/queryKeys';

/**
 * getMyProfile is cached under two keys: `me` (read by OwnProfile, EditProfile and
 * Privacy) and `myProfile` (read by Home, Settings, ProfileDetail and the journey
 * steps). Refreshing only one leaves the other screens on the pre-write profile,
 * and an Edit Profile save then posts that stale form back over the newer answers.
 * Every write to the member's own profile refreshes both through here.
 */
export function refreshProfileCaches(): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.me });
  queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
}
