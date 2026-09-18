import React, { ComponentProps } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colours, spacing, type ThemeColours } from '@shared/constants/theme';
import Button from './Button';
import Text from './Text';

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
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const isError = variant === 'error';
  const glyph = icon ?? (isError ? 'alert-circle-outline' : 'heart-outline');
  return (
    <View style={styles.container} testID={testID}>
      <View style={[styles.iconCircle, isError && styles.iconCircleError]}>
        <Ionicons name={glyph} size={28} color={isError ? c.error : c.accent} />
      </View>
      <Text variant="title3" color="fgStrong" style={styles.title}>{title}</Text>
      {description ? <Text variant="subhead" color="textMuted" style={styles.description}>{description}</Text> : null}
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

const makeStyles = (c: ThemeColours) => StyleSheet.create({
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
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconCircleError: { backgroundColor: c.errorBg },
  title: {
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 280,
  },
  action: { minWidth: 180 },
});
