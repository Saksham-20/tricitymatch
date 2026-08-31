/**
 * D6 door, screen 1 of 2 — replaces the old email-only Signup + mid-funnel
 * Step13 OTP. One smart contact box (email OR mobile), password, terms, and
 * inline OTP verification. The ACCOUNT IS NOT CREATED HERE: verified identity
 * + password carry forward to BasicsScreen, which registers in one call so
 * the server derives onboardingComplete=true and the app lands on Main.
 */
import React, { useState } from 'react';
import { PressableScale } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { sendOtp, verifyOtp } from '../../api/auth';
import SmartContactInput, { parseContact } from '../../components/forms/SmartContactInput';
import OtpInput from '../../components/forms/OtpInput';
import { PasswordStrength } from '../../components/ui';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { passwordProblem } from '../../utils/passwordRule';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

export default function CreateAccountScreen() {
  const { c } = useTheme();
  const st = React.useMemo(() => makeSt(c), [c]);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // idle → sending → sent (boxes shown) → verifying → verified
  const [otpPhase, setOtpPhase] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'verified'>('idle');
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [error, setError] = useState('');

  const parsed = parseContact(contact);
  const formValid = Boolean(parsed.value) && !passwordProblem(password) && termsAccepted;

  const handleSendOtp = async () => {
    setError('');
    if (!formValid || !parsed.value || !parsed.kind) {
      if (!parsed.value) setError('Enter a valid email or 10-digit mobile number');
      else if (passwordProblem(password)) setError(passwordProblem(password) as string);
      else setError('Please accept the Terms & Privacy Policy');
      return;
    }
    setOtpPhase('sending');
    try {
      await sendOtp(parsed.value, parsed.kind);
      setOtpPhase('sent');
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      setOtpPhase('idle');
      if (anyErr?.response?.status === 409) {
        setError('An account already exists with this contact — log in instead.');
      } else {
        setError(anyErr?.response?.data?.error?.message ?? 'Could not send the code. Try again.');
      }
    }
  };

  const handleVerify = async (code: string) => {
    if (!parsed.value || !parsed.kind) return;
    setOtpPhase('verifying');
    setError('');
    try {
      await verifyOtp(parsed.value, code, parsed.kind);
      setOtpPhase('verified');
      navigation.navigate('SignupBasics', {
        contactKind: parsed.kind,
        contactValue: parsed.value,
        password,
      });
    } catch {
      setOtpPhase('sent');
      setOtpResetKey((k) => k + 1);
      setError('That code didn’t match — try again.');
    }
  };

  const otpActive = otpPhase === 'sent' || otpPhase === 'verifying';

  return (
    <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID="CreateAccountScreen">
      <ScrollView
        style={st.flex}
        contentContainerStyle={[st.content, { paddingTop: insets.top + spacing['2xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.back} accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </TouchableOpacity>

        <Text style={st.title}>{t('auth.signup.title', 'Create your account')}</Text>
        <Text style={st.sub}>{t('auth.signup.doorSub', 'Two steps. About two minutes.')}</Text>

        <View style={st.field}>
          <Text style={st.label}>{t('auth.emailOrPhone', 'Email or mobile number')}</Text>
          <SmartContactInput
            value={contact}
            onChange={(raw) => { setContact(raw); if (otpPhase !== 'idle') setOtpPhase('idle'); }}
            editable={!otpActive}
          />
        </View>

        <View style={st.field}>
          <Text style={st.label}>{t('auth.password', 'Password')}</Text>
          <View style={st.pwWrap}>
            <TextInput
              style={st.pwInput}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.passwordPlaceholder', 'At least 8 characters')}
              placeholderTextColor={c.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!otpActive}
              accessibilityLabel={t('auth.password', 'Password')}
              testID="password-input"
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>
          {password.length > 0 && <PasswordStrength password={password} />}
        </View>

        <TouchableOpacity
          style={st.termsRow}
          onPress={() => setTermsAccepted((v) => !v)}
          disabled={otpActive}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
          testID="terms-checkbox"
        >
          <Ionicons
            name={termsAccepted ? 'checkbox' : 'square-outline'}
            size={22}
            color={termsAccepted ? c.primary : c.textMuted}
          />
          <Text style={st.termsText}>
            {t('auth.signup.agree', 'I agree to the')}{' '}
            <Text style={st.link} onPress={() => navigation.navigate('Terms')} accessibilityRole="link">{t('auth.signup.termsLink', 'Terms & Conditions')}</Text>
            {' '}&amp;{' '}
            <Text style={st.link} onPress={() => navigation.navigate('Privacy')} accessibilityRole="link">{t('auth.signup.privacyLink', 'Privacy Policy')}</Text>
          </Text>
        </TouchableOpacity>

        {error ? <Text style={st.error} accessibilityLiveRegion="polite">{error}</Text> : null}

        {otpPhase === 'idle' || otpPhase === 'sending' ? (
          <PressableScale haptic
            style={[st.cta, (!formValid || otpPhase === 'sending') && st.ctaDisabled]}
            onPress={handleSendOtp}
            disabled={otpPhase === 'sending'}
            testID="send-otp-btn"
            accessibilityRole="button"
            accessibilityLabel="Send verification code"
          >
            {otpPhase === 'sending'
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={st.ctaText}>{t('auth.signup.sendCode', 'Send verification code')}</Text>}
          </PressableScale>
        ) : (
          <View style={st.otpBlock}>
            <Text style={st.otpTitle}>
              {t('auth.signup.enterCode', 'Enter the 4-digit code sent to')} {parsed.kind === 'phone' ? `+91 ${parsed.value}` : parsed.value}
            </Text>
            <OtpInput onComplete={handleVerify} disabled={otpPhase === 'verifying'} resetKey={otpResetKey} />
            {otpPhase === 'verifying' && <ActivityIndicator size="small" color={c.primary} style={{ marginTop: spacing.sm }} />}
            <TouchableOpacity onPress={handleSendOtp} style={{ marginTop: spacing.md }} accessibilityLabel="Resend code">
              <Text style={st.link}>{t('auth.signup.resend', 'Resend code')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={st.footerRow}>
          <Text style={st.footerText}>{t('auth.signup.haveAccount', 'Already have an account?')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={st.link}> {t('auth.login.signIn', 'Sign in')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeSt = (c: ThemeColours) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing['3xl'] },
  back: { marginBottom: spacing.md, alignSelf: 'flex-start' },
  title: { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold, color: c.textPrimary },
  sub: { fontSize: typography.fontSize.sm, color: c.textMuted, marginTop: 4, marginBottom: spacing.xl },
  field: { marginBottom: spacing.lg },
  label: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: c.textSecondary, marginBottom: spacing.xs },
  pwWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.md,
    backgroundColor: c.surfaceCard, paddingHorizontal: spacing.md,
  },
  pwInput: { flex: 1, minHeight: 50, fontSize: typography.fontSize.base, color: c.textPrimary },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  termsText: { flex: 1, fontSize: typography.fontSize.sm, color: c.textSecondary },
  link: { color: c.primary, fontFamily: typography.fontFamily.semiBold },
  error: { color: c.error, fontSize: typography.fontSize.sm, marginBottom: spacing.md },
  cta: {
    backgroundColor: c.primary, borderRadius: borderRadius.pill,
    minHeight: 52, alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.base },
  otpBlock: { alignItems: 'center', paddingVertical: spacing.md },
  otpTitle: { fontSize: typography.fontSize.sm, color: c.textSecondary, marginBottom: spacing.md, textAlign: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: c.textMuted, fontSize: typography.fontSize.sm },
});
