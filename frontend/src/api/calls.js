import api from './axios';

// Start an outgoing call. Returns { callId, channelName, token, uid, expiresAt }.
export const initiateCall = async (calleeId, type = 'voice') => {
  const res = await api.post('/calls/initiate', { calleeId, type });
  return res.data;
};

// Accept an incoming call. Returns { callId, channelName, token, uid }.
export const acceptCall = async (callId) => {
  const res = await api.put(`/calls/${callId}/accept`);
  return res.data;
};

export const declineCall = async (callId) => {
  const res = await api.put(`/calls/${callId}/decline`);
  return res.data;
};

export const endCall = async (callId, status = 'ended') => {
  const res = await api.put(`/calls/${callId}/end`, { status });
  return res.data;
};
