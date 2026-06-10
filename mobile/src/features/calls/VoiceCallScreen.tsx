import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { callColours } from './callTheme';
import { useAuthStore } from '../../stores/authStore';
import { useCallStore } from '../../stores/callStore';
import { useSocket } from '../../hooks/useSocket';
import { getAgoraToken, initiateCall, acceptCall, endCall } from '../../api/calls';
import type { MainStackParamList } from '../../navigation/types';
import type { AgoraTokenResponse } from '../../types';
import { CONFIG } from '../../constants/config';

// Dynamic require — no-op in Expo Go, real engine in EAS native build
let RtcEngine: any = null;
try {
  RtcEngine = require('react-native-agora').default;
} catch {
  // Not installed or Expo Go — use stub
}

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'VoiceCall'>;

type CallPhase = 'connecting' | 'ringing' | 'connected' | 'ended';

const RING_TIMEOUT_MS = 30_000;

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VoiceCallScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { callId: incomingCallId, channelName, calleeId } = route.params;

  const { user } = useAuthStore();
  const { activeCall, setActiveCall, clearActiveCall } = useCallStore();

  const [phase, setPhase] = useState<CallPhase>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [calleeName, setCalleeName] = useState('');
  const [calleePhoto, setCalleePhoto] = useState<string | null>(null);
  const [callDbId, setCallDbId] = useState<string | null>(incomingCallId ?? null);
  const [agoraToken, setAgoraToken] = useState<string | null>(null);

  const engineRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);

  const isIncoming = !!incomingCallId;

  // ─── Socket handlers ────────────────────────────────────────────────────────
  const handleCallAccepted = useCallback((data: { callId: string; channelName: string }) => {
    if (data.callId === callDbId) {
      setPhase('connected');
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    }
  }, [callDbId]);

  const handleCallDeclined = useCallback((data: { callId: string }) => {
    if (data.callId === callDbId) {
      endedRef.current = true;
      setPhase('ended');
    }
  }, [callDbId]);

  const handleCallEnded = useCallback((data: { callId: string }) => {
    if (data.callId === callDbId) {
      endedRef.current = true;
      setPhase('ended');
    }
  }, [callDbId]);

  useSocket({ onCallAccepted: handleCallAccepted, onCallDeclined: handleCallDeclined, onCallEnded: handleCallEnded });

  // ─── Init Agora engine ──────────────────────────────────────────────────────
  const initEngine = useCallback(async (token: string, channel: string) => {
    if (!RtcEngine || !CONFIG.AGORA_APP_ID) return;
    try {
      const engine = await RtcEngine.create(CONFIG.AGORA_APP_ID);
      engineRef.current = engine;
      await engine.disableVideo();
      await engine.enableAudio();
      await engine.joinChannel(token, channel, null, 0);
    } catch {
      // Native build only — silently ignore in Expo Go
    }
  }, []);

  const destroyEngine = useCallback(async () => {
    if (!engineRef.current) return;
    try {
      await engineRef.current.leaveChannel();
      await engineRef.current.destroy();
    } catch { /* ignore */ }
    engineRef.current = null;
  }, []);

  // ─── Outgoing call flow ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isIncoming) return;

    let cancelled = false;
    (async () => {
      try {
        // 1. Initiate call → get callId from backend + socket emits call-incoming to callee
        const session = await initiateCall(calleeId, 'voice');
        if (cancelled) return;
        setCallDbId(session.id);
        // 2. Fetch Agora token
        const tokenRes: AgoraTokenResponse = await getAgoraToken(channelName);
        if (cancelled) return;
        setAgoraToken(tokenRes.token);
        setPhase('ringing');
        await initEngine(tokenRes.token, channelName);
        // 3. 30-second timeout → missed
        ringTimeoutRef.current = setTimeout(() => {
          if (!endedRef.current) {
            endedRef.current = true;
            setPhase('ended');
          }
        }, RING_TIMEOUT_MS);
      } catch {
        if (!cancelled) setPhase('ended');
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Incoming call flow ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isIncoming) return;
    const invitation = useCallStore.getState().incomingCall;
    if (invitation) {
      setCalleeName(invitation.callerName);
      setCalleePhoto(invitation.callerPhoto);
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await acceptCall(incomingCallId!);
        if (cancelled) return;
        setAgoraToken(res.token);
        setPhase('connected');
        await initEngine(res.token, channelName);
      } catch {
        if (!cancelled) setPhase('ended');
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Call timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'connected') {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // ─── Auto-navigate away when ended ─────────────────────────────────────────
  useEffect(() => {
    if (phase === 'ended') {
      const t = setTimeout(() => {
        clearActiveCall();
        if (navigation.canGoBack()) navigation.goBack();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, navigation, clearActiveCall]);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      destroyEngine();
    };
  }, [destroyEngine]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleMute = useCallback(() => {
    if (engineRef.current) {
      const next = !isMuted;
      engineRef.current.muteLocalAudioStream(next).catch(() => {});
      setIsMuted(next);
    } else {
      setIsMuted((v) => !v);
    }
  }, [isMuted]);

  const handleSpeaker = useCallback(() => {
    if (engineRef.current) {
      const next = !isSpeaker;
      engineRef.current.setEnableSpeakerphone(next).catch(() => {});
      setIsSpeaker(next);
    } else {
      setIsSpeaker((v) => !v);
    }
  }, [isSpeaker]);

  const handleEndCall = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    setPhase('ended');
    if (callDbId) {
      try { await endCall(callDbId); } catch { /* ignore */ }
    }
    await destroyEngine();
  }, [callDbId, destroyEngine]);

  // ─── UI ─────────────────────────────────────────────────────────────────────
  const phaseLabel: Record<CallPhase, string> = {
    connecting: 'Connecting…',
    ringing:    'Ringing…',
    connected:  formatDuration(elapsed),
    ended:      'Call ended',
  };

  return (
    <SafeAreaView style={styles.root} testID="VoiceCallScreen">
      <StatusBar barStyle="light-content" backgroundColor={styles.root.backgroundColor} />

      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {calleePhoto ? (
          <Image source={{ uri: calleePhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={72} color={colours.textMuted} />
          </View>
        )}
      </View>

      {/* Name + status */}
      <Text style={styles.name} testID="CalleeName">{calleeName || 'Calling…'}</Text>
      <Text style={styles.status} testID="CallStatus">{phaseLabel[phase]}</Text>

      {phase === 'connecting' && (
        <ActivityIndicator color={colours.primary} style={{ marginTop: spacing.md }} />
      )}

      {/* Controls */}
      {phase !== 'ended' && (
        <View style={styles.controls}>
          <CallButton
            icon={isMuted ? 'mic-off' : 'mic'}
            label={isMuted ? 'Unmute' : 'Mute'}
            onPress={handleMute}
            active={isMuted}
            testID="MuteBtn"
          />
          <CallButton
            icon="call"
            label="End"
            onPress={handleEndCall}
            variant="end"
            testID="EndCallBtn"
          />
          <CallButton
            icon={isSpeaker ? 'volume-high' : 'volume-medium'}
            label="Speaker"
            onPress={handleSpeaker}
            active={isSpeaker}
            testID="SpeakerBtn"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── CallButton ──────────────────────────────────────────────────────────────
interface CallButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  variant?: 'default' | 'end';
  active?: boolean;
  testID?: string;
}

function CallButton({ icon, label, onPress, variant = 'default', active, testID }: CallButtonProps) {
  return (
    <View style={styles.btnWrap}>
      <TouchableOpacity
        style={[
          styles.btn,
          variant === 'end' && styles.btnEnd,
          active && styles.btnActive,
        ]}
        onPress={onPress}
        testID={testID}
        accessibilityLabel={label}
      >
        <Ionicons
          name={icon}
          size={28}
          color={variant === 'end' || active ? colours.background : colours.textPrimary}
        />
      </TouchableOpacity>
      <Text style={styles.btnLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: callColours.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  avatarWrap: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: colours.primary,
  },
  avatarPlaceholder: {
    backgroundColor: colours.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: '#ffffff',
  },
  status: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: callColours.textMuted,
    letterSpacing: 0.3,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing['3xl'],
    marginTop: spacing['3xl'],
    alignItems: 'center',
  },
  btnWrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  btn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEnd: {
    backgroundColor: colours.error,
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  btnActive: {
    backgroundColor: colours.primary,
  },
  btnLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: callColours.textMuted,
  },
});
