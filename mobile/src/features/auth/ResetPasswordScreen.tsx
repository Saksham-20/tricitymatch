import React, { useState, useRef } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../navigation/types';
import { resetPassword } from '../../api/auth';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
type RouteProps = RouteProp<AuthStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation();

  const { token } = route.params;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const confirmRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!password) errs.password = 'New password is required';
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (!confirmPassword) errs.confirmPassword = 'Please confirm your new password';
    else if (password !== confirmPassword) errs.confirmPassword = t('auth.signup.passwordMismatch');
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReset = async () => {
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = anyErr?.response?.status;
      if (status === 400) {
        setError('This reset link is invalid or has expired. Please request a new one.');
      } else {
        setError(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.successContainer} testID="ResetPasswordScreen-success">
        <Text style={styles.successEmoji}>✅</Text>
        <Text style={styles.successTitle}>{t('auth.resetPassword.success')}</Text>
        <Text style={styles.successSubtitle}>You can now sign in with your new password.</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Login')}
          testID="ResetPasswordScreen-backToLogin"
          accessibilityLabel="Back to Sign In"
        >
          <Text style={styles.primaryBtnText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="ResetPasswordScreen"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={styles.title}>{t('auth.resetPassword.title')}</Text>
          <Text style={styles.subtitle}>Choose a new password for your account.</Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBanner} testID="ResetPasswordScreen-error" accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* New password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('auth.resetPassword.newPassword')}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput, fieldErrors.password ? styles.inputError : undefined]}
              value={password}
              onChangeText={(v) => { setPassword(v); setFieldErrors((p) => ({ ...p, password: '' })); }}
              placeholder="Min. 6 characters"
              placeholderTextColor={colours.textMuted}
              secureTextEntry={!showPassword}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              accessibilityLabel={t('auth.resetPassword.newPassword')}
              testID="ResetPasswordScreen-password"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              testID="ResetPasswordScreen-togglePassword"
            >
              <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {fieldErrors.password ? (
            <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.password}</Text>
          ) : null}
        </View>

        {/* Confirm password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('auth.resetPassword.confirmPassword')}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              ref={confirmRef}
              style={[styles.input, styles.passwordInput, fieldErrors.confirmPassword ? styles.inputError : undefined]}
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setFieldErrors((p) => ({ ...p, confirmPassword: '' })); }}
              placeholder="Re-enter new password"
              placeholderTextColor={colours.textMuted}
              secureTextEntry={!showConfirm}
              returnKeyType="done"
              onSubmitEditing={handleReset}
              accessibilityLabel={t('auth.resetPassword.confirmPassword')}
              testID="ResetPasswordScreen-confirmPassword"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirm((v) => !v)}
              accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
              testID="ResetPasswordScreen-toggleConfirm"
            >
              <Text style={styles.eyeText}>{showConfirm ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {fieldErrors.confirmPassword ? (
            <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.confirmPassword}</Text>
          ) : null}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleReset}
          disabled={loading}
          accessibilityLabel={t('auth.resetPassword.reset')}
          testID="ResetPasswordScreen-submit"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" testID="ResetPasswordScreen-loader" />
          ) : (
            <Text style={styles.primaryBtnText}>{t('auth.resetPassword.reset')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colours.background },
  scroll: { flex: 1 },
  content: { padding: spacing['2xl'], paddingTop: 60 },
  header: { marginBottom: spacing['2xl'], alignItems: 'flex-start' },
  emoji: { fontSize: 40, marginBottom: spacing.md },
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
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
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
    backgroundColor: '#FAFAFA',
    minHeight: 52,
  },
  inputError: { borderColor: colours.error },
  passwordContainer: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  eyeText: { fontSize: 18 },
  fieldError: {
    fontSize: typography.fontSize.xs,
    color: colours.error,
    marginTop: spacing.xs,
    fontFamily: typography.fontFamily.regular,
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
  successEmoji: { fontSize: 56, marginBottom: spacing['2xl'] },
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
    marginBottom: spacing['3xl'],
  },
});
