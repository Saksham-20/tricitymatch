import React, { useState } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { borderRadius, shadows, darkShadows } from '@shared/constants/theme';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';
import { useReduceTransparency } from '../motion';
import Button from './Button';
import Text from './Text';

interface GoldLockProps {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onUnlock?: () => void;
  /**
   * The gated content rendered (blurred) behind the lock overlay. It must be
   * the member's real data or nothing at all: a placeholder count or photo
   * behind a blur is still a fabricated number, and the gate exists precisely
   * to withhold real ones. The subtree is hidden from screen readers, so the
   * blur is not the only thing keeping it private.
   */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Floor for the wrap; the lock's own content raises it (see `contentH`). */
const MIN_HEIGHT = 160;
/** Matches `overlay` / `overlayFlow` padding. */
const OVERLAY_PAD = 18;

/** Blur strength when real content sits behind the lock; a bare lock only needs a soft veil. */
const BLUR_OVER_CONTENT = 100;
const BLUR_BARE = 28;

/**
 * Premium gate: a gold lock + unlock CTA that fades in over the gated content.
 *
 * How the content is hidden depends on what the platform can actually do, and
 * the gate must never look safer than it is:
 * - iOS: a real frosted blur (expo-blur) at full strength when there is content
 *   behind it.
 * - Android: expo-blur 14 renders only a translucent tint there (its README:
 *   "only supports iOS"; the blur method defaults to none), which leaves a
 *   locked photo roughly 40 percent visible and recognisable. So with content
 *   behind the lock, Android gets an OPAQUE surface, not a veil.
 * - Reduce Transparency: opaque on both.
 *
 * The pixels of gated content still reach the device (the server decides what to
 * send); the gate is only the last line. Gold here is the premium signal (the
 * lock disc, the unlock CTA) and nothing else.
 */
export default function GoldLock({
  title,
  subtitle,
  ctaLabel = 'Unlock with Premium',
  onUnlock,
  children,
  style,
  testID,
}: GoldLockProps) {
  const { c, isDark, elder } = useTheme();
  const reduceTransparency = useReduceTransparency();
  // A translucent tint is not a blur. With real content behind the lock and no
  // real blur available (Android), only an opaque surface actually withholds it.
  const noRealBlur = Platform.OS === 'android' && !!children;
  // Natural height of the lock's own content. With gated children behind it
  // the overlay is absolutely positioned, so nothing sizes the wrap to fit the
  // title, subtitle and CTA: a hard minHeight clipped them once the OS text
  // size went up. Measuring the content and raising the floor to it keeps the
  // CTA reachable at any size.
  const [contentH, setContentH] = useState(0);
  // With no gated content behind it the wrap has nothing to size it either, so
  // let the overlay sit in flow and the wrap grows to fit.
  const bare = !children;
  return (
    <View
      style={[styles.wrap, { minHeight: Math.max(MIN_HEIGHT, contentH + OVERLAY_PAD * 2) }, style]}
      testID={testID}
    >
      {children ? (
        <View
          style={styles.content}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {children}
        </View>
      ) : null}
      {/* Frosted blur over the gated content on iOS (handoff blur(9) equivalent).
          Reduce Transparency, and Android with content behind (no native blur),
          get an opaque surface instead (doctrine §10.5). */}
      {reduceTransparency || noRealBlur ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: c.surfaceCard }]}
          pointerEvents="none"
        />
      ) : (
        <BlurView
          intensity={children ? BLUR_OVER_CONTENT : BLUR_BARE}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <Animated.View
        // duration.reveal is reserved for Operate-surface scroll reveals
        // (doctrine §10.3) — this is a one-time content entrance instead.
        // Opacity only, so it survives Reduce Motion as it is.
        entering={FadeIn.duration(duration.content).easing(Easing.bezier(...EASE_OUT).factory())}
        style={[
          bare ? styles.overlayFlow : styles.overlay,
          { backgroundColor: c.surfaceCard + '80' },
        ]}
      >
        <View
          style={styles.inner}
          onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
        >
          {/* decorative: the title beneath says what is locked */}
          <LinearGradient
            colors={[c.g300, c.g500]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.lock, isDark ? darkShadows.gold : shadows.gold]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Ionicons name="lock-closed" size={22} color={c.goldText} />
          </LinearGradient>
          <Text variant="headline" color="fgStrong" style={styles.title} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text variant="footnote" color="textSecondary" style={styles.subtitle}>{subtitle}</Text> : null}
          {onUnlock ? (
            <Button
              title={ctaLabel}
              variant="gold"
              size="sm"
              icon="sparkles"
              onPress={onUnlock}
              // size="sm" is 44pt; elder mode owes 60 (the gradient is centred in the taller box).
              style={[styles.cta, elder ? { minHeight: tapSize(true), justifyContent: 'center' } : null]}
            />
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden' },
  content: { transform: [{ scale: 1.04 }] },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: OVERLAY_PAD,
  },
  // same box, in flow — used when there is no gated content to overlay.
  // flexGrow so a lock shorter than MIN_HEIGHT (no subtitle, no CTA) still
  // fills the wrap: without it the tint stopped at the content's height while
  // the blur covered the whole box, leaving an untinted band.
  overlayFlow: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: OVERLAY_PAD,
  },
  // the measured block: everything the lock has to show, at its natural size
  inner: { alignItems: 'center', gap: 8 },
  lock: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', maxWidth: 240 },
  cta: { marginTop: 6, minWidth: 200 },
});
