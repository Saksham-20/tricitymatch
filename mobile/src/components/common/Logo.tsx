import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Text, { type TypeRole } from '../ui/Text';
import { colours } from '@shared/constants/theme';

type Variant = 'default' | 'stacked' | 'white' | 'icon';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  variant?: Variant;
  size?: Size;
  showText?: boolean;
}

// The real TricityMatch brand mark, shared with the website (frontend/public/images/logo.svg).
const LOGO = require('../../../assets/logo.png');

const badgeSizes = {
  sm: 32,
  md: 44,
  lg: 56,
  xl: 72,
};

// Wordmark size variants mapped onto the nearest canonical type role by
// point size (original ad-hoc sizes were 16/20/24/30 in the brand serif
// face at every size — the canonical scale only has serif roles at 22+,
// so sm/md render sans here; flagged as a known drift in the Text-primitive
// migration report).
const textVariants: Record<Size, TypeRole> = {
  sm: 'callout',
  md: 'title3',
  lg: 'title2',
  xl: 'title1',
};

export default function Logo({ variant = 'default', size = 'md', showText = true }: LogoProps) {
  const isWhite = variant === 'white';
  const isStacked = variant === 'stacked';
  const isIcon = variant === 'icon';

  const badgeSize = badgeSizes[size];

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
      variant={textVariants[size]}
      color={isWhite ? 'onPrimary' : 'textPrimary'}
      style={styles.name}
      numberOfLines={1}
      importantForAccessibility="no"
      accessibilityElementsHidden
    >
      TricityMatch
    </Text>
  ) : null;

  return (
    <View
      style={isStacked ? styles.stackedContainer : styles.rowContainer}
      accessibilityRole="image"
      accessibilityLabel="TricityMatch"
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
    letterSpacing: 0.3,
  },
});
