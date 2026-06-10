import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { borderRadius, colours, shadows, spacing } from '@shared/constants/theme';

interface CardProps extends ViewProps {
  /** Use shadows.md instead of the default shadows.sm */
  elevated?: boolean;
  /** Apply spacing.lg padding (default true) */
  padded?: boolean;
}

export default function Card({ elevated = false, padded = true, style, children, ...rest }: CardProps) {
  return (
    <View style={[styles.base, elevated ? shadows.md : shadows.sm, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.lg,
  },
  padded: {
    padding: spacing.lg,
  },
});
