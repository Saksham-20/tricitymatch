import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { borderRadius, shadows, darkShadows, spacing } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface CardProps extends ViewProps {
  /** Use the e3 elevation ramp instead of the default e2 */
  elevated?: boolean;
  /** Apply card padding (default true) */
  padded?: boolean;
}

export default function Card({ elevated = false, padded = true, style, children, ...rest }: CardProps) {
  const { c, isDark } = useTheme();
  const sh = isDark ? darkShadows : shadows;
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: c.surfaceCard, borderColor: c.border },
        elevated ? sh.e3 : sh.e2,
        padded && styles.padded,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  padded: { padding: spacing.lg },
});
