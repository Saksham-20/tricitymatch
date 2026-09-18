import React, { useState, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import { PressableScale } from '../../components/motion';
import Screen from '../../components/layout/Screen';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { resetPassword } from '../../api/auth';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PASSWORD_RULES_ATTR, passwordProblem } from '../../utils/passwordRule';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
type RouteProps = RouteProp<AuthStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation();

  const { token } = route.params;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const confirmRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const pwProblem = passwordProblem(password);
    if (pwProblem) errs.password = pwProblem;
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
        <Ionicons name="checkmark-circle" size={56} color={c.success} style={{ marginBottom: spacing.md }} />
        <Text variant="title3" color="textPrimary" style={styles.successTitle}>{t('auth.resetPassword.success')}</Text>
        <Text variant="callout" color="textSecondary" style={styles.successSubtitle}>You can now sign in with your new password.</Text>
        <PressableScale
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Login')}
          testID="ResetPasswordScreen-backToLogin"
          accessibilityLabel="Back to Sign In"
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="headline" style={{ color: '#FFFFFF' }}>Back to Sign In</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <Screen
      edges={['top']}
      keyboard
      scroll
      contentContainerStyle={[styles.content, { paddingTop: spacing['2xl'] }]}
      testID="ResetPasswordScreen"
    >
      {navigation.canGoBack() && (
        <PressableScale
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="reset-back"
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </PressableScale>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed-outline" size={28} color={c.primary} />
        </View>
        <Text variant="title1" color="textPrimary" style={styles.title}>{t('auth.resetPassword.title')}</Text>
        <Text variant="callout" color="textSecondary">Choose a new password for your account.</Text>
      </View>

      {/* Error */}
      {error ? (
        <View style={styles.errorBanner} testID="ResetPasswordScreen-error" accessibilityLiveRegion="polite">
          <Text variant="subhead" color="error">{error}</Text>
        </View>
      ) : null}

      {/* New password */}
      <Input
        label={t('auth.resetPassword.newPassword')}
        value={password}
        onChangeText={(v) => { setPassword(v); setFieldErrors((p) => ({ ...p, password: '' })); }}
        placeholder="Min. 8 chars, with a number & symbol"
        secureToggle
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        passwordRules={PASSWORD_RULES_ATTR}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        accessibilityLabel={t('auth.resetPassword.newPassword')}
        error={fieldErrors.password}
        testID="ResetPasswordScreen-password"
        toggleTestID="ResetPasswordScreen-togglePassword"
      />

      {/* Confirm password */}
      <Input
        ref={confirmRef}
        label={t('auth.resetPassword.confirmPassword')}
        value={confirmPassword}
        onChangeText={(v) => { setConfirmPassword(v); setFieldErrors((p) => ({ ...p, confirmPassword: '' })); }}
        placeholder="Re-enter new password"
        secureToggle
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={handleReset}
        accessibilityLabel={t('auth.resetPassword.confirmPassword')}
        error={fieldErrors.confirmPassword}
        testID="ResetPasswordScreen-confirmPassword"
        toggleTestID="ResetPasswordScreen-toggleConfirm"
      />

      {/* Submit */}
      <PressableScale
        style={[styles.primaryBtn, loading && styles.btnDisabled]}
        onPress={handleReset}
        disabled={loading}
        accessibilityLabel={t('auth.resetPassword.reset')}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        testID="ResetPasswordScreen-submit"
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" testID="ResetPasswordScreen-loader" />
        ) : (
          <Text variant="headline" style={{ color: '#FFFFFF' }}>{t('auth.resetPassword.reset')}</Text>
        )}
      </PressableScale>
    </Screen>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  scroll: { flex: 1 },
  content: { padding: spacing['2xl'] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm, marginBottom: spacing.md },
  header: { marginBottom: spacing['2xl'], alignItems: 'flex-start' },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.sm,
  },
  errorBanner: {
    backgroundColor: c.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: c.error,
  },
  primaryBtn: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  successEmoji: { fontSize: 56, marginBottom: spacing['2xl'] },
  successTitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  successSubtitle: {
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
});
