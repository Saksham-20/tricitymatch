import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { colours, type, borderRadius } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { CompatRing } from '../ui/TickRing';
import { useFillAnimation } from '../motion';

interface Props {
  score: number;
  /** show the tick-ring gauge alongside the bar (e.g. on ProfileDetail) */
  ring?: boolean;
}

/** Bar whose fill width animates 0→pct on view (handoff "fill on view"). */
function AnimatedBar({ pct, colour, track }: { pct: number; colour: string; track: string }) {
  const progress = useFillAnimation(pct);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  return (
    <View style={[s.bar, { backgroundColor: track }]}>
      <Animated.View style={[s.fill, { backgroundColor: colour }, fillStyle]} />
    </View>
  );
}

// Score colouring (handoff): green / gold / burgundy.
const scoreColour = (pct: number): string => {
  if (pct >= 90) return colours.success;
  if (pct >= 75) return colours.g500;
  return colours.p500;
};

export default function CompatibilityMeter({ score, ring }: Props) {
  const { c } = useTheme();
  const clamp = Math.max(0, Math.min(100, score));
  const colour = scoreColour(clamp);

  return (
    <View style={s.container} testID="CompatibilityMeter">
      {ring ? (
        <View style={s.ringRow}>
          <CompatRing value={clamp} size={64} />
          <View style={s.ringText}>
            <Text style={[s.label, { color: c.fgStrong }]}>Compatibility</Text>
            <Text style={[s.hint, { color: c.textMuted }]}>
              Based on community, lifestyle & preferences
            </Text>
          </View>
        </View>
      ) : (
        <>
          <View style={s.row}>
            <Text style={[s.label, { color: c.fgStrong }]}>Compatibility</Text>
            <Text style={[s.pct, { color: colour }]}>{clamp}%</Text>
          </View>
          <AnimatedBar pct={clamp} colour={colour} track={c.surface2} />
          <Text style={[s.hint, { color: c.textMuted }]}>
            Based on community, lifestyle & preferences
          </Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingVertical: 8 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ringText: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { ...type.subhead, fontFamily: 'Inter-SemiBold', color: colours.fgStrong },
  pct: { ...type.subhead, fontFamily: 'Inter-Bold' },
  bar: { height: 8, backgroundColor: colours.surface2, borderRadius: borderRadius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: borderRadius.pill },
  hint: { ...type.caption, color: colours.textMuted, marginTop: 4 },
});
