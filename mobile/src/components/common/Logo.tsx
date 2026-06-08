import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colours, typography } from '@shared/constants/theme';

type Variant = 'default' | 'stacked' | 'white' | 'icon';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  variant?: Variant;
  size?: Size;
  showText?: boolean;
}

const badgeSizes = {
  sm: 32,
  md: 44,
  lg: 56,
  xl: 72,
};

const textSizes = {
  sm: typography.fontSize.base,
  md: typography.fontSize.xl,
  lg: typography.fontSize['2xl'],
  xl: typography.fontSize['3xl'],
};

const initialSizes = {
  sm: typography.fontSize.sm,
  md: typography.fontSize.base,
  lg: typography.fontSize.lg,
  xl: typography.fontSize.xl,
};

export default function Logo({ variant = 'default', size = 'md', showText = true }: LogoProps) {
  const isWhite = variant === 'white';
  const isStacked = variant === 'stacked';
  const isIcon = variant === 'icon';

  const badgeSize = badgeSizes[size];
  const textColor = isWhite ? '#FFFFFF' : colours.textPrimary;
  const badgeBg = isWhite ? 'rgba(255,255,255,0.2)' : colours.primary;
  const initialColor = '#FFFFFF';

  const badge = (
    <View
      style={[
        styles.badge,
        {
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize * 0.22,
          backgroundColor: badgeBg,
        },
        isWhite && styles.badgeWhiteBorder,
      ]}
      // Accessibility handled by outer container
      importantForAccessibility="no"
      accessibilityElementsHidden
    >
      <Text style={[styles.badgeInitials, { fontSize: initialSizes[size], color: initialColor }]}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        TS
      </Text>
    </View>
  );

  const label = showText && !isIcon ? (
    <Text
      style={[
        styles.name,
        { fontSize: textSizes[size], color: textColor },
      ]}
      numberOfLines={1}
      importantForAccessibility="no"
      accessibilityElementsHidden
    >
      TricityShadi
    </Text>
  ) : null;

  return (
    <View
      style={isStacked ? styles.stackedContainer : styles.rowContainer}
      accessibilityRole="image"
      accessibilityLabel="TricityShadi"
    >
      {badge}
      {label}
    </View>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stackedContainer: {
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWhiteBorder: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  badgeInitials: {
    fontFamily: typography.fontFamily.display,
    letterSpacing: 0.5,
  },
  name: {
    fontFamily: typography.fontFamily.display,
    letterSpacing: 0.3,
  },
  // nameStacked intentionally removed — stackedContainer gap handles spacing
});
