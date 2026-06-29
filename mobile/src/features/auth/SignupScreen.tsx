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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { signup } from '../../api/auth';
import { PasswordStrength } from '../../components/ui';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

type PasswordStrength = 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 6) return 'weak';
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  if (password.length >= 8 && score >= 3) return 'strong';
  if (password.length >= 6 && score >= 2) return 'medium';
  return 'weak';
}

const STRENGTH_COLORS: Record<PasswordStrength, string> = {
  weak: colours.error,
  medium: colours.warning,
  strong: colours.success,
};

const STRENGTH_WIDTH: Record<PasswordStrength, string> = {
  weak: '33%',
  medium: '66%',
  strong: '100%',
};

export default function SignupScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { setUser, setAccessToken } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const strength = password.length > 0 ? getPasswordStrength(password) : null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Please enter a valid email';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password))
      errs.password = 'Include an uppercase letter, number, and symbol';
    if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) errs.confirmPassword = t('auth.signup.passwordMismatch');
    if (!termsAccepted) errs.terms = 'You must accept the Terms & Privacy Policy';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignup = async () => {
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await signup(email.trim().toLowerCase(), password);
      setAccessToken(result.accessToken);
      setUser(result.user);
      // RootNavigator switches to Onboarding stack since onboardingComplete = false
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = anyErr?.response?.status;
      if (status === 409) {
        setFieldErrors({ email: 'An account with this email already exists' });
      } else if (status === 429) {
        setError('Too many signup attempts. Please try again later.');
      } else {
        setError(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="SignupScreen"
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
          testID="SignupScreen-back"
        >
          <Text style={styles.backText}>← {t('common.back')}</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.signup.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.signup.subtitle')}</Text>
        </View>

        {/* Global error */}
        {error ? (
          <View style={styles.errorBanner} testID="SignupScreen-error" accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('auth.signup.email')}</Text>
          <TextInput
            style={[styles.input, fieldErrors.email ? styles.inputError : undefined]}
            value={email}
            onChangeText={(v) => { setEmail(v); setFieldErrors((p) => ({ ...p, email: '' })); }}
            placeholder="you@example.com"
            placeholderTextColor={colours.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel={t('auth.signup.email')}
            testID="SignupScreen-email"
          />
          {fieldErrors.email ? (
            <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.email}</Text>
          ) : null}
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('auth.signup.password')}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, styles.passwordInput, fieldErrors.password ? styles.inputError : undefined]}
              value={password}
              onChangeText={(v) => { setPassword(v); setFieldErrors((p) => ({ ...p, password: '' })); }}
              placeholder="Min. 8 chars, with a number & symbol"
              placeholderTextColor={colours.textMuted}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              passwordRules="minlength: 8; required: lower; required: upper; required: digit; required: special;"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              accessibilityLabel={t('auth.signup.password')}
              testID="SignupScreen-password"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              testID="SignupScreen-togglePassword"
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colours.textMuted} />
            </TouchableOpacity>
          </View>
          {/* Password strength indicator (4-segment, shared component) */}
          {password.length > 0 && (
            <View testID="SignupScreen-passwordStrength">
              <PasswordStrength password={password} />
            </View>
          )}
          {fieldErrors.password ? (
            <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.password}</Text>
          ) : null}
        </View>

        {/* Confirm password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('auth.signup.confirmPassword')}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              ref={confirmRef}
              style={[styles.input, styles.passwordInput, fieldErrors.confirmPassword ? styles.inputError : undefined]}
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setFieldErrors((p) => ({ ...p, confirmPassword: '' })); }}
              placeholder="Re-enter password"
              placeholderTextColor={colours.textMuted}
              secureTextEntry={!showConfirm}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleSignup}
              accessibilityLabel={t('auth.signup.confirmPassword')}
              testID="SignupScreen-confirmPassword"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirm((v) => !v)}
              accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
              testID="SignupScreen-toggleConfirm"
            >
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colours.textMuted} />
            </TouchableOpacity>
          </View>
          {fieldErrors.confirmPassword ? (
            <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.confirmPassword}</Text>
          ) : null}
        </View>

        {/* Terms checkbox */}
        <View style={styles.termsRow}>
          <TouchableOpacity
            style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}
            onPress={() => { setTermsAccepted((v) => !v); setFieldErrors((p) => ({ ...p, terms: '' })); }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: termsAccepted }}
            accessibilityLabel={t('auth.signup.termsLabel')}
            testID="SignupScreen-terms"
          >
            {termsAccepted && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </TouchableOpacity>
          <Text style={styles.termsText}>{t('auth.signup.termsLabel')}</Text>
        </View>
        {fieldErrors.terms ? (
          <Text style={[styles.fieldError, { marginTop: -spacing.sm, marginBottom: spacing.md }]} accessibilityLiveRegion="polite">
            {fieldErrors.terms}
          </Text>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSignup}
          disabled={loading}
          accessibilityLabel={t('auth.signup.createAccount')}
          testID="SignupScreen-submit"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" testID="SignupScreen-loader" />
          ) : (
            <Text style={styles.primaryBtnText}>{t('auth.signup.createAccount')}</Text>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <TouchableOpacity
          style={styles.footerLink}
          onPress={() => navigation.navigate('Login')}
          testID="SignupScreen-login"
          accessibilityLabel={t('auth.signup.alreadyMember')}
        >
          <Text style={styles.footerLinkText}>{t('auth.signup.alreadyMember')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colours.background },
  scroll: { flex: 1 },
  content: { padding: spacing['2xl'], paddingTop: 48 },
  backBtn: { marginBottom: spacing.lg, minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: typography.fontSize.base, color: colours.primary, fontFamily: typography.fontFamily.medium },
  header: { marginBottom: spacing['2xl'] },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    marginTop: spacing.xs,
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
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: colours.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    minWidth: 48,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
    minHeight: 48,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colours.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colours.primary, borderColor: colours.primary },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontFamily: typography.fontFamily.bold },
  termsText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
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
  footerLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
  },
  footerLinkText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colours.textSecondary,
  },
});
