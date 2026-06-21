import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { forgotPassword } from '../../api/auth';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr?.response?.status === 429) {
        setError('Too many requests. Please try again later.');
      } else {
        // Don't reveal whether email exists — show generic success to prevent enumeration
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.successContainer} testID="ForgotPasswordScreen-success">
        <View style={styles.successIcon}>
          <Ionicons name="mail-outline" size={30} color={colours.primary} />
        </View>
        <Text style={styles.successTitle}>{t('auth.forgotPassword.success')}</Text>
        <Text style={styles.successSubtitle}>
          If an account exists for {email}, a reset link has been sent. Check your inbox.
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Login')}
          testID="ForgotPasswordScreen-backToLogin"
          accessibilityLabel={t('auth.forgotPassword.backToLogin')}
        >
          <Text style={styles.primaryBtnText}>{t('auth.forgotPassword.backToLogin')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="ForgotPasswordScreen"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
          testID="ForgotPasswordScreen-back"
        >
          <Ionicons name="chevron-back" size={18} color={colours.textSecondary} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="key-outline" size={28} color={colours.primary} />
          </View>
          <Text style={styles.title}>{t('auth.forgotPassword.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.forgotPassword.subtitle')}</Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBanner} testID="ForgotPasswordScreen-error" accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Email input */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('auth.forgotPassword.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(''); }}
            placeholder="you@example.com"
            placeholderTextColor={colours.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            accessibilityLabel={t('auth.forgotPassword.email')}
            testID="ForgotPasswordScreen-email"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          accessibilityLabel={t('auth.forgotPassword.sendLink')}
          testID="ForgotPasswordScreen-submit"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" testID="ForgotPasswordScreen-loader" />
          ) : (
            <Text style={styles.primaryBtnText}>{t('auth.forgotPassword.sendLink')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colours.background },
  scroll: { flex: 1 },
  content: { padding: spacing['2xl'], paddingTop: 48 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.lg, minHeight: 40, alignSelf: 'flex-start' },
  backText: { fontSize: typography.fontSize.base, color: colours.textSecondary, fontFamily: typography.fontFamily.medium },
  header: { marginBottom: spacing['2xl'], alignItems: 'flex-start' },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colours.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    lineHeight: typography.fontSize.base * 1.5,
  },
  errorBanner: {
    backgroundColor: colours.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colours.error,
  },
  errorText: { fontSize: typography.fontSize.sm, color: colours.error, fontFamily: typography.fontFamily.medium },
  fieldGroup: { marginBottom: spacing.lg },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colours.textPrimary,
    backgroundColor: colours.background,
    minHeight: 52,
  },
  primaryBtn: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: colours.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colours.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  successEmoji: { fontSize: 36 },
  successTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  successSubtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * 1.5,
    marginBottom: spacing['3xl'],
  },
});
