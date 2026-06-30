import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import * as LocalAuthentication from 'expo-local-authentication';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { login, refreshAccessToken } from '../../api/auth';
import { cache, CACHE_KEYS } from '../../utils/cache';
import { secureStorage } from '../../utils/secureStorage';
import { useShake } from '../../components/motion';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { setUser, setAccessToken } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      Alert.alert('Too many attempts', 'Biometric login locked. Use email and password.');
      return;
    }
    try {
      const available = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!available || !enrolled) return;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to TricityShadi',
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
            Alert.alert('Session expired', 'Please sign in with your email and password.');
          }
        } catch {
          Alert.alert('Sign in failed', 'Please sign in with your email and password.');
        } finally {
          setLoading(false);
        }
      } else {
        setBioAttempts((n) => n + 1);
        if (bioAttempts + 1 >= BIO_MAX_ATTEMPTS) {
          cache.setBoolean(CACHE_KEYS.BIOMETRIC_ENABLED, false);
          setBiometricEnabled(false);
          Alert.alert('Biometric locked', 'Too many failed attempts. Use email and password.');
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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="LoginScreen"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.login.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
        </View>

        {/* Error banner — handoff lockout state shows a warning panel, no countdown */}
        {error ? (
          <Animated.View style={[styles.errorBanner, shakeStyle]} testID="LoginScreen-error" accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null}

        {/* Email input */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('auth.login.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(''); }}
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
            accessibilityLabel={t('auth.login.email')}
            testID="LoginScreen-email"
          />
        </View>

        {/* Password input */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('auth.login.password')}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              testID="LoginScreen-forgotPassword"
              accessibilityLabel={t('auth.login.forgotPassword')}
            >
              <Text style={styles.forgotLink}>{t('auth.login.forgotPassword')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.passwordContainer}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              placeholder="••••••••"
              placeholderTextColor={colours.textMuted}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              accessibilityLabel={t('auth.login.password')}
              testID="LoginScreen-password"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              testID="LoginScreen-togglePassword"
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colours.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign In button */}
        <TouchableOpacity
          style={[styles.primaryBtn, (loading || lockoutMinutes !== null) && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading || lockoutMinutes !== null}
          accessibilityLabel={t('auth.login.signIn')}
          testID="LoginScreen-submit"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" testID="LoginScreen-loader" />
          ) : (
            <Text style={styles.primaryBtnText}>{t('auth.login.signIn')}</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('common.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Sign-In */}
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={() => Alert.alert('Google Sign-In', 'Configure EXPO_PUBLIC_GOOGLE_CLIENT_ID to enable')}
          accessibilityLabel={t('auth.login.googleSignIn')}
          testID="LoginScreen-google"
        >
          <View style={styles.btnRow}>
            <Ionicons name="logo-google" size={18} color={colours.textPrimary} />
            <Text style={styles.googleBtnText}>{t('auth.login.googleSignIn')}</Text>
          </View>
        </TouchableOpacity>

        {/* Biometric — only shown when hardware available */}
        {biometricAvailable && (
          <TouchableOpacity
            style={styles.biometricBtn}
            onPress={handleBiometric}
            disabled={bioAttempts >= BIO_MAX_ATTEMPTS}
            accessibilityLabel="Sign in with biometrics"
            testID="LoginScreen-biometric"
          >
            <View style={styles.btnRow}>
              <Ionicons name="finger-print" size={18} color={bioAttempts >= BIO_MAX_ATTEMPTS ? colours.textMuted : colours.primary} />
              <Text style={[styles.biometricBtnText, bioAttempts >= BIO_MAX_ATTEMPTS && { color: colours.textMuted }]}>
                {biometricEnabled ? 'Sign in with Face ID / Touch ID' : 'Use biometric login'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Footer */}
        <TouchableOpacity
          style={styles.footerLink}
          onPress={() => navigation.navigate('Signup')}
          testID="LoginScreen-signup"
          accessibilityLabel={t('auth.login.noAccount')}
        >
          <Text style={styles.footerLinkText}>{t('auth.login.noAccount')}</Text>
        </TouchableOpacity>
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
              <Ionicons name="finger-print" size={32} color={colours.primary} />
            </View>
            <Text style={styles.bioModalTitle}>Enable Face ID / Touch ID?</Text>
            <Text style={styles.bioModalBody}>
              Sign in faster next time using biometrics instead of your password.
            </Text>
            <TouchableOpacity
              style={styles.bioModalPrimary}
              onPress={handleEnableBiometric}
              testID="biometric-setup-enable"
              accessibilityLabel="Enable biometric login"
            >
              <Text style={styles.bioModalPrimaryText}>Enable Biometrics</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bioModalSecondary}
              onPress={handleSkipBiometric}
              testID="biometric-setup-skip"
              accessibilityLabel="Skip biometric setup"
            >
              <Text style={styles.bioModalSecondaryText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colours.background },
  scroll: { flex: 1 },
  content: {
    padding: spacing['2xl'],
    paddingTop: 60,
  },
  header: { marginBottom: spacing['3xl'] },
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
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colours.error,
    fontFamily: typography.fontFamily.medium,
  },
  fieldGroup: { marginBottom: spacing.lg },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  forgotLink: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
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
  primaryBtn: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing['2xl'],
    gap: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colours.border },
  dividerText: {
    fontSize: typography.fontSize.sm,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.regular,
  },
  googleBtn: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    backgroundColor: colours.background,
  },
  googleBtnText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  biometricBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  biometricBtnText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colours.primary,
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
  bioModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  bioModalCard: {
    backgroundColor: colours.background,
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
    backgroundColor: colours.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  bioModalTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    textAlign: 'center',
  },
  bioModalBody: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  bioModalPrimary: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    width: '100%',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  bioModalPrimaryText: {
    color: '#fff',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.base,
  },
  bioModalSecondary: {
    paddingVertical: spacing.sm,
    width: '100%',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  bioModalSecondaryText: {
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
  },
});
