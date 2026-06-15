// Public shareable profile code, derived from a user's UUID.
// Must stay in sync with backend/utils/profileCode.js.
// Format: TCS-XXXXXXXX (first UUID segment, uppercased).
export const toProfileCode = (userId) => {
  if (!userId || typeof userId !== 'string') return null;
  const seg = userId.split('-')[0];
  if (!/^[0-9a-f]{8}$/i.test(seg)) return null;
  return `TCS-${seg.toUpperCase()}`;
};
