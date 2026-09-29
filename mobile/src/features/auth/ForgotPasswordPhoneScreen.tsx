import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet, AccessibilityInfo, Platform } from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Screen from '../../components/layout/Screen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { forgotPasswordPhone, resetPasswordPhone } from '../../api/auth';
import OtpInput from '../../components/forms/OtpInput';
import { PasswordStrength } from '../../components/ui';
import { PASSWORD_RULES_ATTR, passwordProblem } from '../../utils/passwordRule';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import { tapSize } from '../../utils/elderTheme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPasswordPhone'>;

const toTen = (raw: string) => raw.replace(/\D/g, '').slice(-10);
const PHONE_RE = /^[6-9]\d{9}$/;
const CODE_LENGTH = 4; // MSG91 phone codes

/**
 * Reset a password with a texted code. For accounts made with a mobile number
 * and no verified email: the email link has nowhere to go. The server answers
 * the first step the same for every number, so this screen only ever says "if it
 * can be reset, a code was sent".
 */
export default function ForgotPasswordPhoneScreen() {
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const hit = tapSize(elder);

  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeKey, setCodeKey] = useState(0);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  const sendCode = async () => {
    if (loading) return;
    if (!PHONE_RE.test(toTen(phone))) {
      setError(t('auth.forgotPasswordPhone.phoneInvalid', 'Enter your 10-digit mobile number'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await forgotPasswordPhone(toTen(phone));
      setStep('code');
    } catch {
      setError(t('auth.forgotPasswordPhone.sendFailed', 'Could not send the code. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (loading) return;
    if (code.length < CODE_LENGTH) {
      setError(t('auth.forgotPasswordPhone.codeMissing', 'Enter the code we sent'));
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPasswordPhone(toTen(phone), code, password);
      setStep('done');
    } catch {
      setError(t('auth.forgotPasswordPhone.codeWrong', 'That code is not right or has expired. Request a new one.'));
      setCode('');
      setCodeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <Screen edges={['top']} scroll contentContainerStyle={styles.doneContainer} testID="ForgotPasswordPhoneScreen-done">
        <View style={styles.doneIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="checkmark" size={34} color={c.primary} />
        </View>
        <Text variant="title3" color="textPrimary" style={styles.center} accessibilityRole="header" accessibilityLiveRegion="polite">
          {t('auth.forgotPasswordPhone.doneTitle', 'Password updated')}
        </Text>
        <Text variant="callout" color="textSecondary" style={[styles.center, styles.doneBody]}>
          {t('auth.forgotPasswordPhone.doneBody', 'Every device was signed out. Sign in with your mobile number and new password.')}
        </Text>
        <Button title={t('auth.backToSignIn', 'Back to sign in')} onPress={() => navigation.navigate('Login')} haptic={false} style={styles.stretch} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} keyboard scroll contentContainerStyle={styles.content} testID="ForgotPasswordPhoneScreen">
      {navigation.canGoBack() && (
        <PressableScale
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { width: hit, height: hit }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </PressableScale>
      )}

      <View style={styles.header}>
        <View style={styles.iconWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="phone-portrait-outline" size={28} color={c.primary} />
        </View>
        <Text variant="title1" color="textPrimary" style={styles.title} accessibilityRole="header">
          {t('auth.forgotPasswordPhone.heading', 'Reset by mobile')}
        </Text>
        <Text variant="callout" color="textSecondary">
          {step === 'phone'
            ? t('auth.forgotPasswordPhone.subtitle', 'For accounts created with a mobile number and no email. We text you a code.')
            : t('auth.forgotPasswordPhone.codeSubtitle', 'If this number can be reset, we sent it a code. Enter it with a new password.')}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBanner} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={c.error} style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no" />
          <Text variant="subhead" color="error" style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {step === 'phone' ? (
        <>
          <Input
            label={t('auth.forgotPasswordPhone.phone', 'Mobile number')}
            value={phone}
            onChangeText={(v) => { setPhone(v); setError(''); }}
            placeholder="98765 43210"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            autoFocus
            returnKeyType="send"
            onSubmitEditing={sendCode}
            accessibilityLabel={t('auth.forgotPasswordPhone.phone', 'Mobile number')}
            style={{ minHeight: Math.max(50, hit) }}
            testID="ForgotPasswordPhoneScreen-phone"
          />
          <Button title={t('auth.forgotPasswordPhone.sendCode', 'Send code')} onPress={sendCode} loading={loading} testID="ForgotPasswordPhoneScreen-send" />
        </>
      ) : (
        <>
          <OtpInput
            length={CODE_LENGTH}
            onComplete={setCode}
            resetKey={codeKey}
            error={!!error}
            label={t('auth.forgotPasswordPhone.codeLabel', 'Enter the 4-digit code we texted you')}
            testID="ForgotPasswordPhoneScreen-code"
          />
          <View style={styles.gap}>
            <Input
              label={t('auth.forgotPasswordPhone.newPassword', 'New password')}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              passwordRules={PASSWORD_RULES_ATTR}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel={t('auth.forgotPasswordPhone.newPassword', 'New password')}
              style={{ minHeight: Math.max(50, hit) }}
              testID="ForgotPasswordPhoneScreen-password"
            />
            <PasswordStrength password={password} />
          </View>
          <Button title={t('auth.forgotPasswordPhone.reset', 'Set new password')} onPress={submit} loading={loading} testID="ForgotPasswordPhoneScreen-submit" />
          <PressableScale
            onPress={() => { setStep('phone'); setCode(''); setError(''); }}
            style={[styles.textLink, { minHeight: hit }]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.forgotPasswordPhone.differentNumber', 'Use a different number')}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="subhead" color="primary">{t('auth.forgotPasswordPhone.differentNumber', 'Use a different number')}</Text>
          </PressableScale>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  content: { padding: spacing['2xl'] },
  backBtn: { alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm, marginBottom: spacing.md, alignSelf: 'flex-start' },
  header: { marginBottom: spacing['2xl'], alignItems: 'flex-start' },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { marginBottom: spacing.sm },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: c.errorBg, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg },
  errorIcon: { marginTop: 1 },
  errorText: { flex: 1 },
  gap: { marginVertical: spacing.lg },
  textLink: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, marginTop: spacing.sm },
  doneContainer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'] },
  doneIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing['2xl'] },
  center: { textAlign: 'center' },
  doneBody: { marginBottom: spacing['3xl'], marginTop: spacing.md },
  stretch: { alignSelf: 'stretch' },
});
