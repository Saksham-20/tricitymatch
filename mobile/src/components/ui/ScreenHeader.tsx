import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { spacing, type } from '@shared/constants/theme';
import { PressableScale } from '../motion';
import { useTheme } from '../../hooks/useTheme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
  testID?: string;
}

/** Editorial header for custom (headerShown:false) screens — serif title + optional back/right action. */
export default function ScreenHeader({ title, subtitle, onBack, showBack = true, right, testID }: ScreenHeaderProps) {
  const navigation = useNavigation();
  const { c } = useTheme();
  const handleBack = onBack ?? (() => navigation.goBack());

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.left}>
        {showBack ? (
          <PressableScale
            onPress={handleBack}
            haptic
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID={testID ? `${testID}-back` : undefined}
          >
            <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
          </PressableScale>
        ) : null}
        <View style={styles.titleGroup}>
          <Text style={[type.title2, { color: c.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[type.footnote, styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.xs },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm },
  titleGroup: { flex: 1 },
  subtitle: { marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
