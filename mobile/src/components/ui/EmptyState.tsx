import React, { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colours, spacing, typography } from '@shared/constants/theme';
import Button from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

/** Centered empty/zero-state — tinted icon circle, serif title, muted body, optional CTA. */
export default function EmptyState({
  icon = 'heart-outline',
  title,
  description,
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={colours.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          style={styles.action}
          testID={testID ? `${testID}-action` : undefined}
        />
      ) : null}
    </View>
  );
}

// Re-export the icon prop type for screens building dynamic icon maps
export type EmptyStateIcon = ComponentProps<typeof EmptyState>['icon'];

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    backgroundColor: colours.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.display,
    color: colours.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  action: {
    minWidth: 160,
  },
});
