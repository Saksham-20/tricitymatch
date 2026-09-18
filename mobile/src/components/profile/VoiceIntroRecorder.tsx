import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
} from 'react-native';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { deleteVoiceIntro, uploadVoiceIntro } from '../../api/profile';
import Text from '../ui/Text';
import { PressableScale } from '../motion';

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
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
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
        <PressableScale
          style={s.iconBtn}
          onPress={state === 'playing' ? stopPlayback : playExisting}
          accessibilityRole="button"
          accessibilityLabel={state === 'playing' ? 'Stop voice intro' : 'Play voice intro'}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="footnote" style={s.btnIcon}>{state === 'playing' ? '⏹' : '▶'}</Text>
        </PressableScale>
        <View style={s.progressBarWrap}>
          <View
            style={[
              s.progressBar,
              { width: durationMs > 0 ? `${(playbackMs / durationMs) * 100}%` : '0%' },
            ]}
          />
        </View>
        {!isPremiumViewer && (
          <Text variant="caption" color="textMuted" style={s.gateHint}>Premium+ to listen</Text>
        )}
      </View>
    );
  }

  // Owner / edit mode
  return (
    <View style={s.container} testID="VoiceIntroRecorder">
      <Text variant="headline" color="textPrimary" style={s.title}>Voice Intro</Text>
      <Text variant="subhead" color="textSecondary" style={s.subtitle}>Record up to 30 seconds — plays on your profile for Premium+ viewers</Text>

      {/* Existing uploaded intro */}
      {existingUrl && state === 'idle' && !localUri && (
        <View style={s.existingRow}>
          <PressableScale
            style={s.iconBtn}
            onPress={() => playLocal(existingUrl)}
            accessibilityRole="button"
            accessibilityLabel="Play existing voice intro"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="footnote" style={s.btnIcon}>▶</Text>
          </PressableScale>
          <Text variant="subhead" color="textSecondary" style={s.existingLabel}>Voice intro saved</Text>
          <PressableScale
            style={s.deleteBtn}
            onPress={remove}
            accessibilityRole="button"
            accessibilityLabel="Delete voice intro"
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="subhead" color="error" style={s.deleteTxt}>Remove</Text>
          </PressableScale>
        </View>
      )}

      {/* Recording controls */}
      {state !== 'uploading' && (
        <View style={s.controls}>
          {state === 'idle' && (
            <PressableScale
              style={s.recordBtn}
              onPress={startRecording}
              accessibilityRole="button"
              accessibilityLabel="Start recording"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="footnote" style={s.recordDot}>⏺</Text>
              <Text variant="subhead" style={s.recordTxt}>{existingUrl ? 'Re-record' : 'Record'}</Text>
            </PressableScale>
          )}

          {state === 'recording' && (
            <View style={s.recordingRow}>
              <View style={s.recIndicator} />
              <Text variant="subhead" color="textPrimary" style={s.elapsedTxt}>{formatTime(elapsed)} / 0:30</Text>
              <PressableScale
                style={s.stopBtn}
                onPress={stopRecording}
                accessibilityRole="button"
                accessibilityLabel="Stop recording"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text variant="subhead" style={s.stopTxt}>Stop</Text>
              </PressableScale>
            </View>
          )}

          {(state === 'recorded' || state === 'playing') && localUri && (
            <View style={s.previewRow}>
              <PressableScale
                style={s.iconBtn}
                onPress={state === 'playing' ? stopPlayback : () => playLocal(localUri)}
                accessibilityRole="button"
                accessibilityLabel={state === 'playing' ? 'Stop preview' : 'Preview recording'}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text variant="footnote" style={s.btnIcon}>{state === 'playing' ? '⏹' : '▶'}</Text>
              </PressableScale>
              <Text variant="subhead" color="textSecondary" style={s.previewLabel}>Preview ({formatTime(elapsed)}s)</Text>
              <PressableScale
                style={s.discardBtn}
                onPress={() => { setLocalUri(null); setState('idle'); }}
                accessibilityRole="button"
                accessibilityLabel="Discard recording"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text variant="subhead" color="error" style={s.discardTxt}>Discard</Text>
              </PressableScale>
              <PressableScale
                style={s.saveBtn}
                onPress={upload}
                accessibilityRole="button"
                accessibilityLabel="Save voice intro"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text variant="subhead" style={s.saveTxt}>Save</Text>
              </PressableScale>
            </View>
          )}
        </View>
      )}

      {state === 'uploading' && (
        <View style={s.uploadingRow}>
          <ActivityIndicator color={c.primary} />
          <Text variant="subhead" color="textSecondary" style={s.uploadingTxt}>Uploading…</Text>
        </View>
      )}
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  container: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  title: {
    marginBottom: 2,
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  existingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  existingLabel: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  controls: {
    marginTop: spacing.xs,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  recordDot: { color: '#fff' },
  recordTxt: {
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
    backgroundColor: c.error,
  },
  elapsedTxt: {
    flex: 1,
  },
  stopBtn: {
    backgroundColor: c.error,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  stopTxt: {
    color: '#fff',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  previewLabel: {
    flex: 1,
  },
  discardBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  discardTxt: {},
  saveBtn: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  saveTxt: {
    color: '#fff',
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  uploadingTxt: {},
  deleteBtn: {
    paddingHorizontal: spacing.sm,
  },
  deleteTxt: {},
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: { color: '#fff' },
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
    backgroundColor: c.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: 4,
    backgroundColor: c.primary,
    borderRadius: 2,
  },
  gateHint: {},
});
