import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { verifyOtp } from '../../api/auth';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'OTP'>;
type RouteProps = RouteProp<AuthStackParamList, 'OTP'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OTPScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation();

  const { phone } = route.params;

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Auto-submit when all digits filled
  useEffect(() => {
    const otp = digits.join('');
    if (otp.length === OTP_LENGTH) {
      handleVerify(otp);
    }
  }, [digits]);

  const handleDigitChange = useCallback((index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits]);

  const handleKeyPress = useCallback((index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  const handleVerify = async (otp: string) => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await verifyOtp(phone, otp);
      // Success — OTPScreen is used from onboarding (Step 13)
      // Navigate back to onboarding flow or up to parent navigator
      navigation.goBack();
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = anyErr?.response?.status;
      if (status === 400) {
        setError('Invalid OTP. Please try again.');
      } else if (status === 429) {
        setError('Too many attempts. Please wait before trying again.');
      } else {
        setError(t('common.error'));
      }
      // Clear digits on error
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setCooldown(RESEND_COOLDOWN);
    setDigits(Array(OTP_LENGTH).fill(''));
    setError('');
    // Re-request OTP (uses same verify-otp endpoint with empty otp to trigger resend)
    // In this backend, POST /auth/verify-otp with just phone triggers sending
    try {
      await verifyOtp(phone, '');
    } catch {
      // Ignore errors on resend — OTP sent silently
    }
    inputRefs.current[0]?.focus();
  };

  const maskedPhone = phone.length > 4
    ? phone.slice(0, -4).replace(/./g, '•') + phone.slice(-4)
    : phone;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="OTPScreen"
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="phone-portrait-outline" size={30} color={colours.primary} />
          </View>
          <Text style={styles.title}>Verify Your Number</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to {maskedPhone}
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBanner} testID="OTPScreen-error" accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* OTP digit boxes */}
        <View style={styles.otpRow} testID="OTPScreen-inputs">
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              style={[
                styles.digitBox,
                digit ? styles.digitBoxFilled : undefined,
                error ? styles.digitBoxError : undefined,
              ]}
              value={digit}
              onChangeText={(v) => handleDigitChange(i, v)}
              onKeyPress={(e) => handleKeyPress(i, e)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
              accessible
              accessibilityLabel={`OTP digit ${i + 1}`}
              testID={`OTPScreen-digit-${i}`}
            />
          ))}
        </View>

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingRow} testID="OTPScreen-loader">
            <ActivityIndicator color={colours.primary} />
            <Text style={styles.loadingText}>Verifying...</Text>
          </View>
        )}

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Didn't receive a code?</Text>
          {canResend ? (
            <TouchableOpacity
              onPress={handleResend}
              accessibilityLabel="Resend OTP"
              testID="OTPScreen-resend"
            >
              <Text style={styles.resendLink}> Resend</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendCountdown}> Resend in {cooldown}s</Text>
          )}
        </View>

        {/* Manual submit (in case auto-submit doesn't fire) */}
        <TouchableOpacity
          style={[styles.primaryBtn, (loading || digits.join('').length < OTP_LENGTH) && styles.btnDisabled]}
          onPress={() => handleVerify(digits.join(''))}
          disabled={loading || digits.join('').length < OTP_LENGTH}
          accessibilityLabel="Verify OTP"
          testID="OTPScreen-submit"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Verify</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colours.background },
  content: {
    flex: 1,
    padding: spacing['2xl'],
    paddingTop: 80,
    alignItems: 'center',
  },
  header: { alignItems: 'center', marginBottom: spacing['3xl'] },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colours.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * 1.5,
  },
  errorBanner: {
    backgroundColor: colours.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colours.error,
    alignSelf: 'stretch',
  },
  errorText: { fontSize: typography.fontSize.sm, color: colours.error, fontFamily: typography.fontFamily.medium },
  otpRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  digitBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: colours.border,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    backgroundColor: colours.background,
  },
  digitBoxFilled: {
    borderColor: colours.primary,
    backgroundColor: colours.primaryLight,
  },
  digitBoxError: {
    borderColor: colours.error,
    backgroundColor: colours.errorBg,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.regular,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  resendText: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.regular,
  },
  resendLink: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontFamily: typography.fontFamily.semiBold,
  },
  resendCountdown: {
    fontSize: typography.fontSize.sm,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.regular,
  },
  primaryBtn: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
});
