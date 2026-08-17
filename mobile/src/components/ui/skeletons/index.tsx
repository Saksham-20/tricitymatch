// Per-layout loading skeletons (Phase 1 of the UI overhaul). Every member
// screen's full-screen loading state should render one of these instead of a
// bare ActivityIndicator; the shimmer + reduce-motion behaviour comes from
// SkeletonBlock. Keep each skeleton roughly the shape of the loaded layout so
// the cross-fade (SkeletonFade) doesn't jump.
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { borderRadius, spacing } from '@shared/constants/theme';
import { SkeletonBlock, SkeletonRow } from '../Skeleton';

/** Generic list screen — avatar rows. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

/** ProfileDetail — hero photo + identity lines + stat band + content cards. */
export function ProfileDetailSkeleton() {
  const { height } = useWindowDimensions();
  return (
    <View>
      <SkeletonBlock width="100%" height={Math.min(430, height * 0.5)} radius={0} />
      <View style={s.pad}>
        <SkeletonBlock width="55%" height={26} />
        <SkeletonBlock width="40%" height={14} style={s.gap} />
        <View style={[s.rowGap, s.gapLg]}>
          <SkeletonBlock width={76} height={30} radius={borderRadius.pill} />
          <SkeletonBlock width={76} height={30} radius={borderRadius.pill} />
          <SkeletonBlock width={76} height={30} radius={borderRadius.pill} />
        </View>
        <SkeletonBlock width="100%" height={110} radius={borderRadius.lg} style={s.gapLg} />
        <SkeletonBlock width="100%" height={90} radius={borderRadius.lg} style={s.gap} />
      </View>
    </View>
  );
}

/** OwnProfile — avatar + name + completion card + section cards. */
export function OwnProfileSkeleton() {
  return (
    <View style={s.pad}>
      <View style={s.center}>
        <SkeletonBlock width={96} height={96} radius={borderRadius.pill} />
        <SkeletonBlock width={160} height={22} style={s.gap} />
        <SkeletonBlock width={110} height={14} style={s.gap} />
      </View>
      <SkeletonBlock width="100%" height={92} radius={borderRadius.lg} style={s.gapLg} />
      <SkeletonBlock width="100%" height={120} radius={borderRadius.lg} style={s.gap} />
      <SkeletonBlock width="100%" height={120} radius={borderRadius.lg} style={s.gap} />
    </View>
  );
}

/** Notifications inbox. */
export function NotificationsSkeleton() {
  return <ListSkeleton rows={9} />;
}

/** Subscription — three plan cards + CTA. */
export function SubscriptionSkeleton() {
  return (
    <View style={s.pad}>
      <SkeletonBlock width="100%" height={150} radius={borderRadius.lg} />
      <SkeletonBlock width="100%" height={150} radius={borderRadius.lg} style={s.gap} />
      <SkeletonBlock width="100%" height={150} radius={borderRadius.lg} style={s.gap} />
    </View>
  );
}

/** EditProfile — photo grid + form rows. */
export function EditProfileSkeleton() {
  return (
    <View style={s.pad}>
      <View style={s.rowGap}>
        <SkeletonBlock width={96} height={120} radius={borderRadius.md} />
        <SkeletonBlock width={96} height={120} radius={borderRadius.md} />
        <SkeletonBlock width={96} height={120} radius={borderRadius.md} />
      </View>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={s.gapLg}>
          <SkeletonBlock width="30%" height={13} />
          <SkeletonBlock width="100%" height={48} radius={borderRadius.sm} style={s.gap} />
        </View>
      ))}
    </View>
  );
}

/** HoroscopeMatch — guna ring + eight koota bars. */
export function HoroscopeSkeleton() {
  return (
    <View style={s.pad}>
      <View style={s.center}>
        <SkeletonBlock width={120} height={120} radius={borderRadius.pill} />
      </View>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={s.gapLg}>
          <View style={s.between}>
            <SkeletonBlock width="25%" height={13} />
            <SkeletonBlock width={40} height={13} />
          </View>
          <SkeletonBlock width="100%" height={8} radius={borderRadius.pill} style={s.gap} />
        </View>
      ))}
    </View>
  );
}

/** ChatThread — alternating message bubbles. */
export function ChatThreadSkeleton() {
  const widths = ['62%', '48%', '70%', '40%', '58%', '52%'] as const;
  return (
    <View style={[s.pad, s.flexEnd]}>
      {widths.map((w, i) => (
        <SkeletonBlock
          key={i}
          width={w}
          height={44}
          radius={borderRadius.lg}
          style={[s.gap, i % 2 === 0 ? s.left : s.right]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  pad: { padding: spacing.gutter },
  gap: { marginTop: spacing.sm },
  gapLg: { marginTop: spacing.lg },
  rowGap: { flexDirection: 'row', gap: spacing.sm },
  center: { alignItems: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  flexEnd: { flex: 1, justifyContent: 'flex-end' },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
});
