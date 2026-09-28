import React, { useState, useEffect, useRef } from 'react';
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
import Screen from '../../components/layout/Screen';
import SmartContactInput, { parseContact } from '../../components/forms/SmartContactInput';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { showToast } from '../../utils/toast';
import Animated from 'react-native-reanimated';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { login } from '../../api/auth';
import { CONFIG } from '../../constants/config';
import { useShake, PressableScale } from '../../components/motion';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { tapSize } from '../../utils/elderTheme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

// There is no biometric sign-in on this screen. It could only ever fail:
// authStore.logout() and a failed initialize() both delete the stored refresh
// token, so a signed-out device has nothing for a Face ID / Touch ID check to
// exchange for a session. (Settings still exposes a switch for it: see the
// unresolved item reported with this change.)

// What login() can reject with. api/client.ts rewrites two failures into bare
// Errors that carry no `response`, so this is the union the screen really sees,
// not just an AxiosError:
//   429 -> Error('Too many requests') with `retryAfter` in seconds (60 when the
//          server sent no Retry-After, which is the case for ACCOUNT_LOCKED).
//   401 -> Error('No refresh token'): client.ts answers every 401 by trying to
//          refresh the session, and a signed-out device has nothing to refresh,
//          so a wrong password never arrives here as a 401 response.
type LoginFailure = {
  response?: { status?: number; data?: { error?: { code?: string; message?: string } } };
  retryAfter?: number;
  message?: string;
};

// How long the button stays down after a 429 that names no wait of its own.
const FALLBACK_LOCK_SECONDS = 60;

export default function LoginScreen() {
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { setUser, setAccessToken } = useAuthStore();
  const hit = tapSize(elder);
  // Input's own floor is 50; elder mode needs its 60pt target. (The Buttons need
  // the same and cannot get it from here: primitive request on Button.)
  const fieldHeight = { minHeight: Math.max(50, hit) };

  // The door accepts an email OR a 10-digit mobile: a member who signed up with
  // a phone number (the first-class path on CreateAccountScreen) has no email to
  // type here, and the server signs in either identifier.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [idError, setIdError] = useState('');
  const [pwError, setPwError] = useState('');
  // Seconds the sign-in button stays down after a 429; null when not locked.
  const [lockedFor, setLockedFor] = useState<number | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const { style: shakeStyle, shake } = useShake();

  // Lockout: one timer for the whole window (not a 1s state tick). When it
  // lifts, the "too many attempts" banner goes with it, so the button is never
  // live under a message that says to wait.
  useEffect(() => {
    if (lockedFor === null) return;
    const id = setTimeout(() => {
      setLockedFor(null);
      setError('');
    }, lockedFor * 1000);
    return () => clearTimeout(id);
  }, [lockedFor]);

  // Android announces the banner through accessibilityLiveRegion; iOS ignores
  // that prop, so speak it explicitly there.
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  // Field problems live under their field; `error` (banner) is only for what
  // the server said. Validated on blur (identifier) and on submit (both).
  const identifierProblem = (raw: string): string => {
    if (!raw.trim()) return t('auth.errors.contactRequired', 'Enter your email or mobile number');
    if (!parseContact(raw).value) return t('auth.errors.contactInvalid', 'Enter a valid email or 10-digit mobile number');
    return '';
  };

  const validate = (): boolean => {
    const idProblem = identifierProblem(identifier);
    const pProblem = password ? '' : t('auth.errors.passwordRequired', 'Enter your password');
    setIdError(idProblem);
    setPwError(pProblem);
    // SmartContactInput speaks its own error; Input's has no live region, so
    // say the password problem here or a screen-reader user hears nothing.
    if (!idProblem && pProblem) AccessibilityInfo.announceForAccessibility(pProblem);
    return !idProblem && !pProblem;
  };

  // While locked, the lockout banner is the only explanation for a dead button,
  // so typing must not wipe it.
  const clearError = () => { if (lockedFor === null) setError(''); };

  const handleLogin = async () => {
    if (lockedFor !== null || loading) return;
    setError('');
    if (!validate()) return;

    const parsed = parseContact(identifier);
    setLoading(true);
    try {
      // parsed.value is a lowercased email or a bare 10-digit mobile, the two
      // forms the server stores. (api login() names its param `email`; the
      // server reads it as the identifier and routes on the presence of '@'.)
      const result = await login(parsed.value as string, password);
      setAccessToken(result.accessToken);
      setUser(result.user);
    } catch (err: unknown) {
      const failure = err as LoginFailure;
      const status = failure?.response?.status;
      const hasResponse = !!failure?.response;
      const rateLimited = status === 429 || (!hasResponse && typeof failure?.retryAfter === 'number');
      const wrongCredentials = status === 401 || (!hasResponse && failure?.message === 'No refresh token');

      if (rateLimited) {
        // No figure in the copy: an account lockout names no duration
        // (LOCKOUT_DURATION_MINUTES is server config), so any number here
        // would be invented. The button only waits out what the server said.
        const wait = failure.retryAfter;
        setLockedFor(typeof wait === 'number' && Number.isFinite(wait) && wait > 0 ? wait : FALLBACK_LOCK_SECONDS);
        setError(t('auth.login.lockedOut', 'Too many sign-in attempts. Wait a little, then try again, or reset your password.'));
      } else if (wrongCredentials) {
        setError(t('auth.login.wrongCredentials', 'Wrong email, mobile number or password.'));
      } else if (status === 403) {
        // The only 403 login answers with: the account is suspended or deactivated.
        setError(t('auth.login.accountInactive', 'This account is not active. Contact support for help.'));
      } else if (!hasResponse && axios.isAxiosError(err)) {
        // A real transport failure: the request never reached the server.
        setError(t('common.networkError'));
      } else {
        setError(t('common.error'));
      }
      // handoff: field-error shake (translateX ±6 ×3) + warning haptic
      shake();
    } finally {
      setLoading(false);
    }
  };

  // Only reachable when CONFIG.IS_GOOGLE_CONFIGURED — the button is not rendered
  // otherwise. The native Google SDK is not installed yet, so this states the
  // real situation instead of naming an environment variable at the user.
  // Informational, not a destructive confirmation: a toast, never an Alert.
  const handleGoogleSignIn = () => {
    showToast.info(
      t('auth.login.googleSignIn'),
      t('auth.login.googleUnavailable', 'Google sign-in is not available in this build. Continue with your email or mobile number.'),
    );
  };

  return (
    <Screen
      edges={['top']}
      keyboard
      scroll
      contentContainerStyle={styles.content}
      testID="LoginScreen"
    >
      {navigation.canGoBack() && (
        <PressableScale
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { width: hit, height: hit }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          testID="login-back"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </PressableScale>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text variant="title1" color="textPrimary" accessibilityRole="header">{t('auth.login.title')}</Text>
        <Text variant="callout" color="textSecondary" style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
      </View>

      {/* Server error banner: lockout, bad credentials, network. The icon is
          the non-colour cue; the shake + warning haptic is the motion cue. */}
      {error ? (
        <Animated.View style={[styles.errorBanner, shakeStyle]} testID="LoginScreen-error" accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={c.error} style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no" />
          <Text variant="subhead" color="error" style={styles.errorText}>{error}</Text>
        </Animated.View>
      ) : null}

      {/* Email or mobile */}
      <SmartContactInput
        label={t('auth.emailOrPhone', 'Email or mobile number')}
        value={identifier}
        onChange={(raw) => { setIdentifier(raw); setIdError(''); clearError(); }}
        onBlur={() => { if (identifier.trim()) setIdError(identifierProblem(identifier)); }}
        error={idError || undefined}
        placeholder="you@example.com"
        autoFocus
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        testID="LoginScreen-email"
      />

      {/* Password input */}
      <Input
        ref={passwordRef}
        label={t('auth.login.password')}
        value={password}
        onChangeText={(v) => { setPassword(v); setPwError(''); clearError(); }}
        secureToggle
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="done"
        onSubmitEditing={handleLogin}
        accessibilityLabel={t('auth.login.password')}
        error={pwError || undefined}
        containerStyle={styles.passwordGroup}
        style={fieldHeight}
        testID="LoginScreen-password"
        toggleTestID="LoginScreen-togglePassword"
      />

      {/* Own row under the field, sized for real: a hitSlop on a 20pt line
          loses its lower half to the field it sits against. */}
      <PressableScale
        onPress={() => navigation.navigate('ForgotPassword')}
        style={[styles.forgotLink, { minHeight: hit }]}
        testID="LoginScreen-forgotPassword"
        accessibilityRole="link"
        accessibilityLabel={t('auth.login.forgotPassword')}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text variant="subhead" color="primary">{t('auth.login.forgotPassword')}</Text>
      </PressableScale>

      {/* Sign In button */}
      <Button
        title={t('auth.login.signInAction', 'Sign in')}
        onPress={handleLogin}
        loading={loading}
        disabled={lockedFor !== null}
        testID="LoginScreen-submit"
        loaderTestID="LoginScreen-loader"
        style={styles.submit}
      />

      {/* Google Sign-In — HIDDEN on iOS. Apple Guideline 4.8 requires "Sign in
          with Apple" alongside any third-party social login. Until that's added,
          iOS uses email/password only (avoids guaranteed App Review rejection). */}
      {Platform.OS !== 'ios' && CONFIG.IS_GOOGLE_CONFIGURED && (
        <>
          {/* Divider */}
          <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.dividerLine} />
            <Text variant="footnote" color="textSecondary">{t('common.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title={t('auth.login.googleSignIn')}
            onPress={handleGoogleSignIn}
            variant="secondary"
            icon="logo-google"
            haptic={false}
            testID="LoginScreen-google"
          />
        </>
      )}

      {/* Footer */}
      <PressableScale
        style={[styles.footerLink, { minHeight: hit }]}
        onPress={() => navigation.navigate('Signup')}
        testID="LoginScreen-signup"
        accessibilityRole="link"
        accessibilityLabel={t('auth.login.noAccount')}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text variant="subhead" color="textSecondary">{t('auth.login.noAccount')}</Text>
      </PressableScale>
    </Screen>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  content: {
    padding: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  // Square target; width/height come from tapSize(elder) at the call site.
  backBtn: { alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm, marginBottom: spacing.md },
  header: { marginBottom: spacing['3xl'] },
  subtitle: {
    marginTop: spacing.xs,
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
  // The forgot link is the next element, so the field's own 15pt group margin is trimmed.
  passwordGroup: { marginBottom: 0 },
  forgotLink: {
    alignSelf: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  submit: { marginTop: spacing.sm },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing['2xl'],
    gap: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  footerLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
  },
});
