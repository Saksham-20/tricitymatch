import { apiClient } from './client';

/**
 * Member invite link (authed half — mints the caller's token on first use).
 * Mirror of the web `getMyInviteLink`; liquidity is the binding constraint,
 * so sharing has to be one tap from the dashboard.
 */
export const getMyInviteLink = async (): Promise<string> => {
  const invite = await getMyInvite();
  return invite.url;
};

/**
 * Full invite payload. `rewardUnlocks` is the contact-unlock reward BOTH sides
 * receive when the invite converts (backend utils/inviteReward.js). It is
 * env-tunable and can be 0 — surfaces must read it rather than hardcode a
 * number, or they keep promising a reward after it has been switched off.
 */
export const getMyInvite = async (): Promise<{ token: string; url: string; rewardUnlocks: number }> => {
  const res = await apiClient.get<{ invite: { token: string; url: string; rewardUnlocks?: number } }>(
    '/invite/my-link'
  );
  const { token, url, rewardUnlocks } = res.data.invite;
  return { token, url, rewardUnlocks: Number(rewardUnlocks) > 0 ? Number(rewardUnlocks) : 0 };
};
