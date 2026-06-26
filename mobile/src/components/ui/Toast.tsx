import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colours, shadows, type } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';

export type ToastTone = 'ok' | 'err' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  tone?: ToastTone;
  /** auto-dismiss after this many ms (default 2600) */
  duration?: number;
  onHide?: () => void;
}

const ICON: Record<ToastTone, keyof typeof Ionicons.glyphMap> = {
  ok: 'checkmark-circle',
  err: 'alert-circle',
  info: 'information-circle',
};
const TINT: Record<ToastTone, string> = {
  ok: colours.success,
  err: '#FF6B6B',
  info: colours.info,
};

/** Floating snackbar — inverts on dark, auto-dismisses. Mount once near the screen root. */
export default function Toast({ visible, message, tone = 'ok', duration = 2600, onHide }: ToastProps) {
  const { isDark } = useTheme();
  const y = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(y, { toValue: 0, useNativeDriver: true, stiffness: 240, damping: 28 } as never),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(y, { toValue: 40, duration: 180, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => onHide?.());
      }, duration);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [visible, duration, onHide, y, opacity]);

  if (!visible) return null;
  const bg = isDark ? '#FFFFFF' : colours.n900;
  const fg = isDark ? colours.n900 : '#FFFFFF';

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, shadows.e4, { backgroundColor: bg, opacity, transform: [{ translateY: y }] }]}
    >
      <Ionicons name={ICON[tone]} size={22} color={TINT[tone]} />
      <Text style={[styles.text, { color: fg }]} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 96,
    zIndex: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: borderRadius.md,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  text: { ...type.subhead, flex: 1 },
});
