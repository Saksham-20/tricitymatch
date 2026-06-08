export type CallType = 'voice' | 'video';
export type CallStatus = 'initiated' | 'connected' | 'ended' | 'missed' | 'declined';

export interface CallSession {
  id: string;
  callerId: string;
  calleeId: string;
  callType: CallType;
  agoraChannel: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSecs: number | null;
  status: CallStatus;
  createdAt: string;
}

export interface CallInvitation {
  callId: string;
  callerId: string;
  callerName: string;
  callerPhoto: string | null;
  callType: CallType;
  agoraChannel: string;
}

export interface AgoraTokenResponse {
  token: string;
  channelName: string;
  uid: number;
}
