import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { colours, spacing, type, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { resolveImageUri } from '../common/SmartImage';
import { PressableScale, useReduceMotion } from '../motion';
import { useTheme } from '../../hooks/useTheme';
import { showToast } from '../../utils/toast';

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
  const { c } = useTheme();
  const wave = React.useMemo(() => makeWave(c), [c]);
  const reduced = useReduceMotion();
  const h = useSharedValue(0.4);

  useEffect(() => {
    if (playing && !reduced) {
      h.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.3, { duration: 300, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
        ),
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(0.4, { duration: 150 });
    }
    return () => cancelAnimation(h);
  }, [playing, reduced, delay, h]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: h.value }] }));
  return <Animated.View style={[wave.bar, { backgroundColor: color }, style]} />;
}

interface AudioIntroChipProps {
  url: string;
  /** Free viewers get an upgrade nudge instead of playback. */
  isPremiumViewer?: boolean;
}

/**
 * Modern audio-intro pill: play/pause + animated 5-bar pseudo-waveform +
 * elapsed time. Playback-only surface for the story scroll (recording stays
 * in VoiceIntroRecorder on the own-profile side).
 */
export default function AudioIntroChip({ url, isPremiumViewer = true }: AudioIntroChipProps) {
  const { c } = useTheme();
  const [playing, setPlaying] = useState(false);
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
      showToast.info('Premium feature', 'Upgrade to listen to voice intros.');
      return;
    }
    const av = getAV();
    if (!av) {
      showToast.info('Not available', 'Audio needs the full app build.');
      return;
    }
    if (playing) {
      await soundRef.current?.pauseAsync?.().catch(() => null);
      setPlaying(false);
      return;
    }
    try {
      const { Audio, Sound } = av;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setPlaying(true);
        return;
      }
      const resolved = resolveImageUri(url);
      if (!resolved) return;
      const { sound } = await Sound.createAsync({ uri: resolved }, { shouldPlay: true }, (s: any) => {
        if (!s.isLoaded) return;
        setPositionMs(s.positionMillis ?? 0);
        setDurationMs(s.durationMillis ?? 0);
        if (s.didJustFinish) {
          setPlaying(false);
          soundRef.current?.setPositionAsync?.(0).catch(() => null);
        }
      });
      soundRef.current = sound;
      setPlaying(true);
    } catch {
      showToast.error('Could not play', 'Please try again.');
    }
  }, [isPremiumViewer, playing, url]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const timeLabel = durationMs > 0 ? `${fmt(playing ? positionMs : durationMs)}` : '';

  return (
    <PressableScale
      haptic
      onPress={toggle}
      style={[chip.wrap, { backgroundColor: c.accentSoft }]}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause voice intro' : 'Play voice intro'}
      testID="audio-intro-chip"
    >
      <View style={[chip.playBtn, { backgroundColor: c.primary }]}>
        <Ionicons name={isPremiumViewer ? (playing ? 'pause' : 'play') : 'lock-closed'} size={16} color="#fff" />
      </View>
      <View style={chip.bars}>
        {[0, 1, 2, 3, 4].map((i) => (
          <WaveBar key={i} playing={playing} delay={i * 90} color={c.primary} />
        ))}
      </View>
      <Text style={[type.caption, { color: c.primary }]}>{timeLabel || 'Listen'}</Text>
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

const makeWave = (c: ThemeColours) => StyleSheet.create({
  bar: { width: 3, height: 18, borderRadius: 2, backgroundColor: c.primary },
});
