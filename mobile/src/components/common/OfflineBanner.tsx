import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet } from 'react-native';
import Text from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { colours, spacing, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../motion';

interface Props {
  lastSyncedLabel?: string | null;
  isStale?: boolean;
  onRefresh?: () => void;
}

export default function OfflineBanner({ lastSyncedLabel, isStale, onRefresh }: Props) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <View style={s.banner} testID="offline-banner" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text variant="caption" color="onPrimary" style={s.text}>
        {isStale ? 'Offline. Data may be outdated' : 'Offline. Showing saved profiles'}
      </Text>
      {lastSyncedLabel ? (
        <Text variant="caption" style={s.sub}>{lastSyncedLabel}</Text>
      ) : null}
      {onRefresh ? (
        <PressableScale
          onPress={onRefresh}
          style={s.refreshBtn}
          testID="offline-banner-refresh"
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="refresh-outline" size={16} color="#fff" />
        </PressableScale>
      ) : null}
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  text: {
    flex: 1,
  },
  sub: {
    color: 'rgba(255,255,255,0.75)',
  },
  refreshBtn: {
    padding: spacing.xs,
    minWidth: 32,
    alignItems: 'center',
  },
});
