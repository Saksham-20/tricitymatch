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
  View, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { sendOtp, verifyOtp } from '../../api/auth';
import SmartContactInput, { parseContact } from '../../components/forms/SmartContactInput';
import OtpInput from '../../components/forms/OtpInput';
import { PasswordStrength } from '../../components/ui';
import Input from '../../components/ui/Input';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { passwordProblem } from '../../utils/passwordRule';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

export default function CreateAccountScreen() {
  const { c } = useTheme();
  const st = React.useMemo(() => makeSt(c), [c]);
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();

  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
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
    <Screen
      edges={['top']}
      keyboard
      scroll
      contentContainerStyle={[st.content, { paddingTop: spacing['2xl'] }]}
      testID="CreateAccountScreen"
    >
      <PressableScale
        onPress={() => navigation.goBack()}
        style={st.back}
        accessibilityRole="button"
        accessibilityLabel={t('common.back', 'Back')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
      </PressableScale>

      <Text variant="title2" color="textPrimary">{t('auth.signup.title', 'Create your account')}</Text>
      <Text variant="footnote" color="textMuted" style={st.sub}>{t('auth.signup.doorSub', 'Two steps. About two minutes.')}</Text>

      <View style={st.field}>
        <Text variant="subhead" color="textSecondary" style={st.label}>{t('auth.emailOrPhone', 'Email or mobile number')}</Text>
        <SmartContactInput
          value={contact}
          onChange={(raw) => { setContact(raw); if (otpPhase !== 'idle') setOtpPhase('idle'); }}
          editable={!otpActive}
        />
      </View>

      <View style={st.field}>
        <Input
          label={t('auth.password', 'Password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder', 'At least 8 characters')}
          secureTextEntry
          secureToggle
          autoCapitalize="none"
          editable={!otpActive}
          accessibilityLabel={t('auth.password', 'Password')}
          testID="password-input"
        />
        {password.length > 0 && <PasswordStrength password={password} />}
      </View>

      <PressableScale
        style={st.termsRow}
        onPress={() => setTermsAccepted((v) => !v)}
        disabled={otpActive}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: termsAccepted, disabled: otpActive }}
        testID="terms-checkbox"
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={termsAccepted ? 'checkbox' : 'square-outline'}
          size={22}
          color={termsAccepted ? c.primary : c.textMuted}
        />
        <Text variant="footnote" color="textSecondary" style={st.termsText}>
          {t('auth.signup.agree', 'I agree to the')}{' '}
          <Text variant="caption" color="primary" onPress={() => navigation.navigate('Terms')} accessibilityRole="link">{t('auth.signup.termsLink', 'Terms & Conditions')}</Text>
          {' '}&amp;{' '}
          <Text variant="caption" color="primary" onPress={() => navigation.navigate('Privacy')} accessibilityRole="link">{t('auth.signup.privacyLink', 'Privacy Policy')}</Text>
        </Text>
      </PressableScale>

      {error ? <Text variant="footnote" color="error" style={st.error} accessibilityLiveRegion="polite">{error}</Text> : null}

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
            : <Text variant="headline" style={{ color: '#fff' }}>{t('auth.signup.sendCode', 'Send verification code')}</Text>}
        </PressableScale>
      ) : (
        <View style={st.otpBlock}>
          <Text variant="footnote" color="textSecondary" style={st.otpTitle}>
            {t('auth.signup.enterCode', 'Enter the 4-digit code sent to')} {parsed.kind === 'phone' ? `+91 ${parsed.value}` : parsed.value}
          </Text>
          <OtpInput onComplete={handleVerify} disabled={otpPhase === 'verifying'} resetKey={otpResetKey} />
          {otpPhase === 'verifying' && <ActivityIndicator size="small" color={c.primary} style={{ marginTop: spacing.sm }} />}
          <PressableScale
            onPress={handleSendOtp}
            style={{ marginTop: spacing.md }}
            accessibilityRole="link"
            accessibilityLabel="Resend code"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="caption" color="primary">{t('auth.signup.resend', 'Resend code')}</Text>
          </PressableScale>
        </View>
      )}

      <View style={st.footerRow}>
        <Text variant="footnote" color="textMuted">{t('auth.signup.haveAccount', 'Already have an account?')}</Text>
        <PressableScale
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="link"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="caption" color="primary"> {t('auth.login.signIn', 'Sign in')}</Text>
        </PressableScale>
      </View>
    </Screen>
  );
}

const makeSt = (c: ThemeColours) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing['3xl'] },
  back: { marginBottom: spacing.md, alignSelf: 'flex-start' },
  sub: { marginTop: 4, marginBottom: spacing.xl },
  field: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  termsText: { flex: 1 },
  error: { marginBottom: spacing.md },
  cta: {
    backgroundColor: c.primary, borderRadius: borderRadius.pill,
    minHeight: 52, alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  otpBlock: { alignItems: 'center', paddingVertical: spacing.md },
  otpTitle: { marginBottom: spacing.md, textAlign: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
});
