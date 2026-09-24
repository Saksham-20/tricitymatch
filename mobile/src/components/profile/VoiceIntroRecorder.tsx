import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { deleteVoiceIntro, uploadVoiceIntro } from '../../api/profile';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';
import { showToast } from '../../utils/toast';
import { resolveImageUri } from '../common/SmartImage';
import Text from '../ui/Text';
import Button from '../ui/Button';
import IconButton from '../ui/IconButton';
import { PressableScale } from '../motion';

const MAX_DURATION_MS = 30_000;
const MAX_SECONDS = MAX_DURATION_MS / 1000;
/** The screen-reader "time is nearly up" cue fires this many seconds before the cap. */
const WARN_SECONDS = 5;

type RecordingState = 'idle' | 'recording' | 'recorded' | 'playing' | 'uploading';

interface Props {
  existingUrl: string | null;
  onSaved: (url: string | null) => void;
}

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const announce = (message: string) => AccessibilityInfo.announceForAccessibility(message);

/** A decorative glyph: the screen reader skips it and reads the text beside it. */
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

// Lazy-load expo-av: absent in Expo Go without a native build, handled below.
const getAV = () => {
  try {
    return require('expo-av');
  } catch {
    return null;
  }
};

/**
 * Hand the iOS audio session back to playback. `allowsRecordingIOS: true` keeps
 * the record category (earpiece routing, other apps ducked) until something
 * clears it, and only `play` used to.
 */
const releaseRecordingSession = () => {
  const av = getAV();
  if (!av) return;
  Promise.resolve(
    av.Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }),
  ).catch(() => null);
};

/**
 * Own-profile voice intro: record (30s cap), preview, save, replace, remove.
 *
 * Outcomes follow ruling 22: errors and successes are toasts, a denied
 * microphone is an inline notice that says how to fix it (a toast cannot carry
 * the Open Settings action), and the one `Alert` left is the destructive
 * "remove your voice intro" confirmation. Playback of other members' intros
 * lives in AudioIntroChip; this file used to carry a second, unreachable
 * read-only player (no caller ever passed `readOnly`) which is gone.
 */
export default function VoiceIntroRecorder({ existingUrl, onSaved }: Props) {
  const { c, elder } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const tap = tapSize(elder);
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);

  const recordingRef = useRef<any>(null);
  const soundRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  /** A second tap while the first is still opening the recorder must not open another. */
  const startingRef = useRef(false);
  const mountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      soundRef.current?.unloadAsync().catch(() => null);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => null);
        recordingRef.current = null;
        releaseRecordingSession();
      }
    };
  }, [clearTimer]);

  const stopRecording = useCallback(async () => {
    clearTimer();
    const rec = recordingRef.current;
    if (!rec) return;
    // Clear first so the 30s cap and the Stop button cannot both stop it.
    recordingRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      releaseRecordingSession();
      const uri = rec.getURI();
      if (!uri) throw new Error('recording has no file');
      if (!mountedRef.current) return;
      setLocalUri(uri);
      setState('recorded');
      announce('Recording stopped. Preview it or save it.');
    } catch {
      releaseRecordingSession();
      if (!mountedRef.current) return;
      setState('idle');
      showToast.error('Recording failed', 'Please try again.');
    }
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    if (startingRef.current || recordingRef.current) return;
    const av = getAV();
    if (!av) {
      showToast.info('Recording unavailable', "Recording isn't available on this device.");
      return;
    }
    const { Audio } = av;
    startingRef.current = true;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setMicDenied(true);
        return;
      }
      setMicDenied(false);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      if (!mountedRef.current) {
        // Left the screen while the recorder was opening: nobody is left to stop it.
        recording.stopAndUnloadAsync().catch(() => null);
        releaseRecordingSession();
        return;
      }
      recordingRef.current = recording;
      elapsedRef.current = 0;
      setElapsed(0);
      setState('recording');
      announce('Recording started');

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current === MAX_SECONDS - WARN_SECONDS) announce(`${WARN_SECONDS} seconds left`);
        if (elapsedRef.current >= MAX_SECONDS) stopRecording();
      }, 1000);
    } catch {
      releaseRecordingSession();
      if (mountedRef.current) showToast.error('Could not start recording', 'Please try again.');
    } finally {
      startingRef.current = false;
    }
  }, [stopRecording]);

  const play = useCallback(
    async (uri: string) => {
      const av = getAV();
      if (!av) {
        showToast.info('Playback unavailable', "Playback isn't available on this device.");
        return;
      }
      const { Audio } = av;
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        await soundRef.current?.unloadAsync().catch(() => null);
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (st: any) => {
          if (st.isLoaded && st.didJustFinish && mountedRef.current) setState(localUri ? 'recorded' : 'idle');
        });
        if (!mountedRef.current) {
          sound.unloadAsync().catch(() => null);
          return;
        }
        soundRef.current = sound;
        setState('playing');
      } catch {
        showToast.error('Could not play audio', 'Please try again.');
      }
    },
    [localUri],
  );

  const stopPlayback = useCallback(async () => {
    try {
      await soundRef.current?.stopAsync();
    } catch {
      /* already stopped or unloaded */
    }
    setState(localUri ? 'recorded' : 'idle');
  }, [localUri]);

  const playExisting = useCallback(() => {
    const resolved = resolveImageUri(existingUrl);
    if (resolved) play(resolved);
  }, [existingUrl, play]);

  const upload = useCallback(async () => {
    if (!localUri) return;
    setState('uploading');
    // The uploading row below is a polite live region, which TalkBack already
    // reads; announcing as well would say it twice on Android.
    if (Platform.OS === 'ios') announce('Uploading voice intro');
    try {
      const { voiceIntroUrl } = await uploadVoiceIntro(localUri);
      setLocalUri(null);
      onSaved(voiceIntroUrl);
      setState('idle');
      showToast.success('Voice intro saved');
      announce('Voice intro saved');
    } catch {
      // Back to 'recorded' so Save is the retry and the take is not lost.
      setState('recorded');
      showToast.error('Upload failed', 'Check your connection and try again.');
      announce('Upload failed. Your recording is kept. Save to try again.');
    }
  }, [localUri, onSaved]);

  const discardTake = useCallback(() => {
    soundRef.current?.unloadAsync?.().catch(() => null);
    setLocalUri(null);
    setState('idle');
  }, []);

  const remove = useCallback(() => {
    Alert.alert('Remove voice intro', 'Remove your voice intro?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          // A saved intro that is mid-playback keeps sounding after it is gone
          // unless the player is torn down with it.
          await soundRef.current?.unloadAsync?.().catch(() => null);
          soundRef.current = null;
          setState('idle');
          try {
            await deleteVoiceIntro();
            onSaved(null);
            setLocalUri(null);
            showToast.success('Voice intro removed');
            announce('Voice intro removed');
          } catch {
            showToast.error('Could not remove voice intro', 'Please try again.');
          }
        },
      },
    ]);
  }, [onSaved]);

  const showExisting = !!existingUrl && !localUri && (state === 'idle' || state === 'playing');
  const previewing = (state === 'recorded' || state === 'playing') && !!localUri;
  // IconButton sizes itself (44pt, 60pt in elder mode); the row pins the same box so the
  // two toggles below stay identical in every mode.
  const iconBtnSize = { width: tap, height: tap };

  return (
    <View style={s.container} testID="VoiceIntroRecorder">
      <Text variant="headline" color="fgStrong" style={s.title} accessibilityRole="header">Voice intro</Text>
      <Text variant="subhead" color="textSecondary" style={s.subtitle}>
        Record up to {MAX_SECONDS} seconds. It plays on your profile.
      </Text>

      {micDenied && (
        <View style={[s.notice, { backgroundColor: c.surface2 }]} accessibilityLiveRegion="polite" testID="VoiceIntroRecorder-mic-denied">
          <View style={s.noticeTop}>
            <Ionicons name="mic-off-outline" size={18} color={c.textSecondary} {...HIDE_FROM_A11Y} />
            <Text variant="footnote" color="textSecondary" style={s.noticeText}>
              Microphone access is off. Turn it on in Settings to record.
            </Text>
          </View>
          <PressableScale
            style={[s.textBtn, { minHeight: tap }]}
            onPress={() => Linking.openSettings().catch(() => null)}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {/* Text colour, underlined: dark-mode `primary` is 3.56:1 on this
                surface2 notice, and this is the only way out of a permission dead end. */}
            <Text variant="subhead" color="textPrimary" style={s.linkText}>Open Settings</Text>
          </PressableScale>
        </View>
      )}

      {/* Saved intro: play/stop it, or remove it. */}
      {showExisting && (
        <View style={s.row}>
          <IconButton
            icon={state === 'playing' ? 'stop' : 'play'}
            filled
            onPress={state === 'playing' ? stopPlayback : playExisting}
            accessibilityLabel={state === 'playing' ? 'Stop voice intro' : 'Play voice intro'}
            haptic
            style={iconBtnSize}
            testID="voice-intro-existing-toggle"
          />
          <Text variant="subhead" color="textSecondary" style={s.grow}>Voice intro saved</Text>
          <PressableScale
            style={[s.textBtn, { minHeight: tap }]}
            onPress={remove}
            testID="voice-intro-remove"
            accessibilityRole="button"
            accessibilityLabel="Remove voice intro"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="subhead" color="error">Remove</Text>
          </PressableScale>
        </View>
      )}

      {state === 'idle' && (
        <Button
          title={existingUrl ? 'Re-record' : 'Record'}
          icon="mic"
          size="sm"
          onPress={startRecording}
          style={s.recordBtn}
          testID="voice-intro-record"
          accessibilityLabel={existingUrl ? 'Re-record voice intro' : 'Record voice intro'}
        />
      )}

      {/* The row is deliberately NOT one accessible element: an accessible
          container hides its children from VoiceOver, and Stop lives in it. Only
          the timer text carries the elapsed-time label; the announcements above
          cover start, the warning and stop. */}
      {state === 'recording' && (
        <View style={s.row}>
          <View style={[s.recDot, { backgroundColor: c.error }]} {...HIDE_FROM_A11Y} />
          <Text
            variant="subhead"
            color="textPrimary"
            style={s.grow}
            accessible
            accessibilityLabel={`Recording, ${elapsed} seconds of ${MAX_SECONDS}`}
          >
            {formatTime(elapsed)} / {formatTime(MAX_SECONDS)}
          </Text>
          <Button
            title="Stop"
            icon="stop"
            size="sm"
            variant="secondary"
            onPress={stopRecording}
            testID="voice-intro-stop"
            accessibilityLabel="Stop recording"
          />
        </View>
      )}

      {previewing && localUri && (
        <>
          <View style={s.row}>
            <IconButton
              icon={state === 'playing' ? 'stop' : 'play'}
              filled
              onPress={state === 'playing' ? stopPlayback : () => play(localUri)}
              accessibilityLabel={state === 'playing' ? 'Stop preview' : 'Preview recording'}
              haptic
              style={iconBtnSize}
              testID="voice-intro-preview-toggle"
            />
            <Text variant="subhead" color="textSecondary" style={s.grow}>
              Preview ({formatTime(elapsed)})
            </Text>
          </View>
          <View style={s.actions}>
            <Button
              title="Discard"
              variant="ghost"
              size="sm"
              onPress={discardTake}
              style={s.actionBtn}
              testID="voice-intro-discard"
              accessibilityLabel="Discard recording"
            />
            <Button
              title="Save"
              size="sm"
              onPress={upload}
              haptic={false}
              style={s.actionBtn}
              testID="voice-intro-save"
              accessibilityLabel="Save voice intro"
            />
          </View>
        </>
      )}

      {state === 'uploading' && (
        <View style={s.row} accessibilityLiveRegion="polite">
          <ActivityIndicator color={c.primary} />
          <Text variant="subhead" color="textSecondary">Uploading…</Text>
        </View>
      )}
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  container: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: { marginBottom: 2 },
  subtitle: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  grow: { flex: 1 },
  recordBtn: { alignSelf: 'flex-start' },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  // Two deliberate rows (play + label, then the two actions) so a longer Hindi
  // or Punjabi label, or a larger OS text size, cannot push Save onto a line of
  // its own.
  actions: { flexDirection: 'row', gap: spacing.md },
  actionBtn: { flex: 1 },
  textBtn: { justifyContent: 'center', paddingHorizontal: spacing.sm },
  linkText: { textDecorationLine: 'underline' },
  notice: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  noticeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  noticeText: { flex: 1 },
});
