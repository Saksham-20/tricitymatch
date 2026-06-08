import { create } from 'zustand';
import type { CallSession, CallInvitation } from '../types';

interface CallState {
  activeCall: CallSession | null;
  incomingCall: CallInvitation | null;

  setActiveCall: (call: CallSession | null) => void;
  clearActiveCall: () => void;
  setIncomingCall: (call: CallInvitation | null) => void;
  clearIncomingCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  activeCall: null,
  incomingCall: null,

  setActiveCall: (activeCall) => set({ activeCall }),
  clearActiveCall: () => set({ activeCall: null }),
  setIncomingCall: (incomingCall) => set({ incomingCall }),
  clearIncomingCall: () => set({ incomingCall: null }),
}));
