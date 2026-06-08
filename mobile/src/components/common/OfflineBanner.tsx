import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing } from '@shared/constants/theme';

interface Props {
  lastSyncedLabel?: string | null;
  isStale?: boolean;
  onRefresh?: () => void;
}

export default function OfflineBanner({ lastSyncedLabel, isStale, onRefresh }: Props) {
  return (
    <View style={s.banner} testID="offline-banner" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={s.text}>
        {isStale ? 'Offline — data may be outdated' : 'Offline — showing cached profiles'}
      </Text>
      {lastSyncedLabel ? (
        <Text style={s.sub}>{lastSyncedLabel}</Text>
      ) : null}
      {onRefresh ? (
        <TouchableOpacity
          onPress={onRefresh}
          style={s.refreshBtn}
          testID="offline-banner-refresh"
          accessibilityLabel="Retry connection"
        >
          <Ionicons name="refresh-outline" size={16} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: '#fff',
    fontFamily: typography.fontFamily.medium,
  },
  sub: {
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: typography.fontFamily.regular,
  },
  refreshBtn: {
    padding: spacing.xs,
    minWidth: 32,
    alignItems: 'center',
  },
});
