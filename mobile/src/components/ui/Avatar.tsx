import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';
import SmartImage from '../common/SmartImage';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  /** rounded-square instead of circle */
  square?: boolean;
  /** show the green verified tick badge */
  verified?: boolean;
  /** show an online presence dot */
  online?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Brand avatar — photo with Playfair initials fallback (p100 / p700), optional
 * verified tick and online dot. Mirrors the handoff `.av` component.
 */
export default function Avatar({ uri, name, size = 48, square, verified, online, style }: AvatarProps) {
  const { c } = useTheme();
  const radius = square ? Math.round(size * 0.28) : size / 2;
  const badge = Math.max(16, Math.round(size * 0.34));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <SmartImage
        uri={uri}
        name={name}
        initialSize={Math.round(size * 0.42)}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: 'rgba(139,35,70,0.14)',
        }}
      />
      {verified && (
        <View
          style={[
            styles.badge,
            { width: badge, height: badge, borderRadius: badge / 2, borderColor: c.surfaceCard },
          ]}
        >
          <Ionicons name="checkmark" size={Math.round(badge * 0.6)} color="#fff" />
        </View>
      )}
      {online && (
        <View
          style={[
            styles.online,
            { borderColor: c.surfaceCard },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colours.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  online: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colours.success,
    borderWidth: 2,
  },
});
