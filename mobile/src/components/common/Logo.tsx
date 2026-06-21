import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colours, typography } from '@shared/constants/theme';

type Variant = 'default' | 'stacked' | 'white' | 'icon';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  variant?: Variant;
  size?: Size;
  showText?: boolean;
}

// The real TricityShadi brand mark, shared with the website (frontend/public/images/logo.svg).
const LOGO = require('../../../assets/logo.png');

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

export default function Logo({ variant = 'default', size = 'md', showText = true }: LogoProps) {
  const isWhite = variant === 'white';
  const isStacked = variant === 'stacked';
  const isIcon = variant === 'icon';

  const badgeSize = badgeSizes[size];
  const textColor = isWhite ? '#FFFFFF' : colours.textPrimary;

  const mark = (
    <Image
      source={LOGO}
      style={{ width: badgeSize, height: badgeSize, borderRadius: badgeSize * 0.22 }}
      resizeMode="contain"
      importantForAccessibility="no"
      accessibilityElementsHidden
    />
  );

  const label = showText && !isIcon ? (
    <Text
      style={[styles.name, { fontSize: textSizes[size], color: textColor }]}
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
      {mark}
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
  name: {
    fontFamily: typography.fontFamily.display,
    letterSpacing: 0.3,
  },
});
