import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, View } from 'react-native';
import Text from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { spacing, borderRadius } from '@shared/constants/theme';
import { duration, EASE_IN_OUT, EASE_OUT } from '@shared/constants/motion';
import { resolveImageUri } from '../common/SmartImage';
import { PressableScale, useReduceMotion } from '../motion';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';
import { haptics } from '../../utils/haptics';
import { showToast } from '../../utils/toast';

// The waveform is one of doctrine §10.3's four sanctioned infinite loops (gated
// on `playing`, cancelled on unmount). Its beats come from the duration table:
// `duration.content` per pulse, `duration.press` for the ease back to rest.

/** Touch may drift this far off the chip before the press cancels (doctrine §10.8). */
const RETENTION = { top: 10, bottom: 10, left: 10, right: 10 } as const;

// Lazy expo-av — no-op in Expo Go without a native build.
function getAV(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-av');
  } catch {
    return null;
  }
}

/** One bar of the pseudo-waveform — loops its own scaleY while playing. */
function WaveBar({ playing, delay, color }: { playing: boolean; delay: number; color: string }) {
  const reduced = useReduceMotion();
  const h = useSharedValue(0.4);

  useEffect(() => {
    if (playing && !reduced) {
      h.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: duration.content, easing: Easing.bezier(...EASE_IN_OUT) }),
            withTiming(0.3, { duration: duration.content, easing: Easing.bezier(...EASE_IN_OUT) }),
          ),
          -1,
        ),
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(0.4, { duration: duration.press, easing: Easing.bezier(...EASE_OUT) });
    }
    return () => cancelAnimation(h);
  }, [playing, reduced, delay, h]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: h.value }] }));
  return <Animated.View style={[wave.bar, { backgroundColor: color }, style]} />;
}

interface AudioIntroChipProps {
  url: string;
  /** Free viewers get an upgrade path instead of playback. */
  isPremiumViewer?: boolean;
  /** Where a locked chip goes when tapped (the upgrade flow). Without it a locked tap only explains. */
  onLockedPress?: () => void;
}

/**
 * A toast is silent to a screen reader (react-native-toast-message ships no
 * accessibility props), and none of these outcomes follows a tap on something
 * that would announce it, so each is spoken as well as shown.
 */
const notify = (tone: 'info' | 'error', title: string, body: string) => {
  showToast[tone](title, body);
  AccessibilityInfo.announceForAccessibility(`${title}. ${body}`);
};

const fmt = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Modern audio-intro pill: play/pause + animated 5-bar pseudo-waveform +
 * elapsed time. Playback-only surface for the story scroll (recording stays
 * in VoiceIntroRecorder on the own-profile side).
 */
export default function AudioIntroChip({ url, isPremiumViewer = true, onLockedPress }: AudioIntroChipProps) {
  const { c, elder } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const soundRef = useRef<any>(null);

  useEffect(
    () => () => {
      soundRef.current?.unloadAsync?.().catch(() => null);
    },
    [],
  );

  const toggle = useCallback(async () => {
    if (!isPremiumViewer) {
      if (onLockedPress) onLockedPress();
      else notify('info', 'Premium feature', 'Upgrade to listen to voice intros.');
      return;
    }
    const av = getAV();
    if (!av) {
      notify('info', 'Not available', 'Audio needs the full app build.');
      return;
    }
    if (playing) {
      await soundRef.current?.pauseAsync?.().catch(() => null);
      setPlaying(false);
      haptics.light();
      return;
    }
    setLoading(true);
    try {
      // expo-av exports `Audio` (and `Video`); `Sound` lives at `Audio.Sound`.
      const { Audio } = av;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setPlaying(true);
        haptics.light();
        return;
      }
      const resolved = resolveImageUri(url);
      if (!resolved) return;
      const { sound } = await Audio.Sound.createAsync({ uri: resolved }, { shouldPlay: true }, (s: any) => {
        if (!s.isLoaded) return;
        setPositionMs(s.positionMillis ?? 0);
        setDurationMs(s.durationMillis ?? 0);
        if (s.didJustFinish) {
          setPlaying(false);
          soundRef.current?.setPositionAsync?.(0).catch(() => null);
          // Playback ends on its own, with no tap to hang feedback on.
          AccessibilityInfo.announceForAccessibility('Voice intro finished');
        }
      });
      soundRef.current = sound;
      setPlaying(true);
      haptics.light();
    } catch {
      // showToast.error carries the one (warning) haptic for this failed press.
      notify('error', "Couldn't play voice intro", 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [isPremiumViewer, onLockedPress, playing, url]);

  const timeLabel = durationMs > 0 ? fmt(playing ? positionMs : durationMs) : '';
  const label = !isPremiumViewer
    ? 'Voice intro, locked. Upgrade to listen'
    : loading
      ? 'Loading voice intro'
      : playing
        ? 'Pause voice intro'
        : `Play voice intro${durationMs > 0 ? `, ${fmt(durationMs)}` : ''}`;

  return (
    // No press-in haptic: a locked press only navigates to Upgrade (noise, §10.8)
    // and a failed play would buzz twice. The one haptic fires in `toggle`, when
    // playback actually starts or pauses.
    <PressableScale
      onPress={toggle}
      disabled={loading}
      style={[chip.wrap, { backgroundColor: c.accentSoft, minHeight: tapSize(elder) }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading, busy: loading }}
      pressRetentionOffset={RETENTION}
      testID="audio-intro-chip"
    >
      <View style={[chip.playBtn, { backgroundColor: c.primary }]}>
        {loading ? (
          <ActivityIndicator size="small" color={c.onPrimary} />
        ) : (
          <Ionicons
            name={isPremiumViewer ? (playing ? 'pause' : 'play') : 'lock-closed'}
            size={16}
            color={c.onPrimary}
          />
        )}
      </View>
      {/* Decorative: the button's own label already says what it does. */}
      <View style={chip.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4].map((i) => (
          <WaveBar key={i} playing={playing} delay={i * 90} color={c.primary} />
        ))}
      </View>
      <Text variant="caption" color="primary">{timeLabel || 'Listen'}</Text>
    </PressableScale>
  );
}

const chip = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: spacing.lg,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 22 },
});

// Static geometry only; the colour comes in per bar from the active theme.
const wave = StyleSheet.create({
  bar: { width: 3, height: 18, borderRadius: 2 },
});
