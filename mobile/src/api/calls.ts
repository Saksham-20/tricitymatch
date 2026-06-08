import { apiClient } from './client';
import type { AgoraTokenResponse, CallSession, CallType } from '../types';

export const getAgoraToken = async (channelName: string): Promise<AgoraTokenResponse> => {
  const res = await apiClient.get<AgoraTokenResponse>('/calls/agora-token', {
    params: { channel: channelName },
  });
  return res.data;
};

export const initiateCall = async (
  calleeId: string,
  type: CallType,
): Promise<CallSession> => {
  const res = await apiClient.post<CallSession>('/calls/initiate', { calleeId, type });
  return res.data;
};

export const acceptCall = async (callId: string): Promise<AgoraTokenResponse & { callId: string }> => {
  const res = await apiClient.put<AgoraTokenResponse & { callId: string }>(`/calls/${callId}/accept`);
  return res.data;
};

export const declineCall = async (callId: string): Promise<void> => {
  await apiClient.put(`/calls/${callId}/decline`);
};

export const endCall = async (callId: string): Promise<void> => {
  await apiClient.put(`/calls/${callId}/end`);
};

export const getCallHistory = async (): Promise<CallSession[]> => {
  const res = await apiClient.get<CallSession[]>('/calls/history');
  return res.data;
};
