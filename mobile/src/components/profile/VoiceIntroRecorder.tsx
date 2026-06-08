import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colours, spacing, typography, borderRadius } from '@shared/constants/theme';
import { deleteVoiceIntro, uploadVoiceIntro } from '../../api/profile';

const MAX_DURATION_MS = 30_000;

type RecordingState = 'idle' | 'recording' | 'recorded' | 'playing' | 'uploading';

interface Props {
  existingUrl: string | null;
  onSaved: (url: string | null) => void;
  isPremiumViewer?: boolean; // for playback gate in profile view
  readOnly?: boolean;       // profile detail screen — play only
}

export default function VoiceIntroRecorder({
  existingUrl,
  onSaved,
  isPremiumViewer = true,
  readOnly = false,
}: Props) {
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const recordingRef = useRef<any>(null);
  const soundRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lazy-load expo-av — no-op in Expo Go without native build, handles gracefully
  const getAV = () => {
    try {
      return require('expo-av');
    } catch {
      return null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimer();
      soundRef.current?.unloadAsync().catch(() => null);
      recordingRef.current?.stopAndUnloadAsync().catch(() => null);
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = useCallback(async () => {
    const av = getAV();
    if (!av) {
      Alert.alert('Not available', 'Audio recording requires a native build.');
      return;
    }
    const { Audio } = av;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Microphone access is needed to record.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setElapsed(0);
      setState('recording');

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= 30) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      Alert.alert('Error', 'Could not start recording.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    clearTimer();
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setLocalUri(uri);
      setState('recorded');
    } catch {
      setState('idle');
    }
  }, []);

  const playLocal = useCallback(async (uri: string) => {
    const av = getAV();
    if (!av) return;
    const { Audio, Sound } = av;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      soundRef.current?.unloadAsync().catch(() => null);
      const { sound, status } = await Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (s: any) => {
          if (s.isLoaded) {
            setPlaybackMs(s.positionMillis ?? 0);
            setDurationMs(s.durationMillis ?? 0);
            if (s.didJustFinish) setState(localUri ? 'recorded' : 'idle');
          }
        },
      );
      soundRef.current = sound;
      setState('playing');
    } catch {
      Alert.alert('Error', 'Could not play audio.');
    }
  }, [localUri]);

  const playExisting = useCallback(() => {
    if (!isPremiumViewer) {
      Alert.alert('Premium feature', 'Upgrade to Premium+ to listen to voice intros.');
      return;
    }
    if (existingUrl) playLocal(existingUrl);
  }, [existingUrl, isPremiumViewer, playLocal]);

  const stopPlayback = useCallback(async () => {
    await soundRef.current?.stopAsync();
    setState(localUri ? 'recorded' : 'idle');
  }, [localUri]);

  const upload = useCallback(async () => {
    if (!localUri) return;
    setState('uploading');
    try {
      const { voiceIntroUrl } = await uploadVoiceIntro(localUri);
      setLocalUri(null);
      onSaved(voiceIntroUrl);
      setState('idle');
      Alert.alert('Saved', 'Voice intro uploaded successfully.');
    } catch {
      setState('recorded');
      Alert.alert('Upload failed', 'Please check your connection and try again.');
    }
  }, [localUri, onSaved]);

  const remove = useCallback(async () => {
    Alert.alert('Delete voice intro', 'Remove your voice intro?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVoiceIntro();
            onSaved(null);
            setLocalUri(null);
            setState('idle');
          } catch {
            Alert.alert('Error', 'Could not delete voice intro.');
          }
        },
      },
    ]);
  }, [onSaved]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Read-only mode — just a play button for profile detail screen
  if (readOnly) {
    if (!existingUrl) return null;
    return (
      <View style={s.readOnlyRow} testID="VoiceIntroPlayer">
        <TouchableOpacity
          style={s.iconBtn}
          onPress={state === 'playing' ? stopPlayback : playExisting}
          accessibilityLabel={state === 'playing' ? 'Stop voice intro' : 'Play voice intro'}
        >
          <Text style={s.btnIcon}>{state === 'playing' ? '⏹' : '▶'}</Text>
        </TouchableOpacity>
        <View style={s.progressBarWrap}>
          <View
            style={[
              s.progressBar,
              { width: durationMs > 0 ? `${(playbackMs / durationMs) * 100}%` : '0%' },
            ]}
          />
        </View>
        {!isPremiumViewer && (
          <Text style={s.gateHint}>Premium+ to listen</Text>
        )}
      </View>
    );
  }

  // Owner / edit mode
  return (
    <View style={s.container} testID="VoiceIntroRecorder">
      <Text style={s.title}>Voice Intro</Text>
      <Text style={s.subtitle}>Record up to 30 seconds — plays on your profile for Premium+ viewers</Text>

      {/* Existing uploaded intro */}
      {existingUrl && state === 'idle' && !localUri && (
        <View style={s.existingRow}>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => playLocal(existingUrl)}
            accessibilityLabel="Play existing voice intro"
          >
            <Text style={s.btnIcon}>▶</Text>
          </TouchableOpacity>
          <Text style={s.existingLabel}>Voice intro saved</Text>
          <TouchableOpacity style={s.deleteBtn} onPress={remove} accessibilityLabel="Delete voice intro">
            <Text style={s.deleteTxt}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recording controls */}
      {state !== 'uploading' && (
        <View style={s.controls}>
          {state === 'idle' && (
            <TouchableOpacity style={s.recordBtn} onPress={startRecording} accessibilityLabel="Start recording">
              <Text style={s.recordDot}>⏺</Text>
              <Text style={s.recordTxt}>{existingUrl ? 'Re-record' : 'Record'}</Text>
            </TouchableOpacity>
          )}

          {state === 'recording' && (
            <View style={s.recordingRow}>
              <View style={s.recIndicator} />
              <Text style={s.elapsedTxt}>{formatTime(elapsed)} / 0:30</Text>
              <TouchableOpacity style={s.stopBtn} onPress={stopRecording} accessibilityLabel="Stop recording">
                <Text style={s.stopTxt}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}

          {(state === 'recorded' || state === 'playing') && localUri && (
            <View style={s.previewRow}>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={state === 'playing' ? stopPlayback : () => playLocal(localUri)}
                accessibilityLabel={state === 'playing' ? 'Stop preview' : 'Preview recording'}
              >
                <Text style={s.btnIcon}>{state === 'playing' ? '⏹' : '▶'}</Text>
              </TouchableOpacity>
              <Text style={s.previewLabel}>Preview ({formatTime(elapsed)}s)</Text>
              <TouchableOpacity
                style={s.discardBtn}
                onPress={() => { setLocalUri(null); setState('idle'); }}
                accessibilityLabel="Discard recording"
              >
                <Text style={s.discardTxt}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={upload} accessibilityLabel="Save voice intro">
                <Text style={s.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {state === 'uploading' && (
        <View style={s.uploadingRow}>
          <ActivityIndicator color={colours.primary} />
          <Text style={s.uploadingTxt}>Uploading…</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    marginBottom: spacing.sm,
  },
  existingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  existingLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    marginLeft: spacing.xs,
  },
  controls: {
    marginTop: spacing.xs,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  recordDot: { fontSize: 14, color: '#fff' },
  recordTxt: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: '#fff',
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colours.error,
  },
  elapsedTxt: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colours.textPrimary,
    fontFamily: typography.fontFamily.semiBold,
  },
  stopBtn: {
    backgroundColor: colours.error,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  stopTxt: {
    fontSize: typography.fontSize.sm,
    color: '#fff',
    fontFamily: typography.fontFamily.semiBold,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  previewLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
  },
  discardBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  discardTxt: {
    fontSize: typography.fontSize.sm,
    color: colours.error,
  },
  saveBtn: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  saveTxt: {
    fontSize: typography.fontSize.sm,
    color: '#fff',
    fontFamily: typography.fontFamily.semiBold,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  uploadingTxt: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
  },
  deleteBtn: {
    paddingHorizontal: spacing.sm,
  },
  deleteTxt: {
    fontSize: typography.fontSize.sm,
    color: colours.error,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colours.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: { fontSize: 14, color: '#fff' },
  // Read-only player
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  progressBarWrap: {
    flex: 1,
    height: 4,
    backgroundColor: colours.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: 4,
    backgroundColor: colours.primary,
    borderRadius: 2,
  },
  gateHint: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
  },
});
