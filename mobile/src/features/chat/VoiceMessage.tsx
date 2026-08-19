/**
 * Voice messages (D2, premium) — recorder button + playback bubble.
 * DS4 states: idle → recording (timer, hard stop at 60s) → review
 * (play / delete / send) → uploading / failed. expo-av is lazy-required
 * (no-op alert in Expo Go, same pattern as VoiceIntroRecorder).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';

const MAX_SEC = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAV = (): any => {
  try {
    return require('expo-av');
  } catch {
    return null;
  }
};

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// ─── Recorder strip (replaces the input bar while active) ────────────────────
interface RecorderProps {
  onSend: (uri: string, durationMs: number) => Promise<void>;
  onClose: () => void;
}

export function VoiceRecorderStrip({ onSend, onClose }: RecorderProps) {
  const { c } = useTheme();
  const vs = React.useMemo(() => makeVs(c), [c]);
  const [phase, setPhase] = useState<'recording' | 'review' | 'uploading' | 'failed'>('recording');
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordingRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const soundRef = useRef<any>(null);
  const uriRef = useRef<string | null>(null);
  const durationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const stopRecording = useCallback(async () => {
    clearTimer();
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      uriRef.current = recordingRef.current.getURI();
      recordingRef.current = null;
      setPhase('review');
    } catch {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const av = getAV();
      if (!av) {
        Alert.alert('Not available', 'Voice messages need a native build.');
        onClose();
        return;
      }
      const { Audio } = av;
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone needed', 'Enable microphone access in Settings to send voice messages.');
        onClose();
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      if (cancelled) { recording.stopAndUnloadAsync().catch(() => null); return; }
      recordingRef.current = recording;
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          durationRef.current = next * 1000;
          if (next >= MAX_SEC) stopRecording();
          return next;
        });
      }, 1000);
    })().catch(() => onClose());
    return () => {
      cancelled = true;
      clearTimer();
      soundRef.current?.unloadAsync().catch(() => null);
      recordingRef.current?.stopAndUnloadAsync().catch(() => null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = async () => {
    const av = getAV();
    if (!av || !uriRef.current) return;
    if (playing) {
      await soundRef.current?.pauseAsync().catch(() => null);
      setPlaying(false);
      return;
    }
    if (!soundRef.current) {
      const { sound } = await av.Audio.Sound.createAsync({ uri: uriRef.current });
      soundRef.current = sound;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sound.setOnPlaybackStatusUpdate((st: any) => { if (st.didJustFinish) setPlaying(false); });
    }
    await soundRef.current.replayAsync();
    setPlaying(true);
  };

  const send = async () => {
    if (!uriRef.current) return;
    setPhase('uploading');
    try {
      await onSend(uriRef.current, durationRef.current);
      onClose();
    } catch {
      setPhase('failed');
    }
  };

  const warn = elapsed >= MAX_SEC - 5;

  return (
    <View style={vs.strip} testID="VoiceRecorderStrip">
      {phase === 'recording' && (
        <>
          <View style={vs.redDot} />
          <Text style={[vs.timer, warn && { color: c.error }]}>
            {fmt(elapsed)}{warn ? ' · stopping soon' : ''}
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onClose} style={vs.iconBtn} accessibilityLabel="Cancel recording">
            <Ionicons name="trash-outline" size={22} color={c.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={stopRecording} style={vs.stopBtn} accessibilityLabel="Stop recording">
            <Ionicons name="stop" size={20} color="#fff" />
          </TouchableOpacity>
        </>
      )}
      {phase === 'review' && (
        <>
          <TouchableOpacity onPress={togglePlay} style={vs.playBtn} accessibilityLabel={playing ? 'Pause preview' : 'Play preview'}>
            <Ionicons name={playing ? 'pause' : 'play'} size={18} color={c.primary} />
          </TouchableOpacity>
          <Text style={vs.timer}>{fmt(Math.round(durationRef.current / 1000))}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onClose} style={vs.iconBtn} accessibilityLabel="Discard voice message">
            <Ionicons name="trash-outline" size={22} color={c.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={send} style={vs.sendBtn} accessibilityLabel="Send voice message">
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </>
      )}
      {phase === 'uploading' && (
        <>
          <ActivityIndicator size="small" color={c.primary} />
          <Text style={[vs.timer, { marginLeft: spacing.sm }]}>Sending…</Text>
        </>
      )}
      {phase === 'failed' && (
        <>
          <Text style={[vs.timer, { color: c.error }]}>Upload failed</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={send} style={vs.iconBtn} accessibilityLabel="Retry send">
            <Ionicons name="refresh" size={22} color={c.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={vs.iconBtn} accessibilityLabel="Discard">
            <Ionicons name="close" size={22} color={c.textMuted} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─── Playback bubble ─────────────────────────────────────────────────────────
export function VoiceMessageBubble({ uri, durationMs, own }: { uri: string | null; durationMs: number | null; own: boolean }) {
  const { c } = useTheme();
  const vs = React.useMemo(() => makeVs(c), [c]);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const soundRef = useRef<any>(null);

  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => null); }, []);

  const toggle = async () => {
    const av = getAV();
    if (!av || !uri) { setState('failed'); return; }
    try {
      if (state === 'playing') {
        await soundRef.current?.pauseAsync();
        setState('idle');
        return;
      }
      setState('loading');
      if (!soundRef.current) {
        const { sound } = await av.Audio.Sound.createAsync({ uri });
        soundRef.current = sound;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sound.setOnPlaybackStatusUpdate((st: any) => {
          if (st.isLoaded && st.durationMillis) setProgress(st.positionMillis / st.durationMillis);
          if (st.didJustFinish) { setState('idle'); setProgress(0); }
        });
      }
      await soundRef.current.playAsync();
      setState('playing');
    } catch {
      setState('failed');
    }
  };

  const fg = own ? '#fff' : c.textPrimary;
  if (state === 'failed') {
    return (
      <TouchableOpacity onPress={() => { soundRef.current = null; setState('idle'); toggle(); }} style={vs.bubbleRowInner}>
        <Ionicons name="alert-circle-outline" size={16} color={fg} />
        <Text style={[vs.bubbleFail, { color: fg }]}>Couldn&apos;t play — tap to retry</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={vs.bubbleRowInner} accessibilityLabel="Voice message">
      <TouchableOpacity onPress={toggle} style={[vs.playBtnSmall, own && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
        {state === 'loading' ? (
          <ActivityIndicator size="small" color={own ? '#fff' : c.primary} />
        ) : (
          <Ionicons name={state === 'playing' ? 'pause' : 'play'} size={16} color={own ? '#fff' : c.primary} />
        )}
      </TouchableOpacity>
      <View style={[vs.track, own && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
        <View style={[vs.fill, own ? { backgroundColor: '#fff' } : { backgroundColor: c.primary }, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={[vs.duration, { color: own ? 'rgba(255,255,255,0.8)' : c.textMuted }]}>
        {fmt(Math.round((durationMs || 0) / 1000))}
      </Text>
    </View>
  );
}

const makeVs = (c: ThemeColours) => StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.error, marginRight: spacing.sm },
  timer: { fontSize: typography.fontSize.sm, color: c.textPrimary, fontVariant: ['tabular-nums'] },
  iconBtn: { padding: spacing.sm },
  stopBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: c.error,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xs,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xs,
  },
  playBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8E8EC',
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  playBtnSmall: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#F8E8EC',
    alignItems: 'center', justifyContent: 'center',
  },
  bubbleRowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 170 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E8E8E8', overflow: 'hidden' },
  fill: { height: '100%' },
  duration: { fontSize: typography.fontSize.xs, fontVariant: ['tabular-nums'] },
  bubbleFail: { fontSize: typography.fontSize.sm, textDecorationLine: 'underline' },
});
