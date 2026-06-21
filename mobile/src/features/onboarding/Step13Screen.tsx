import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  NativeSyntheticEvent, TextInputKeyPressEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { useOnboarding } from './OnboardingContext';
import { verifyOtp } from '../../api/auth';
import { apiClient } from '../../api/client';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

type Phase = 'phone' | 'otp';

function sendPhoneOtp(phone: string): Promise<void> {
  return apiClient.post('/auth/send-otp', { phone }).then(() => {});
}

export default function Step13Screen() {
  const { t } = useTranslation();
  const { saveAndNext, goBack } = useOnboarding();

  const [phase, setPhase] = useState<Phase>('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [sendLoading, setSendLoading] = useState(false);

  // OTP phase
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));

  useEffect(() => {
    if (phase !== 'otp') return;
    if (cooldown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown, phase]);

  useEffect(() => {
    const otp = digits.join('');
    if (otp.length === OTP_LENGTH) handleVerify(otp);
  }, [digits]);

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 10) {
      setPhoneError(t('onboarding.step13.phoneError'));
      return;
    }
    setSendLoading(true);
    try {
      await sendPhoneOtp(`+91${cleaned}`);
      setPhase('otp');
      setCooldown(RESEND_COOLDOWN);
      setCanResend(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    } catch {
      setPhoneError(t('onboarding.step13.sendError'));
    } finally {
      setSendLoading(false);
    }
  };

  const handleDigitChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setOtpError('');
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
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
    if (verifyLoading) return;
    setOtpError('');
    setVerifyLoading(true);
    try {
      const cleaned = phone.replace(/\s/g, '');
      await verifyOtp(`+91${cleaned}`, otp);
      // Advance in onboarding — phone verified
      await saveAndNext({ phoneVerified: true }, {} as any);
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr?.response?.status === 400) {
        setOtpError(t('onboarding.step13.invalidOtp'));
      } else if (anyErr?.response?.status === 429) {
        setOtpError(t('onboarding.step13.tooManyAttempts'));
      } else {
        setOtpError(t('common.error'));
      }
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setCooldown(RESEND_COOLDOWN);
    setDigits(Array(OTP_LENGTH).fill(''));
    setOtpError('');
    try {
      const cleaned = phone.replace(/\s/g, '');
      await sendPhoneOtp(`+91${cleaned}`);
    } catch { /* silent */ }
    inputRefs.current[0]?.focus();
  };

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  const maskedPhone = phone.length >= 4
    ? '•'.repeat(Math.max(0, phone.length - 4)) + phone.slice(-4)
    : phone;

  return (
    <SafeAreaView style={styles.safe} testID="OnboardingStep13">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={phase === 'otp' ? () => setPhase('phone') : goBack}
          style={styles.backBtn}
          testID="btn-back"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.stepLabel}>{t('onboarding.progress', { current: 13, total: 14 })}</Text>
        <TouchableOpacity onPress={handleSkip} testID="btn-skip" accessibilityLabel={t('common.skip')}>
          <Text style={styles.skipText}>{t('common.skip')}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(13 / 14) * 100}%` as any }]} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          {phase === 'phone' ? (
            <>
              <Text style={styles.title}>{t('onboarding.step13.title')}</Text>
              <Text style={styles.subtitle}>{t('onboarding.step13.subtitle')}</Text>

              <View style={styles.phoneInputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={[styles.phoneInput, phoneError ? styles.phoneInputError : null]}
                  value={phone}
                  onChangeText={(v) => { setPhone(v.replace(/[^0-9 ]/g, '')); setPhoneError(''); }}
                  placeholder="98765 43210"
                  placeholderTextColor={colours.textMuted}
                  keyboardType="phone-pad"
                  maxLength={11}
                  autoFocus
                  testID="input-phone"
                  accessibilityLabel={t('onboarding.step13.phoneLabel')}
                />
              </View>

              {phoneError ? (
                <Text style={styles.fieldError} accessibilityLiveRegion="polite">{phoneError}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryBtn, (sendLoading || phone.replace(/\s/g, '').length < 10) && styles.btnDisabled]}
                onPress={handleSendOtp}
                disabled={sendLoading || phone.replace(/\s/g, '').length < 10}
                testID="btn-sendOtp"
                accessibilityLabel={t('onboarding.step13.sendOtp')}
              >
                {sendLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('onboarding.step13.sendOtp')}</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('onboarding.step13.otpTitle')}</Text>
              <Text style={styles.subtitle}>
                {t('onboarding.step13.otpSubtitle', { phone: maskedPhone })}
              </Text>

              {otpError ? (
                <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                  <Text style={styles.errorText}>{otpError}</Text>
                </View>
              ) : null}

              <View style={styles.otpRow}>
                {digits.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    style={[
                      styles.digitBox,
                      digit ? styles.digitBoxFilled : undefined,
                      otpError ? styles.digitBoxError : undefined,
                    ]}
                    value={digit}
                    onChangeText={(v) => handleDigitChange(i, v)}
                    onKeyPress={(e) => handleKeyPress(i, e)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                    accessibilityLabel={`OTP digit ${i + 1}`}
                    testID={`digit-${i}`}
                  />
                ))}
              </View>

              {verifyLoading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colours.primary} />
                  <Text style={styles.loadingText}>{t('onboarding.step13.verifying')}</Text>
                </View>
              )}

              <View style={styles.resendRow}>
                <Text style={styles.resendText}>{t('onboarding.step13.noCode')}</Text>
                {canResend ? (
                  <TouchableOpacity onPress={handleResend} testID="btn-resend">
                    <Text style={styles.resendLink}> {t('onboarding.step13.resend')}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.resendCountdown}> {t('onboarding.step13.resendIn', { seconds: cooldown })}</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, (verifyLoading || digits.join('').length < OTP_LENGTH) && styles.btnDisabled]}
                onPress={() => handleVerify(digits.join(''))}
                disabled={verifyLoading || digits.join('').length < OTP_LENGTH}
                testID="btn-verify"
                accessibilityLabel={t('onboarding.step13.verify')}
              >
                {verifyLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('onboarding.step13.verify')}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepLabel: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  skipText: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colours.border,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colours.primary,
    borderRadius: borderRadius.full,
  },
  body: { flex: 1, padding: spacing.lg, paddingTop: spacing['2xl'] },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colours.textSecondary,
    marginBottom: spacing['2xl'],
    lineHeight: typography.fontSize.base * 1.5,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  countryCode: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colours.surfaceCard,
    borderRightWidth: 1,
    borderRightColor: colours.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    fontFamily: typography.fontFamily.medium,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    minHeight: 48,
  },
  phoneInputError: { borderColor: colours.error },
  fieldError: {
    fontSize: typography.fontSize.sm,
    color: colours.error,
    marginBottom: spacing.lg,
    fontFamily: typography.fontFamily.regular,
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
  otpRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing['2xl'] },
  digitBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: colours.border,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    backgroundColor: '#FAFAFA',
  },
  digitBoxFilled: { borderColor: colours.primary, backgroundColor: colours.primaryLight },
  digitBoxError: { borderColor: colours.error, backgroundColor: colours.errorBg },
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
  resendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['3xl'] },
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
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
  },
});
