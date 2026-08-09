import api from './axios';

/**
 * Member invite links (Phase S).
 *
 * Two calls, two very different trust levels:
 *  - `resolveInvite` is PUBLIC and returns the inviter's FIRST NAME only. It is
 *    called from the signup page on every `?invite=` load, so it must never
 *    throw into the render path: an unknown / revoked / rate-limited token
 *    resolves to `null` and the page renders as if no invite were present
 *    (the "silently absent" state — a forged link never blocks a signup).
 *  - `getMyInviteLink` is AUTHED and mints the caller's token on first use.
 */

/** @returns {Promise<{firstName: string} | null>} null for any failure. */
export const resolveInvite = async (token) => {
  if (!token) return null;
  try {
    const { data } = await api.get(`/invite/${encodeURIComponent(token)}`);
    return data?.invite?.firstName ? data.invite : null;
  } catch {
    return null;
  }
};

/** @returns {Promise<{token: string, url: string}>} throws so callers can retry. */
export const getMyInviteLink = async () => {
  const { data } = await api.get('/invite/my-link');
  return data.invite;
};

export default { resolveInvite, getMyInviteLink };
