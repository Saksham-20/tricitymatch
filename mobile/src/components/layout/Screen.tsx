import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';

export interface ScreenProps {
  children: React.ReactNode;
  /** Safe-area edges to pad. Default: top only (tab bar / nav handles bottom). */
  edges?: Array<'top' | 'bottom'>;
  /** Wrap children in a ScrollView. */
  scroll?: boolean;
  /** Apply the standard 18pt horizontal gutter. */
  padded?: boolean;
  /** Keyboard-avoid (iOS padding / Android default). Use on form screens. */
  keyboard?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Standard screen shell: themed background + safe-area padding via insets
 * (NOT SafeAreaView — insets compose correctly with translucent status bars
 * and edge-to-edge Android 15). Every custom-header screen should use this
 * instead of hand-rolling SafeAreaView.
 */
export default function Screen({
  children,
  edges = ['top'],
  scroll = false,
  padded = false,
  keyboard = false,
  style,
  contentContainerStyle,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const pad: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
  };

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[padded && styles.gutter, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.gutter, contentContainerStyle]}>{children}</View>
  );

  const shell = (
    <View style={[styles.flex, { backgroundColor: c.background }, pad, style]} testID={testID}>
      {body}
    </View>
  );

  if (!keyboard) return shell;
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {shell}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { paddingHorizontal: spacing.gutter },
});
