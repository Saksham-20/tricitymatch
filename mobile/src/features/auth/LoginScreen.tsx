import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '../../utils/toast';
import Animated from 'react-native-reanimated';
import * as LocalAuthentication from 'expo-local-authentication';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { login, refreshAccessToken } from '../../api/auth';
import { CONFIG } from '../../constants/config';
import { cache, CACHE_KEYS } from '../../utils/cache';
import { secureStorage } from '../../utils/secureStorage';
import { useShake, PressableScale } from '../../components/motion';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setUser, setAccessToken } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [bioAttempts, setBioAttempts] = useState(0);
  const BIO_MAX_ATTEMPTS = 3;

  const passwordRef = useRef<TextInput>(null);
  const { style: shakeStyle, shake } = useShake();

  // Check biometric capability on mount, auto-prompt if enabled
  useEffect(() => {
    (async () => {
      try {
        const available = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const capable = available && enrolled;
        setBiometricAvailable(capable);
        const enabled = cache.getBoolean(CACHE_KEYS.BIOMETRIC_ENABLED) ?? false;
        setBiometricEnabled(enabled);
        if (capable && enabled) {
          handleBiometric();
        }
      } catch {
        // biometric not available
      }
    })();
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((s) => {
        if (s <= 1) {
          setLockoutMinutes(null);
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleBiometric = async () => {
    if (bioAttempts >= BIO_MAX_ATTEMPTS) {
      showToast.error('Too many attempts', 'Biometric login locked. Use email and password.');
      return;
    }
    try {
      const available = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!available || !enrolled) return;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to TricityMatch',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setBioAttempts(0);
        setLoading(true);
        try {
          // Use stored refresh token to get a fresh access token
          const refreshed = await refreshAccessToken();
          if (refreshed.accessToken && refreshed.user) {
            setAccessToken(refreshed.accessToken);
            setUser(refreshed.user);
          } else {
            showToast.info('Session expired', 'Please sign in with your email and password.');
          }
        } catch {
          showToast.error('Sign in failed', 'Please sign in with your email and password.');
        } finally {
          setLoading(false);
        }
      } else {
        setBioAttempts((n) => n + 1);
        if (bioAttempts + 1 >= BIO_MAX_ATTEMPTS) {
          cache.setBoolean(CACHE_KEYS.BIOMETRIC_ENABLED, false);
          setBiometricEnabled(false);
          showToast.error('Biometric locked', 'Too many failed attempts. Use email and password.');
        }
      }
    } catch {
      // silently skip
    }
  };

  const handleEnableBiometric = () => {
    cache.setBoolean(CACHE_KEYS.BIOMETRIC_ENABLED, true);
    setBiometricEnabled(true);
    setShowBiometricSetup(false);
  };

  const handleSkipBiometric = () => {
    cache.setBoolean(CACHE_KEYS.BIOMETRIC_ENABLED, false);
    setShowBiometricSetup(false);
  };

  const validate = (): boolean => {
    if (!email.trim()) {
      setError(t('auth.login.email') + ' is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!password) {
      setError(t('auth.login.password') + ' is required');
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    setError('');
    if (!validate()) return;
    if (lockoutMinutes !== null) return;

    setLoading(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      setAccessToken(result.accessToken);
      setUser(result.user);
      // Offer biometric setup after first successful email/password login
      if (biometricAvailable && !biometricEnabled) {
        setShowBiometricSetup(true);
      }
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number; data?: { message?: string; retryAfter?: number } } };
      const status = anyErr?.response?.status;
      const data = anyErr?.response?.data;

      if (status === 429) {
        const mins = data?.retryAfter ? Math.ceil(data.retryAfter / 60) : 30;
        setLockoutMinutes(mins);
        setLockoutSeconds(mins * 60);
        setError(t('auth.login.lockoutMessage', { minutes: mins }));
      } else if (status === 401) {
        setError(t('auth.login.invalidCredentials'));
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
  const handleGoogleSignIn = () => {
    Alert.alert(
      t('auth.login.googleSignIn'),
      'Google sign-in is not available in this build. Please continue with your email or phone number.',
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="LoginScreen"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing['2xl'] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {navigation.canGoBack() && (
          <PressableScale
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="login-back"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
          </PressableScale>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text variant="title1" color="textPrimary">{t('auth.login.title')}</Text>
          <Text variant="callout" color="textSecondary" style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
        </View>

        {/* Error banner — handoff lockout state shows a warning panel, no countdown */}
        {error ? (
          <Animated.View style={[styles.errorBanner, shakeStyle]} testID="LoginScreen-error" accessibilityLiveRegion="polite">
            <Text variant="subhead" color="error">{error}</Text>
          </Animated.View>
        ) : null}

        {/* Email input */}
        <Input
          label={t('auth.login.email')}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          accessibilityLabel={t('auth.login.email')}
          testID="LoginScreen-email"
        />

        {/* Password input */}
        <View style={styles.labelRow}>
          <Text variant="subhead" color="textPrimary" style={styles.label}>{t('auth.login.password')}</Text>
          <PressableScale
            onPress={() => navigation.navigate('ForgotPassword')}
            testID="LoginScreen-forgotPassword"
            accessibilityRole="link"
            accessibilityLabel={t('auth.login.forgotPassword')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="subhead" color="primary">{t('auth.login.forgotPassword')}</Text>
          </PressableScale>
        </View>
        <Input
          ref={passwordRef}
          value={password}
          onChangeText={(v) => { setPassword(v); setError(''); }}
          placeholder="••••••••"
          secureToggle
          secureTextEntry
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          accessibilityLabel={t('auth.login.password')}
          testID="LoginScreen-password"
          toggleTestID="LoginScreen-togglePassword"
        />

        {/* Sign In button */}
        <PressableScale
          style={[styles.primaryBtn, (loading || lockoutMinutes !== null) && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading || lockoutMinutes !== null}
          accessibilityRole="button"
          accessibilityLabel={t('auth.login.signIn')}
          accessibilityState={{ disabled: loading || lockoutMinutes !== null }}
          testID="LoginScreen-submit"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" testID="LoginScreen-loader" />
          ) : (
            <Text variant="headline" style={{ color: '#FFFFFF' }}>{t('auth.login.signIn')}</Text>
          )}
        </PressableScale>

        {/* Google Sign-In — HIDDEN on iOS. Apple Guideline 4.8 requires "Sign in
            with Apple" alongside any third-party social login. Until that's added,
            iOS uses email/password only (avoids guaranteed App Review rejection). */}
        {Platform.OS !== 'ios' && CONFIG.IS_GOOGLE_CONFIGURED && (
          <>
            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text variant="footnote" color="textMuted">{t('common.or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <PressableScale
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              accessibilityRole="button"
              accessibilityLabel={t('auth.login.googleSignIn')}
              testID="LoginScreen-google"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.btnRow}>
                <Ionicons name="logo-google" size={18} color={c.textPrimary} />
                <Text variant="subhead" color="textPrimary">{t('auth.login.googleSignIn')}</Text>
              </View>
            </PressableScale>
          </>
        )}

        {/* Biometric — only shown when hardware available */}
        {biometricAvailable && (
          <PressableScale
            style={styles.biometricBtn}
            onPress={handleBiometric}
            disabled={bioAttempts >= BIO_MAX_ATTEMPTS}
            accessibilityRole="button"
            accessibilityLabel="Sign in with biometrics"
            accessibilityState={{ disabled: bioAttempts >= BIO_MAX_ATTEMPTS }}
            testID="LoginScreen-biometric"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.btnRow}>
              <Ionicons name="finger-print" size={18} color={bioAttempts >= BIO_MAX_ATTEMPTS ? c.textMuted : c.primary} />
              <Text variant="subhead" color={bioAttempts >= BIO_MAX_ATTEMPTS ? 'textMuted' : 'primary'}>
                {biometricEnabled ? 'Sign in with Face ID / Touch ID' : 'Use biometric login'}
              </Text>
            </View>
          </PressableScale>
        )}

        {/* Footer */}
        <PressableScale
          style={styles.footerLink}
          onPress={() => navigation.navigate('Signup')}
          testID="LoginScreen-signup"
          accessibilityRole="link"
          accessibilityLabel={t('auth.login.noAccount')}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="subhead" color="textSecondary">{t('auth.login.noAccount')}</Text>
        </PressableScale>
      </ScrollView>

      {/* Biometric Setup Prompt — shown after first successful login */}
      <Modal
        visible={showBiometricSetup}
        transparent
        animationType="fade"
        onRequestClose={handleSkipBiometric}
        testID="biometric-setup-modal"
      >
        <View style={styles.bioModalBackdrop}>
          <View style={styles.bioModalCard}>
            <View style={styles.bioModalIconWrap}>
              <Ionicons name="finger-print" size={32} color={c.primary} />
            </View>
            <Text variant="title3" color="textPrimary" style={styles.bioModalTitle}>Enable Face ID / Touch ID?</Text>
            <Text variant="subhead" color="textSecondary" style={styles.bioModalBody}>
              Sign in faster next time using biometrics instead of your password.
            </Text>
            <PressableScale
              style={styles.bioModalPrimary}
              onPress={handleEnableBiometric}
              testID="biometric-setup-enable"
              accessibilityRole="button"
              accessibilityLabel="Enable biometric login"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="headline" style={{ color: '#fff' }}>Enable Biometrics</Text>
            </PressableScale>
            <PressableScale
              style={styles.bioModalSecondary}
              onPress={handleSkipBiometric}
              testID="biometric-setup-skip"
              accessibilityRole="button"
              accessibilityLabel="Skip biometric setup"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="subhead" color="textSecondary">Not now</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  scroll: { flex: 1 },
  content: {
    padding: spacing['2xl'],
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm, marginBottom: spacing.md },
  header: { marginBottom: spacing['3xl'] },
  subtitle: {
    marginTop: spacing.xs,
  },
  errorBanner: {
    backgroundColor: c.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: c.error,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing['2xl'],
    gap: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  googleBtn: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  biometricBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  footerLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
  },
  bioModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  bioModalCard: {
    backgroundColor: c.background,
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bioModalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  bioModalTitle: {
    textAlign: 'center',
  },
  bioModalBody: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  bioModalPrimary: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    width: '100%',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  bioModalSecondary: {
    paddingVertical: spacing.sm,
    width: '100%',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});
