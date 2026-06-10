import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colours, spacing, typography } from '@shared/constants/theme';

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
  const handleBack = onBack ?? (() => navigation.goBack());

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID={testID ? `${testID}-back` : undefined}
          >
            <Ionicons name="chevron-back" size={24} color={colours.textPrimary} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.titleGroup}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colours.background,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm },
  titleGroup: { flex: 1 },
  title: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.display,
    color: colours.textPrimary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    marginTop: 2,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
