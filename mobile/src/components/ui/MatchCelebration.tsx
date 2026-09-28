import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Modal, StyleSheet, View } from 'react-native';
import Text from './Text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ThemeColours } from '@shared/constants/theme';
import { duration, EASE_OUT, spring } from '@shared/constants/motion';
import { haptics } from '../../utils/haptics';
import { PressableScale, useReduceMotion } from '../motion';
import { useUIStore } from '../../stores/uiStore';
import Button from './Button';

const OUT = Easing.bezier(...EASE_OUT);

// A decorative one-off pulse ring, not a single named interaction from the
// shared duration table — kept as its own named constant.
const PULSE_RING_MS = 900;

/** The seal lands from just under full size — never from scale(0) (doctrine §10.11). */
const SEAL_FROM = 0.86;

interface Props {
  visible: boolean;
  name?: string;
  onClose: () => void;
  onMessage?: () => void;
}

/**
 * Mutual-match reveal — a tasteful full-screen gold seal that settles in with
 * `spring.momentum` + a success haptic (handoff: "no confetti spam"). This is
 * RN's earned-celebration exception (doctrine §10.2 ruling 18 / web ruling 7's
 * confetti carve-over) — the one place a spring with genuine overshoot is used
 * for something other than press feedback. Burgundy scrim, gold seal, name
 * line, message / keep-browsing CTAs. Rare tier (delight budget).
 *
 * Enter: scrim + copy fade over `duration.modal`; the seal rises from 0.86 with
 * opacity and springs to 1. Exit: everything fades over `duration.modalExit`
 * (faster than the entrance) and the Modal unmounts on completion, so the
 * dismiss is no longer a hard cut. Reduce Motion / elder mode: opacity only — no
 * seal scale, no pulse ring. The haptic fires on open, on the same frame as the reveal.
 */
export default function MatchCelebration({ visible, name, onClose, onMessage }: Props) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  // Elder mode carries no motion beyond opacity, same as the OS setting.
  const osReduced = useReduceMotion();
  const elderMode = useUIStore((s) => s.elderMode);
  const reduced = osReduced || elderMode;
  // Read inside the open effect without making a live Reduce Motion flip replay the reveal
  // (and its haptic) on a celebration that is already on screen.
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const [mounted, setMounted] = useState(visible);
  const wantOpen = useRef(visible);
  // Callers clear `name` in the same breath as `visible`, so hold the last one
  // for the length of the exit or the subtitle vanishes mid-fade.
  const shownName = useRef(name);
  if (visible) shownName.current = name;

  const fade = useSharedValue(0);
  const seal = useSharedValue(reduced ? 1 : SEAL_FROM);
  const pulse = useSharedValue(0);

  const unmount = useCallback(() => {
    if (!wantOpen.current) setMounted(false);
  }, []);

  useEffect(() => {
    wantOpen.current = visible;
    if (visible) {
      setMounted(true);
      haptics.success();
      fade.value = withTiming(1, { duration: duration.modal, easing: OUT });
      if (reducedRef.current) {
        seal.value = 1;
        pulse.value = 0;
      } else {
        seal.value = SEAL_FROM;
        seal.value = withSpring(1, spring.momentum);
        // One subtle ring pulse behind the seal — celebration, not confetti.
        pulse.value = 0;
        pulse.value = withTiming(1, { duration: PULSE_RING_MS, easing: OUT });
      }
    } else {
      fade.value = withTiming(0, { duration: duration.modalExit, easing: OUT }, (finished) => {
        'worklet';
        if (finished) runOnJS(unmount)();
      });
    }
  }, [visible, fade, seal, pulse, unmount]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const sealStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: seal.value }],
  }));
  const copyStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.5 * fade.value,
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));

  // `visible ||` so the very render that flips visible on already carries the Modal —
  // the reveal starts on the same commit, not one render later.
  if (!visible && !mounted) return null;

  const who = shownName.current;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
        {/* The ring lives in the seal's own box so it pulses from the seal's centre, not the screen's. */}
        <View style={styles.sealBox}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} pointerEvents="none" />
          <Animated.View style={sealStyle}>
            <LinearGradient
              colors={[c.g300, c.g600]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.seal}
            >
              <Ionicons name="heart" size={48} color={c.goldText} />
            </LinearGradient>
          </Animated.View>
        </View>
        {/* Inert while leaving, so a second tap cannot fire onMessage/onClose twice. */}
        <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.copy, copyStyle]}>
          <Text variant="title1" style={styles.title}>It's a match!</Text>
          {who ? <Text variant="callout" style={styles.sub}>You and {who} have shown interest in each other.</Text> : null}
          <View style={styles.ctaRow}>
            {onMessage ? (
              <Button title="Send a message" variant="gold" icon="chatbubble" onPress={onMessage} style={styles.cta} />
            ) : null}
            {/* Not Button's `text` variant: that is accent-coloured, which is roughly 2:1 on
                this burgundy scrim. White at the sub-copy's weight reads and stays secondary. */}
            <PressableScale
              onPress={onClose}
              style={styles.dismiss}
              accessibilityRole="button"
              accessibilityLabel="Keep browsing"
              testID="match-keep-browsing"
            >
              <Text variant="headline" style={styles.dismissText}>Keep browsing</Text>
            </PressableScale>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  scrim: {
    backgroundColor: 'rgba(85,23,46,0.94)', // p700 @ ~94%
  },
  sealBox: { width: 104, height: 104, marginBottom: 22 },
  pulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: c.g300,
  },
  seal: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { alignItems: 'center', alignSelf: 'stretch' },
  title: { color: '#fff', textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.86)', textAlign: 'center', marginTop: 8, maxWidth: 300 },
  ctaRow: { marginTop: 28, width: '100%', gap: 4, alignItems: 'center' },
  cta: { width: '100%' },
  dismiss: { minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  dismissText: { color: 'rgba(255,255,255,0.86)', textAlign: 'center' },
});
