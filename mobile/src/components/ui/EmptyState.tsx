import React, { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colours, spacing, type } from '@shared/constants/theme';
import Button from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** 'error' swaps the icon circle to the destructive tint */
  variant?: 'empty' | 'error';
  testID?: string;
}

/** Centered empty / error state — tinted icon circle, serif title, muted body, optional CTA. */
export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'empty',
  testID,
}: EmptyStateProps) {
  const isError = variant === 'error';
  const glyph = icon ?? (isError ? 'alert-circle-outline' : 'heart-outline');
  return (
    <View style={styles.container} testID={testID}>
      <View style={[styles.iconCircle, isError && styles.iconCircleError]}>
        <Ionicons name={glyph} size={28} color={isError ? colours.error : colours.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant={isError ? 'secondary' : 'primary'}
          style={styles.action}
          testID={testID ? `${testID}-action` : undefined}
        />
      ) : null}
    </View>
  );
}

export type EmptyStateIcon = ComponentProps<typeof EmptyState>['icon'];

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 34,
    paddingHorizontal: 26,
  },
  iconCircle: {
    width: 66,
    height: 66,
    borderRadius: borderRadius.pill,
    backgroundColor: colours.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconCircleError: { backgroundColor: colours.errorBg },
  title: {
    ...type.title3,
    color: colours.fgStrong,
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    ...type.subhead,
    color: colours.textMuted,
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 280,
  },
  action: { minWidth: 180 },
});
