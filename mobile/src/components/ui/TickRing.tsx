import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { colours, type, type ThemeColours } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useFillAnimation } from '../motion';

interface TickRingProps {
  /** 0–100 */
  value: number;
  size?: number;
  ticks?: number;
  tickLength?: number;
  tickWidth?: number;
  /** filled-tick colour (defaults to brand accent) */
  color?: string;
  children?: React.ReactNode;
}

/** A single tick that crossfades on/off as the animated fill sweeps past it. */
function Tick({
  index,
  ticks,
  progress,
  threshold,
  size,
  tickLength,
  tickWidth,
  onColor,
  offColor,
}: {
  index: number;
  ticks: number;
  progress: Animated.SharedValue<number>;
  threshold: number;
  size: number;
  tickLength: number;
  tickWidth: number;
  onColor: string;
  offColor: string;
}) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const angle = (360 / ticks) * index;
  const radius = size / 2;
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value >= threshold ? onColor : offColor,
  }));
  return (
    <Animated.View
      style={[
        styles.tick,
        {
          width: tickWidth,
          height: tickLength,
          borderRadius: tickWidth,
          transform: [{ rotate: `${angle}deg` }, { translateY: -(radius - tickLength / 2 - 1) }],
        },
        animatedStyle,
      ]}
    />
  );
}

/**
 * Rim gauge built from N radial tick marks; the first `value%` are filled,
 * animating 0→value on mount (handoff "fill on view"). Pure-View (no SVG) so it
 * works without a native rebuild. Powers the completion ring (10 ticks) and the
 * compatibility ring (24 ticks).
 */
export default function TickRing({
  value,
  size = 88,
  ticks = 10,
  tickLength = 10,
  tickWidth = 3,
  color,
  children,
}: TickRingProps) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const fillColor = color ?? c.accent;
  const v = Math.max(0, Math.min(100, value));
  const progress = useFillAnimation(v);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: ticks }).map((_, i) => (
        <Tick
          key={i}
          index={i}
          ticks={ticks}
          progress={progress}
          // a tick lights once the fill passes its share of the rim
          threshold={((i + 1) / ticks) * 100}
          size={size}
          tickLength={tickLength}
          tickWidth={tickWidth}
          onColor={fillColor}
          offColor={c.border}
        />
      ))}
      <View style={styles.center}>{children}</View>
    </View>
  );
}

interface RingLabelProps { value: number; caption?: string; }

/** Completion ring — 10-tick rim + Playfair % + caption.
 *  Font and tick length scale with `size` so the number never collides with the
 *  rim (a fixed 22pt % overflowed the ticks at the small 58pt Home-card size). */
export function CompletionRing({ value, caption = 'COMPLETE', size = 88 }: RingLabelProps & { size?: number }) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const pctFont = Math.round(size * 0.26);
  const tickLen = Math.max(6, Math.round(size * 0.13));
  // A caption inside a small ring crowds the number — only show it with room.
  const showCaption = !!caption && size >= 72;
  return (
    <TickRing value={value} size={size} ticks={10} tickLength={tickLen}>
      <Text style={[styles.bigPct, { fontSize: pctFont, lineHeight: Math.round(pctFont * 1.1) }]}>
        {Math.round(value)}%
      </Text>
      {showCaption ? <Text style={styles.caption}>{caption}</Text> : null}
    </TickRing>
  );
}

const compatColour = (pct: number) =>
  pct >= 90 ? colours.success : pct >= 75 ? colours.g500 : colours.p500;

/** Compatibility ring — 24-tick gauge tinted by score + center %. */
export function CompatRing({ value, size = 64 }: { value: number; size?: number }) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const colour = compatColour(value);
  return (
    <TickRing value={value} size={size} ticks={24} tickLength={size * 0.12} tickWidth={2.5} color={colour}>
      <Text style={[styles.midPct, { color: colour }]}>{Math.round(value)}</Text>
      <Text style={styles.pctMark}>%</Text>
    </TickRing>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  tick: { position: 'absolute' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  bigPct: { ...type.title2, color: c.fgStrong, lineHeight: 26 },
  caption: { ...type.micro, color: c.textMuted, letterSpacing: 1, marginTop: 1 },
  midPct: { ...type.headline, fontFamily: 'Inter-Bold', lineHeight: 18 },
  pctMark: { ...type.micro, color: c.textMuted, marginTop: -2 },
});
