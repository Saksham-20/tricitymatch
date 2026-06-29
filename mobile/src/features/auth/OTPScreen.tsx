import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { verifyOtp, sendOtp } from '../../api/auth';
import { colours, type, spacing, borderRadius } from '@shared/constants/theme';
import { OtpInput, Button } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'OTP'>;
type RouteProps = RouteProp<AuthStackParamList, 'OTP'>;

const OTP_LENGTH = 4;
const RESEND_COOLDOWN = 60;

export default function OTPScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation();
  const { c } = useTheme();

  const { phone } = route.params;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setCooldown((x) => x - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async (otp: string) => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await verifyOtp(phone, otp);
      haptics.success();
      navigation.goBack();
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } };
      const status = anyErr?.response?.status;
      if (status === 400) setError('Invalid OTP. Please try again.');
      else if (status === 429) setError('Too many attempts. Please wait before trying again.');
      else setError(t('common.error'));
      haptics.warning();
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setCooldown(RESEND_COOLDOWN);
    setCode('');
    setError('');
    try { await sendOtp(phone); } catch { /* sent silently */ }
  };

  const maskedPhone = phone.length > 4
    ? phone.slice(0, -4).replace(/./g, '•') + phone.slice(-4)
    : phone;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="OTPScreen"
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colours.accentSoft }]}>
            <Ionicons name="phone-portrait-outline" size={30} color={colours.accent} />
          </View>
          <Text style={[styles.title, { color: c.fgStrong }]}>Verify your number</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            We sent a 4-digit code to {maskedPhone}
          </Text>
        </View>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colours.errorBg }]} testID="OTPScreen-error" accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.otpWrap} testID="OTPScreen-inputs">
          <OtpInput
            value={code}
            onChange={(v) => { setCode(v); setError(''); }}
            length={OTP_LENGTH}
            onComplete={handleVerify}
            testID="OTPScreen-digit"
          />
        </View>

        <View style={styles.resendRow}>
          <Text style={[styles.resendText, { color: c.textMuted }]}>Didn&apos;t receive a code?</Text>
          {canResend ? (
            <Text style={styles.resendLink} onPress={handleResend} testID="OTPScreen-resend"> Resend</Text>
          ) : (
            <Text style={[styles.resendCountdown, { color: c.textMuted }]}> Resend in {cooldown}s</Text>
          )}
        </View>

        <Button
          title="Verify"
          onPress={() => handleVerify(code)}
          loading={loading}
          disabled={code.length < OTP_LENGTH}
          style={styles.submit}
          testID="OTPScreen-submit"
          loaderTestID="OTPScreen-loader"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, padding: spacing['2xl'], paddingTop: 80, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: spacing['3xl'] },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  title: { ...type.title1, fontFamily: 'PlayfairDisplay-Bold', textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...type.body, textAlign: 'center' },
  errorBanner: {
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg,
    borderLeftWidth: 3, borderLeftColor: colours.error, alignSelf: 'stretch',
  },
  errorText: { ...type.subhead, color: colours.error, fontFamily: 'Inter-Medium' },
  otpWrap: { marginBottom: spacing['2xl'], alignSelf: 'stretch' },
  resendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['3xl'] },
  resendText: { ...type.subhead },
  resendLink: { ...type.subhead, color: colours.accent, fontFamily: 'Inter-SemiBold' },
  resendCountdown: { ...type.subhead },
  submit: { alignSelf: 'stretch' },
});
