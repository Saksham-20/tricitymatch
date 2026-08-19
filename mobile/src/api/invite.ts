import { apiClient } from './client';

/**
 * Member invite link (authed half — mints the caller's token on first use).
 * Mirror of the web `getMyInviteLink`; liquidity is the binding constraint,
 * so sharing has to be one tap from the dashboard.
 */
export const getMyInviteLink = async (): Promise<string> => {
  const res = await apiClient.get<{ invite: { token: string; url: string } }>('/invite/my-link');
  return res.data.invite.url;
};
