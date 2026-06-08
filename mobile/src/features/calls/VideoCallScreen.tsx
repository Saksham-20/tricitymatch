import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, StatusBar, PanResponder, Animated, Dimensions,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { useCallStore } from '../../stores/callStore';
import { useSocket } from '../../hooks/useSocket';
import { getAgoraToken, initiateCall, acceptCall, endCall } from '../../api/calls';
import type { MainStackParamList } from '../../navigation/types';
import type { AgoraTokenResponse } from '../../types';
import { CONFIG } from '../../constants/config';

// Dynamic require — no-op in Expo Go, real Agora engine in EAS native build
let RtcEngine: any = null;
let RtcLocalView: any = null;
let RtcRemoteView: any = null;
try {
  const agora = require('react-native-agora');
  RtcEngine = agora.default;
  RtcLocalView = agora.RtcLocalView;
  RtcRemoteView = agora.RtcRemoteView;
} catch {
  // Expo Go — stubs
}

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'VideoCall'>;

type CallPhase = 'connecting' | 'ringing' | 'connected' | 'ended';

const RING_TIMEOUT_MS = 30_000;
const CONTROLS_HIDE_DELAY = 3000;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PIP_W = 100;
const PIP_H = 140;
const PIP_MARGIN = 16;

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VideoCallScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { callId: incomingCallId, channelName, calleeId } = route.params;

  const { clearActiveCall } = useCallStore();

  const [phase, setPhase] = useState<CallPhase>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [calleeName, setCalleeName] = useState('');
  const [calleePhoto, setCalleePhoto] = useState<string | null>(null);
  const [callDbId, setCallDbId] = useState<string | null>(incomingCallId ?? null);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);

  const engineRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const isIncoming = !!incomingCallId;

  // ─── Draggable PiP ──────────────────────────────────────────────────────────
  const pipPos = useRef(new Animated.ValueXY({
    x: SCREEN_W - PIP_W - PIP_MARGIN,
    y: PIP_MARGIN + 80,
  })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        const x = Math.max(0, Math.min(SCREEN_W - PIP_W, gs.moveX - PIP_W / 2));
        const y = Math.max(0, Math.min(SCREEN_H - PIP_H, gs.moveY - PIP_H / 2));
        pipPos.setValue({ x, y });
      },
    })
  ).current;

  // ─── Auto-hide controls ──────────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    setShowControls(true);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_DELAY);
  }, []);

  // ─── Socket handlers ────────────────────────────────────────────────────────
  const handleCallAccepted = useCallback((data: { callId: string; channelName: string }) => {
    if (data.callId === callDbId) {
      setPhase('connected');
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      resetControlsTimer();
    }
  }, [callDbId, resetControlsTimer]);

  const handleCallDeclined = useCallback((data: { callId: string }) => {
    if (data.callId === callDbId) { endedRef.current = true; setPhase('ended'); }
  }, [callDbId]);

  const handleCallEnded = useCallback((data: { callId: string }) => {
    if (data.callId === callDbId) { endedRef.current = true; setPhase('ended'); }
  }, [callDbId]);

  useSocket({ onCallAccepted: handleCallAccepted, onCallDeclined: handleCallDeclined, onCallEnded: handleCallEnded });

  // ─── Init Agora engine ──────────────────────────────────────────────────────
  const initEngine = useCallback(async (token: string, channel: string) => {
    if (!RtcEngine || !CONFIG.AGORA_APP_ID) return;
    try {
      const engine = await RtcEngine.create(CONFIG.AGORA_APP_ID);
      engineRef.current = engine;
      await engine.enableVideo();
      await engine.enableAudio();

      engine.addListener('UserJoined', (uid: number) => setRemoteUid(uid));
      engine.addListener('UserOffline', () => setRemoteUid(null));

      await engine.joinChannel(token, channel, null, 0);
    } catch { /* Expo Go no-op */ }
  }, []);

  const destroyEngine = useCallback(async () => {
    if (!engineRef.current) return;
    try {
      await engineRef.current.leaveChannel();
      await engineRef.current.destroy();
    } catch { /* ignore */ }
    engineRef.current = null;
  }, []);

  // ─── Outgoing call ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isIncoming) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await initiateCall(calleeId, 'video');
        if (cancelled) return;
        setCallDbId(session.id);
        const tokenRes: AgoraTokenResponse = await getAgoraToken(channelName);
        if (cancelled) return;
        setPhase('ringing');
        await initEngine(tokenRes.token, channelName);
        ringTimeoutRef.current = setTimeout(() => {
          if (!endedRef.current) { endedRef.current = true; setPhase('ended'); }
        }, RING_TIMEOUT_MS);
      } catch {
        if (!cancelled) setPhase('ended');
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Incoming call ───────────────────────────────────────────────────────────
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
        setPhase('connected');
        await initEngine(res.token, channelName);
        resetControlsTimer();
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
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // ─── Auto-navigate when ended ────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'ended') {
      const t = setTimeout(() => {
        clearActiveCall();
        if (navigation.canGoBack()) navigation.goBack();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, navigation, clearActiveCall]);

  // ─── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
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
    resetControlsTimer();
  }, [isMuted, resetControlsTimer]);

  const handleCameraToggle = useCallback(() => {
    if (engineRef.current) {
      const next = !isCameraOn;
      engineRef.current.muteLocalVideoStream(!next).catch(() => {});
      setIsCameraOn(next);
    } else {
      setIsCameraOn((v) => !v);
    }
    resetControlsTimer();
  }, [isCameraOn, resetControlsTimer]);

  const handleFlip = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.switchCamera().catch(() => {});
      setIsFrontCamera((v) => !v);
    } else {
      setIsFrontCamera((v) => !v);
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

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
  return (
    <View style={styles.root} testID="VideoCallScreen">
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Remote video / placeholder */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={resetControlsTimer}
        testID="TapArea"
      >
        {remoteUid && RtcRemoteView ? (
          <RtcRemoteView.SurfaceView
            uid={remoteUid}
            style={StyleSheet.absoluteFill}
            channelId={channelName}
            renderMode={1}
          />
        ) : (
          <View style={styles.remotePlaceholder}>
            {calleePhoto ? (
              <Image source={{ uri: calleePhoto }} style={styles.remoteAvatar} />
            ) : (
              <View style={[styles.remoteAvatar, styles.remoteAvatarFallback]}>
                <Ionicons name="person" size={80} color={colours.textMuted} />
              </View>
            )}
            <Text style={styles.remoteName}>{calleeName || 'Connecting…'}</Text>
            {phase === 'ringing' && <Text style={styles.remoteStatus}>Ringing…</Text>}
            {phase === 'connecting' && <ActivityIndicator color={colours.primary} style={{ marginTop: spacing.md }} />}
          </View>
        )}
      </TouchableOpacity>

      {/* PiP local camera */}
      {isCameraOn && (
        <Animated.View
          style={[styles.pip, { transform: pipPos.getTranslateTransform() }]}
          {...panResponder.panHandlers}
          testID="LocalPiP"
        >
          {RtcLocalView ? (
            <RtcLocalView.SurfaceView
              style={{ flex: 1 }}
              channelId={channelName}
              renderMode={1}
            />
          ) : (
            <View style={styles.pipFallback}>
              <Ionicons name="videocam" size={20} color={colours.background} />
            </View>
          )}
        </Animated.View>
      )}

      {/* Overlay controls */}
      {showControls && phase !== 'ended' && (
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          {/* Top bar */}
          <View style={styles.topBar}>
            <View>
              <Text style={styles.topName}>{calleeName || 'Video call'}</Text>
              {phase === 'connected' && (
                <Text style={styles.topTimer}>{formatDuration(elapsed)}</Text>
              )}
            </View>
          </View>

          {/* Bottom controls */}
          <View style={styles.controls}>
            <VideoBtn icon={isMuted ? 'mic-off' : 'mic'} label={isMuted ? 'Unmute' : 'Mute'}
              onPress={handleMute} active={isMuted} testID="MuteBtn" />
            <VideoBtn icon={isCameraOn ? 'videocam' : 'videocam-off'} label={isCameraOn ? 'Camera' : 'Camera off'}
              onPress={handleCameraToggle} active={!isCameraOn} testID="CameraBtn" />
            <VideoBtn icon="call" label="End" onPress={handleEndCall} variant="end" testID="EndCallBtn" />
            <VideoBtn icon="camera-reverse" label="Flip" onPress={handleFlip} testID="FlipBtn" />
          </View>
        </SafeAreaView>
      )}

      {/* Ended overlay */}
      {phase === 'ended' && (
        <View style={styles.endedOverlay}>
          <Text style={styles.endedText}>Call ended</Text>
        </View>
      )}
    </View>
  );
}

// ─── VideoBtn ────────────────────────────────────────────────────────────────
interface VideoBtnProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  variant?: 'default' | 'end';
  active?: boolean;
  testID?: string;
}

function VideoBtn({ icon, label, onPress, variant = 'default', active, testID }: VideoBtnProps) {
  return (
    <View style={styles.btnWrap}>
      <TouchableOpacity
        style={[styles.btn, variant === 'end' && styles.btnEnd, active && styles.btnActive]}
        onPress={onPress}
        testID={testID}
        accessibilityLabel={label}
      >
        <Ionicons
          name={icon}
          size={24}
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
    backgroundColor: '#000',
  },
  remotePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    gap: spacing.md,
  },
  remoteAvatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: colours.primary,
  },
  remoteAvatarFallback: {
    backgroundColor: colours.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteName: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: '#fff',
  },
  remoteStatus: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#a0aec0',
  },
  pip: {
    position: 'absolute',
    width: PIP_W,
    height: PIP_H,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colours.primary,
  },
  pipFallback: {
    flex: 1,
    backgroundColor: '#2d3748',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...(StyleSheet.absoluteFill as ViewStyle),
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingBottom: spacing.md,
  },
  topName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    color: '#fff',
  },
  topTimer: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#a0aec0',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  btnWrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  btn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEnd: {
    backgroundColor: colours.error,
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  btnActive: {
    backgroundColor: colours.primary,
  },
  btnLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: '#a0aec0',
  },
  endedOverlay: {
    ...(StyleSheet.absoluteFill as ViewStyle),
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endedText: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.semiBold,
    color: '#fff',
  },
});
