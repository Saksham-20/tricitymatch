import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colours, type } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';

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

/**
 * Rim gauge built from N radial tick marks; the first `value%` are filled.
 * Pure-View (no SVG) so it works without a native rebuild. Powers the
 * completion ring (10 ticks) and the compatibility ring (24 ticks).
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
  const fillColor = color ?? c.accent;
  const v = Math.max(0, Math.min(100, value));
  const filled = Math.round((v / 100) * ticks);
  const radius = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: ticks }).map((_, i) => {
        const angle = (360 / ticks) * i;
        const on = i < filled;
        return (
          <View
            key={i}
            style={[
              styles.tick,
              {
                width: tickWidth,
                height: tickLength,
                borderRadius: tickWidth,
                backgroundColor: on ? fillColor : c.border,
                transform: [{ rotate: `${angle}deg` }, { translateY: -(radius - tickLength / 2 - 1) }],
              },
            ]}
          />
        );
      })}
      <View style={styles.center}>{children}</View>
    </View>
  );
}

interface RingLabelProps { value: number; caption?: string; }

/** Completion ring — 10-tick rim + Playfair % + caption. */
export function CompletionRing({ value, caption = 'COMPLETE', size = 88 }: RingLabelProps & { size?: number }) {
  return (
    <TickRing value={value} size={size} ticks={10} tickLength={10}>
      <Text style={styles.bigPct}>{Math.round(value)}%</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </TickRing>
  );
}

const compatColour = (pct: number) =>
  pct >= 90 ? colours.success : pct >= 75 ? colours.g500 : colours.p500;

/** Compatibility ring — 24-tick gauge tinted by score + center %. */
export function CompatRing({ value, size = 64 }: { value: number; size?: number }) {
  const colour = compatColour(value);
  return (
    <TickRing value={value} size={size} ticks={24} tickLength={size * 0.12} tickWidth={2.5} color={colour}>
      <Text style={[styles.midPct, { color: colour }]}>{Math.round(value)}</Text>
      <Text style={styles.pctMark}>%</Text>
    </TickRing>
  );
}

const styles = StyleSheet.create({
  tick: { position: 'absolute' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  bigPct: { ...type.title2, color: colours.fgStrong, lineHeight: 26 },
  caption: { ...type.micro, color: colours.textMuted, letterSpacing: 1, marginTop: 1 },
  midPct: { ...type.headline, fontFamily: 'Inter-Bold', lineHeight: 18 },
  pctMark: { ...type.micro, color: colours.textMuted, marginTop: -2 },
});
