import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Screen from '../../components/layout/Screen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import type { AuthStackParamList } from '../../navigation/types';
import { forgotPassword } from '../../api/auth';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import { tapSize } from '../../utils/elderTheme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

// api/client.ts rewrites EVERY 429 into a bare Error that carries `retryAfter`
// and no `response`, so the reset-request limiter is recognised by that shape,
// not by `response.status`, and is never read as "offline".
type ApiFailure = { response?: { status?: number }; retryAfter?: number };

export default function ForgotPasswordScreen() {
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const hit = tapSize(elder);
  // Input's own floor is 50; elder mode needs its 60pt target. (The Buttons need
  // the same and cannot get it from here: primitive request on Button.)
  const fieldHeight = { minHeight: Math.max(50, hit) };

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // `fieldError` belongs under the email field; `error` is what the server or
  // network said and sits above the form.
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');

  const emailProblem = (raw: string): string => {
    if (!raw.trim()) return t('auth.errors.emailRequired', 'Enter your email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) return t('auth.errors.emailInvalid', 'Enter a valid email address');
    return '';
  };

  // Input's error text has no live region: a screen-reader user who submits an
  // empty or malformed address would otherwise hear nothing at all.
  const flagField = (problem: string) => {
    setFieldError(problem);
    if (problem) AccessibilityInfo.announceForAccessibility(problem);
  };

  // Android reads accessibilityLiveRegion; iOS needs an explicit announcement.
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  useEffect(() => {
    if (sent && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t('auth.forgotPassword.sentTitle', 'Check your email'));
  }, [sent, t]);

  const handleSubmit = async () => {
    if (loading) return;
    setError('');
    const problem = emailProblem(email);
    flagField(problem);
    if (problem) return;

    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: unknown) {
      // Enumeration safety is the server's job: it answers 200 with the same
      // body whether or not the address exists, so a request that RESOLVED is
      // the only thing that may show "sent". A failed request must never say
      // a link went out when it did not.
      const failure = err as ApiFailure;
      const rateLimited = failure?.response?.status === 429
        || (!failure?.response && typeof failure?.retryAfter === 'number');
      if (rateLimited) {
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

  if (sent) {
    return (
      <Screen
        edges={['top']}
        scroll
        contentContainerStyle={styles.successContainer}
        testID="ForgotPasswordScreen-success"
      >
        <View style={styles.successIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="mail-outline" size={30} color={c.primary} />
        </View>
        {/* A 200 is the same whether or not the address has an account, so the
            title says "check", and the body is the hedged half of the same fact. */}
        <Text variant="title3" color="textPrimary" style={styles.successTitle} accessibilityRole="header" accessibilityLiveRegion="polite">{t('auth.forgotPassword.sentTitle', 'Check your email')}</Text>
        <Text variant="callout" color="textSecondary" style={styles.successSubtitle}>
          {t('auth.forgotPassword.sentBody', {
            defaultValue: 'If an account exists for {{email}}, a reset link is on its way. Check your inbox.',
            email: email.trim(),
          })}
        </Text>
        <Button
          title={t('auth.backToSignIn', 'Back to sign in')}
          onPress={() => navigation.navigate('Login')}
          haptic={false}
          testID="ForgotPasswordScreen-backToLogin"
          style={styles.successBtn}
        />
        {/* A mistyped address would otherwise strand the member here with no way to retry. */}
        <PressableScale
          onPress={() => setSent(false)}
          style={[styles.textLink, { minHeight: hit }]}
          accessibilityRole="button"
          accessibilityLabel={t('auth.forgotPassword.differentEmail', 'Use a different email')}
          testID="ForgotPasswordScreen-tryAgain"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="subhead" color="primary">{t('auth.forgotPassword.differentEmail', 'Use a different email')}</Text>
        </PressableScale>
      </Screen>
    );
  }

  return (
    <Screen
      edges={['top']}
      keyboard
      scroll
      contentContainerStyle={styles.content}
      testID="ForgotPasswordScreen"
    >
      {/* Back */}
      {navigation.canGoBack() && (
        <PressableScale
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { width: hit, height: hit }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          testID="ForgotPasswordScreen-back"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </PressableScale>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="key-outline" size={28} color={c.primary} />
        </View>
        <Text variant="title1" color="textPrimary" style={styles.title} accessibilityRole="header">{t('auth.forgotPassword.heading', 'Forgot password')}</Text>
        <Text variant="callout" color="textSecondary">{t('auth.forgotPassword.subtitle')}</Text>
      </View>

      {/* Error */}
      {error ? (
        <View style={styles.errorBanner} testID="ForgotPasswordScreen-error" accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={c.error} style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no" />
          <Text variant="subhead" color="error" style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Email input */}
      <Input
        label={t('auth.forgotPassword.email')}
        value={email}
        onChangeText={(v) => { setEmail(v); setFieldError(''); setError(''); }}
        onBlur={() => { if (email.trim()) flagField(emailProblem(email)); }}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
        autoFocus
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        accessibilityLabel={t('auth.forgotPassword.email')}
        error={fieldError || undefined}
        style={fieldHeight}
        testID="ForgotPasswordScreen-email"
      />

      {/* Submit */}
      <Button
        title={t('auth.forgotPassword.sendLinkAction', 'Send reset link')}
        onPress={handleSubmit}
        loading={loading}
        testID="ForgotPasswordScreen-submit"
        loaderTestID="ForgotPasswordScreen-loader"
      />
    </Screen>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  content: { padding: spacing['2xl'] },
  // Square target, same as the rest of the funnel; width/height come from tapSize(elder) at the call site.
  backBtn: { alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm, marginBottom: spacing.md, alignSelf: 'flex-start' },
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
  // Success state: flexGrow so it centres when it fits and scrolls when OS text is large.
  successContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  successTitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  successSubtitle: {
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  successBtn: { alignSelf: 'stretch' },
  textLink: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, marginTop: spacing.sm },
});
