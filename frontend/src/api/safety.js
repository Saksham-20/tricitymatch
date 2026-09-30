import api from './axios';

// Report a member. `reason` must be one of REPORT_REASONS (components/safety).
export const reportMember = async (userId, reason, description) => {
  const body = { reason };
  if (description && description.trim()) body.description = description.trim();
  const res = await api.post(`/report/${userId}`, body);
  return res.data;
};

// Block a member. Blocks are two-way: neither side can message, call or find
// the other, and any existing match is ended.
export const blockMember = async (userId) => {
  const res = await api.post(`/block/${userId}`);
  return res.data;
};

export const unblockMember = async (userId) => {
  const res = await api.delete(`/block/${userId}`);
  return res.data;
};

export const getBlockedMembers = async () => {
  const res = await api.get('/block');
  return res.data.blocks || [];
};
