import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  TextInput,
  StyleSheet,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import PasswordStrength from '../../components/ui/PasswordStrength';
import { PressableScale } from '../../components/motion';
import Screen from '../../components/layout/Screen';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import type { AuthStackParamList } from '../../navigation/types';
import { resetPassword } from '../../api/auth';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PASSWORD_RULES_ATTR, passwordProblem } from '../../utils/passwordRule';
import { tapSize } from '../../utils/elderTheme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
type RouteProps = RouteProp<AuthStackParamList, 'ResetPassword'>;

// api/client.ts rewrites EVERY 429 into a bare Error that carries `retryAfter`
// and no `response` (the reset endpoint has its own submit limiter), so a rate
// limit is recognised by that shape and never read as "offline".
type ApiFailure = {
  response?: { status?: number; data?: { error?: { message?: string } } };
  retryAfter?: number;
};

export default function ResetPasswordScreen() {
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation();
  const hit = tapSize(elder);
  // Input's own floor is 50; elder mode needs its 60pt target. (The Buttons need
  // the same and cannot get it from here: primitive request on Button.)
  const fieldHeight = { minHeight: Math.max(50, hit) };

  // A bare https://tricitymatch.com/reset-password link carries no params at
  // all, so `route.params` itself can be undefined: destructuring it crashed the
  // screen instead of saying the link was incomplete.
  const token = route.params?.token ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // The server said THIS token is unusable (expired, already used, unknown): no
  // amount of retyping fixes that, so it gets its own state with a way out. Kept
  // as the rejected token rather than a flag so a newer link opened onto this
  // same screen (new route params) is given a fresh chance, not the old verdict.
  const [rejectedToken, setRejectedToken] = useState<string | null>(null);
  const linkDead = !token || rejectedToken === token;
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const confirmRef = useRef<TextInput>(null);

  // Android reads accessibilityLiveRegion; iOS needs an explicit announcement.
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  useEffect(() => {
    if (success && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t('auth.resetPassword.success'));
  }, [success, t]);

  // Input's error text has no live region, so anything set on a field is also
  // spoken; otherwise a screen-reader user hears nothing when a rule fails.
  const flagField = (key: 'password' | 'confirmPassword', problem: string) => {
    setFieldErrors((p) => ({ ...p, [key]: problem }));
    if (problem) AccessibilityInfo.announceForAccessibility(problem);
  };

  const confirmMismatch = () => t('auth.signup.passwordMismatch');

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const pwProblem = passwordProblem(password);
    if (pwProblem) errs.password = pwProblem;
    if (!confirmPassword) errs.confirmPassword = t('auth.resetPassword.confirmRequired', 'Confirm your new password');
    else if (password !== confirmPassword) errs.confirmPassword = confirmMismatch();
    setFieldErrors(errs);
    const first = errs.password || errs.confirmPassword;
    if (first) AccessibilityInfo.announceForAccessibility(first);
    return Object.keys(errs).length === 0;
  };

  const handleReset = async () => {
    if (loading) return;
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      const failure = err as ApiFailure;
      const status = failure?.response?.status;
      const message = failure?.response?.data?.error?.message ?? '';
      const rateLimited = status === 429 || (!failure?.response && typeof failure?.retryAfter === 'number');
      // 400 also covers a rejected password shape, and that IS fixable by
      // retyping. Only a message that names the token, or an account that no
      // longer exists (404), means this link is finished.
      if ((status === 400 && /token/i.test(message)) || status === 404) {
        setRejectedToken(token);
      } else if (status === 400) {
        setError(t('auth.resetPassword.rejected', 'That password was not accepted. Check the rules under the field and try again.'));
      } else if (rateLimited) {
        setError(t('auth.errors.tooManyRequests', 'Too many requests. Please try again later.'));
      } else if (!failure?.response && axios.isAxiosError(err)) {
        // A real transport failure: the request never reached the server.
        setError(t('common.networkError'));
      } else {
        setError(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Screen
        edges={['top']}
        scroll
        contentContainerStyle={styles.successContainer}
        testID="ResetPasswordScreen-success"
      >
        <Ionicons name="checkmark-circle" size={56} color={c.successAccent} style={styles.successCheck} accessibilityElementsHidden importantForAccessibility="no" />
        <Text variant="title3" color="textPrimary" style={styles.successTitle} accessibilityRole="header" accessibilityLiveRegion="polite">{t('auth.resetPassword.success')}</Text>
        <Text variant="callout" color="textSecondary" style={styles.successSubtitle}>{t('auth.resetPassword.successBody', 'You can now sign in with your new password.')}</Text>
        <Button
          title={t('auth.backToSignIn', 'Back to sign in')}
          onPress={() => navigation.navigate('Login')}
          haptic={false}
          testID="ResetPasswordScreen-backToLogin"
          style={styles.successBtn}
        />
      </Screen>
    );
  }

  if (linkDead) {
    return (
      <Screen edges={['top']} contentContainerStyle={styles.centered} testID="ResetPasswordScreen-linkDead">
        <EmptyState
          variant="error"
          icon="link-outline"
          title={t('auth.resetPassword.linkDead.title', "This reset link can't be used")}
          description={t('auth.resetPassword.linkDead.description', 'It is incomplete, has expired or was already used. Request a new link and try again.')}
          actionLabel={t('auth.resetPassword.linkDead.action', 'Request a new link')}
          onAction={() => navigation.navigate('ForgotPassword')}
          testID="ResetPasswordScreen-linkDeadState"
        />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['top']}
      keyboard
      scroll
      contentContainerStyle={styles.content}
      testID="ResetPasswordScreen"
    >
      {navigation.canGoBack() && (
        <PressableScale
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { width: hit, height: hit }]}
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="reset-back"
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </PressableScale>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="lock-closed-outline" size={28} color={c.primary} />
        </View>
        <Text variant="title1" color="textPrimary" style={styles.title} accessibilityRole="header">{t('auth.resetPassword.heading', 'Reset password')}</Text>
        <Text variant="callout" color="textSecondary">{t('auth.resetPassword.subtitle', 'Choose a new password for your account.')}</Text>
      </View>

      {/* Error */}
      {error ? (
        <View style={styles.errorBanner} testID="ResetPasswordScreen-error" accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={c.error} style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no" />
          <Text variant="subhead" color="error" style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* New password */}
      <Input
        label={t('auth.resetPassword.newPasswordLabel', 'New password')}
        value={password}
        onChangeText={(v) => { setPassword(v); setFieldErrors((p) => ({ ...p, password: '' })); }}
        onBlur={() => { if (password) flagField('password', passwordProblem(password) ?? ''); }}
        helper={t('auth.passwordHelper', 'Use 8 or more characters with upper and lower case letters, a number and one of @ $ ! % * ? &')}
        secureToggle
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        passwordRules={PASSWORD_RULES_ATTR}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        accessibilityLabel={t('auth.resetPassword.newPasswordLabel', 'New password')}
        error={fieldErrors.password}
        style={fieldHeight}
        testID="ResetPasswordScreen-password"
        toggleTestID="ResetPasswordScreen-togglePassword"
      />
      {password.length > 0 && (
        <View style={styles.strength}>
          <PasswordStrength password={password} />
        </View>
      )}

      {/* Confirm password */}
      <Input
        ref={confirmRef}
        label={t('auth.resetPassword.confirmPasswordLabel', 'Confirm password')}
        value={confirmPassword}
        onChangeText={(v) => { setConfirmPassword(v); setFieldErrors((p) => ({ ...p, confirmPassword: '' })); }}
        onBlur={() => {
          if (confirmPassword && password !== confirmPassword) flagField('confirmPassword', confirmMismatch());
        }}
        secureToggle
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={handleReset}
        accessibilityLabel={t('auth.resetPassword.confirmPasswordLabel', 'Confirm password')}
        error={fieldErrors.confirmPassword}
        style={fieldHeight}
        testID="ResetPasswordScreen-confirmPassword"
        toggleTestID="ResetPasswordScreen-toggleConfirm"
      />

      {/* Submit */}
      <Button
        title={t('auth.resetPassword.resetAction', 'Reset password')}
        onPress={handleReset}
        loading={loading}
        testID="ResetPasswordScreen-submit"
        loaderTestID="ResetPasswordScreen-loader"
      />
    </Screen>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  content: { padding: spacing['2xl'] },
  centered: { flex: 1, justifyContent: 'center', padding: spacing['2xl'] },
  // Square target; width/height come from tapSize(elder) at the call site.
  backBtn: { alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm, marginBottom: spacing.md },
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: c.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorIcon: { marginTop: 1 },
  errorText: { flex: 1 },
  // The meter sits under the Input's own 15pt group margin; pull it back up to
  // read as part of the field and give the confirm field its space.
  strength: { marginTop: -spacing.xs, marginBottom: spacing.md },
  // Success state: flexGrow so it centres when it fits and scrolls when OS text is large.
  successContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  successCheck: { marginBottom: spacing.md },
  successTitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  successSubtitle: {
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  successBtn: { alignSelf: 'stretch' },
});
