import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSocket } from './SocketContext';
import { agora as agoraConfig } from '../config';
import * as callApi from '../api/calls';
import { joinChannel, leaveChannel, setMicEnabled, setCamEnabled } from '../utils/agoraEngine';

const CallContext = createContext();

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};

// status: idle | calling (outgoing, waiting for accept) | ringing (incoming) | active
export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const [status, setStatus] = useState('idle');
  const [peer, setPeer] = useState(null);          // { id, name, photo }
  const [type, setType] = useState('voice');        // voice | video
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);

  // Mutable call session details that don't need to trigger re-render.
  const session = useRef({ callId: null, channelName: null, token: null });
  const localVideoRef = useRef(null);
  const remoteUserRef = useRef(null);

  const reset = useCallback(() => {
    session.current = { callId: null, channelName: null, token: null };
    remoteUserRef.current = null;
    setStatus('idle');
    setPeer(null);
    setMuted(false);
    setCamOff(false);
    setRemoteJoined(false);
  }, []);

  const teardown = useCallback(async () => {
    await leaveChannel();
    reset();
  }, [reset]);

  const playRemote = useCallback((user, mediaType) => {
    if (mediaType === 'video') {
      remoteUserRef.current = user;
      setRemoteJoined(true);
      // Defer so the overlay container is mounted.
      setTimeout(() => {
        const el = document.getElementById('remote-video');
        if (el && user.videoTrack) user.videoTrack.play(el);
      }, 50);
    } else {
      setRemoteJoined(true);
    }
  }, []);

  const join = useCallback(async (channelName, token, callType) => {
    if (!agoraConfig.isConfigured) {
      toast.error('Calling is not configured on this site.');
      await teardown();
      return;
    }
    try {
      const { localVideoTrack } = await joinChannel({
        appId: agoraConfig.appId,
        channel: channelName,
        token,
        uid: null,
        video: callType === 'video',
        onRemoteTrack: playRemote,
        onRemoteLeft: () => setRemoteJoined(false),
      });
      setStatus('active');
      if (callType === 'video' && localVideoTrack) {
        setTimeout(() => {
          const el = document.getElementById('local-video');
          if (el) localVideoTrack.play(el);
        }, 50);
      }
    } catch (err) {
      toast.error('Could not access microphone/camera.');
      await teardown();
    }
  }, [playRemote, teardown]);

  // ── Caller: start an outgoing call ───────────────────────────────
  const startCall = useCallback(async (callee, callType = 'voice') => {
    if (status !== 'idle') return;
    setPeer(callee);
    setType(callType);
    setStatus('calling');
    try {
      const res = await callApi.initiateCall(callee.id, callType);
      session.current = { callId: res.callId, channelName: res.channelName, token: res.token };
      // Wait for call-accepted (socket) before joining the channel.
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not start call.');
      reset();
    }
  }, [status, reset]);

  // ── Callee: accept / decline ─────────────────────────────────────
  const acceptIncoming = useCallback(async () => {
    const { callId } = session.current;
    if (!callId) return;
    try {
      const res = await callApi.acceptCall(callId);
      session.current = { callId, channelName: res.channelName, token: res.token };
      await join(res.channelName, res.token, type);
    } catch (err) {
      toast.error('Could not join call.');
      await teardown();
    }
  }, [join, type, teardown]);

  const declineIncoming = useCallback(async () => {
    const { callId } = session.current;
    if (callId) { try { await callApi.declineCall(callId); } catch { /* ignore */ } }
    reset();
  }, [reset]);

  const hangUp = useCallback(async () => {
    const { callId } = session.current;
    if (callId) { try { await callApi.endCall(callId); } catch { /* ignore */ } }
    await teardown();
  }, [teardown]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    setMuted(next);
    await setMicEnabled(!next);
  }, [muted]);

  const toggleCam = useCallback(async () => {
    const next = !camOff;
    setCamOff(next);
    await setCamEnabled(!next);
  }, [camOff]);

  // ── Socket signaling ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (data) => {
      // Ignore a second incoming call while already busy — auto-decline it.
      if (status !== 'idle') {
        callApi.declineCall(data.callId).catch(() => {});
        return;
      }
      session.current = { callId: data.callId, channelName: data.channelName, token: null };
      setPeer({ id: data.callerId, name: data.callerName, photo: data.callerPhoto });
      setType(data.type || 'voice');
      setStatus('ringing');
    };

    const onAccepted = () => {
      // Caller side: callee accepted → join with the token from initiate.
      const { channelName, token } = session.current;
      if (channelName) join(channelName, token, type);
    };

    const onDeclined = () => {
      toast(`${peer?.name || 'They'} declined the call`);
      teardown();
    };

    const onEnded = () => {
      teardown();
    };

    socket.on('call-incoming', onIncoming);
    socket.on('call-accepted', onAccepted);
    socket.on('call-declined', onDeclined);
    socket.on('call-ended', onEnded);

    return () => {
      socket.off('call-incoming', onIncoming);
      socket.off('call-accepted', onAccepted);
      socket.off('call-declined', onDeclined);
      socket.off('call-ended', onEnded);
    };
  }, [socket, status, type, peer, join, teardown]);

  const value = {
    status, peer, type, muted, camOff, remoteJoined,
    callConfigured: agoraConfig.isConfigured,
    localVideoRef, remoteUserRef,
    startCall, acceptIncoming, declineIncoming, hangUp, toggleMute, toggleCam,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export default CallContext;
