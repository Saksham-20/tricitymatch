import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { useOnboarding } from './OnboardingContext';

const TOTAL_STEPS = 14;

interface OnboardingLayoutProps {
  step: number;
  title: string;
  subtitle?: string;
  onContinue: () => void;
  continueDisabled?: boolean;
  skippable?: boolean;
  onSkip?: () => void;
  children: React.ReactNode;
}

export default function OnboardingLayout({
  step,
  title,
  subtitle,
  onContinue,
  continueDisabled = false,
  skippable = false,
  onSkip,
  children,
}: OnboardingLayoutProps) {
  const { t } = useTranslation();
  const { goBack, isSaving } = useOnboarding();
  const progress = step / TOTAL_STEPS;

  return (
    <SafeAreaView style={styles.safe} testID={`OnboardingStep${step}`}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} testID="btn-back" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.stepLabel} accessibilityLabel={t('onboarding.progress', { current: step, total: TOTAL_STEPS })}>
          {t('onboarding.progress', { current: step, total: TOTAL_STEPS })}
        </Text>
        {skippable ? (
          <TouchableOpacity onPress={onSkip} testID="btn-skip" accessibilityLabel={t('common.skip')}>
            <Text style={styles.skipText}>{t('common.skip')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.content}>{children}</View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueBtn, (continueDisabled || isSaving) && styles.continueBtnDisabled]}
            onPress={onContinue}
            disabled={continueDisabled || isSaving}
            testID="btn-continue"
            accessibilityLabel={t('onboarding.saveAndContinue')}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueBtnText}>{t('onboarding.saveAndContinue')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colours.background,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  headerRight: { width: 40 },
  skipText: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colours.border,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colours.primary,
    borderRadius: borderRadius.full,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colours.textSecondary,
    marginBottom: spacing['2xl'],
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  content: { gap: spacing.lg },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colours.border,
    backgroundColor: colours.background,
  },
  continueBtn: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
  },
});
