/**
 * D6 door, screen 1 of 2 — replaces the old email-only Signup + mid-funnel
 * Step13 OTP. The ACCOUNT IS NOT CREATED HERE: verified identity + password
 * carry forward to BasicsScreen, which registers in one call so the server
 * derives onboardingComplete=true and the app lands on Main.
 *
 * One-field-first gate (owner decision 2, audited 2026-09-21). The web asks for
 * the identifier and proves it before it asks for anything else (web Phase 4,
 * CreateAccountStep). This screen used to put contact + password + Terms on the
 * page together and only then send the code, so a member chose a password and
 * consented before their number was even proven, and a mistyped number locked
 * the whole form. It now runs the same two phases the web does, driven by
 * `otpPhase`:
 *   A. contact only  -> Send code -> 4 boxes -> auto-verify
 *   B. verified      -> password + Terms -> Continue -> BasicsScreen
 */
import React, { useEffect, useRef, useState } from 'react';
import { PressableScale } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import {
  View, StyleSheet,
  ActivityIndicator,
  AccessibilityInfo,
  Platform,
  TextInput,
} from 'react-native';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Screen from '../../components/layout/Screen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import type { AuthStackParamList } from '../../navigation/types';
import { sendOtp, verifyOtp } from '../../api/auth';
import SmartContactInput, { parseContact } from '../../components/forms/SmartContactInput';
import OtpInput from '../../components/forms/OtpInput';
import { PasswordStrength } from '../../components/ui';
import Input from '../../components/ui/Input';
import { showToast } from '../../utils/toast';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PASSWORD_RULES_ATTR, passwordProblem } from '../../utils/passwordRule';
import { tapSize } from '../../utils/elderTheme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

type OtpPhase = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified';

// Width of the checkbox glyph; the two document links sit under the label text,
// so they are indented by this plus the row gap.
const CHECKBOX_SIZE = 22;

// A member who did not get the code waits this long before Resend comes back, so
// a few quick taps cannot spend the server's hourly send allowance for the number.
const RESEND_COOLDOWN_S = 30;

// What sendOtp()/verifyOtp() can reject with. api/client.ts rewrites EVERY 429
// into a bare Error that carries `retryAfter` and no `response`, so a rate limit
// cannot be told apart by `response.status` and must not be read as "offline".
type ApiFailure = {
  response?: { status?: number; data?: { error?: { code?: string; message?: string } } };
  retryAfter?: number;
};

const failureStatus = (err: unknown): number | undefined => {
  const failure = err as ApiFailure;
  if (failure?.response) return failure.response.status;
  return typeof failure?.retryAfter === 'number' ? 429 : undefined;
};

// The request never reached the server (offline, timeout, DNS).
const isTransportFailure = (err: unknown): boolean => axios.isAxiosError(err) && !err.response;

export default function CreateAccountScreen() {
  const { c, elder } = useTheme();
  const st = React.useMemo(() => makeSt(c), [c]);
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const hit = tapSize(elder);
  // Input's own floor is 50; elder mode needs its 60pt target. (The Buttons need
  // the same and cannot get it from here: primitive request on Button.)
  const fieldHeight = { minHeight: Math.max(50, hit) };

  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  // A field only shows its problem after it has been left (or submit was tried).
  const [touched, setTouched] = useState({ contact: false, password: false, terms: false });
  // idle → sending → sent (boxes shown) → verifying → verified
  const [otpPhase, setOtpPhase] = useState<OtpPhase>('idle');
  // Single-use proof from verify-otp; signup presents it for this contact.
  const [otpProof, setOtpProof] = useState('');
  // A resend keeps the boxes on screen, so it is its own flag, not a phase.
  const [resending, setResending] = useState(false);
  const [otpResetKey, setOtpResetKey] = useState(0);
  // Seconds until Resend is live again; 0 = live.
  const [cooldown, setCooldown] = useState(0);
  // Form-level failure (send failed) / contact-level failure (already registered) / wrong code.
  const [error, setError] = useState('');
  const [contactError, setContactError] = useState('');
  const [otpError, setOtpError] = useState('');

  // One request at a time. A ref, not state: the return key, the Resend link and
  // the Button can all fire inside one frame, before a state flag has re-rendered.
  const busy = useRef(false);
  const contactRef = useRef<TextInput>(null);
  const refocusContact = useRef(false);

  const parsed = parseContact(contact);
  const contactProblem = !contact.trim()
    ? t('auth.errors.contactRequired', 'Enter your email or mobile number')
    : !parsed.value
      ? t('auth.errors.contactInvalid', 'Enter a valid email or 10-digit mobile number')
      : '';
  // English only: the rule text comes from utils/passwordRule (primitive request).
  const pwProblem = passwordProblem(password);
  const termsProblem = termsAccepted ? '' : t('auth.signup.termsRequired', 'Accept the Terms and Privacy Policy to continue');

  const verified = otpPhase === 'verified';
  const otpActive = otpPhase === 'sent' || otpPhase === 'verifying';
  // A dimmed link is a link that cannot be pressed; the tint is not left at full accent.
  const resendBlocked = otpPhase === 'verifying' || resending || cooldown > 0;
  const changeBlocked = otpPhase === 'verifying';
  const resendLabel = cooldown > 0
    ? t('auth.signup.resendIn', { defaultValue: 'Resend in {{seconds}}s', seconds: cooldown })
    : t('auth.signup.resend', 'Resend code');
  // The server sends 4 digits to a mobile number and 6 to an email (same split as the web).
  const otpLength = parsed.kind === 'email' ? 6 : 4;
  const target = parsed.kind === 'phone' ? `+91 ${parsed.value}` : parsed.value ?? '';

  // Android reads the live-region props below; iOS ignores them, so speak the
  // newest banner-level problem (and the moment the contact is proven) there.
  // The contact field's own error is spoken by SmartContactInput.
  const spoken = otpError || error;
  useEffect(() => {
    if (spoken && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(spoken);
  }, [spoken]);
  useEffect(() => {
    if (verified && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(`${t('auth.signup.verified', 'Verified')}: ${target}`);
  }, [verified, target, t]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // "Change" on either panel: the field is editable again, so put the caret in it.
  useEffect(() => {
    if (otpPhase === 'idle' && refocusContact.current) {
      refocusContact.current = false;
      contactRef.current?.focus();
    }
  }, [otpPhase]);

  const requestCode = async (isResend: boolean) => {
    if (busy.current) return;
    setTouched((p) => ({ ...p, contact: true }));
    setError('');
    setContactError('');
    setOtpError('');
    if (contactProblem || !parsed.value || !parsed.kind) return;
    busy.current = true;
    if (isResend) setResending(true);
    else setOtpPhase('sending');
    try {
      await sendOtp(parsed.value, parsed.kind);
      setCooldown(RESEND_COOLDOWN_S);
      if (isResend) {
        setOtpResetKey((k) => k + 1);
        const sentTitle = t('auth.signup.codeResent', 'New code sent');
        showToast.info(sentTitle, target);
        AccessibilityInfo.announceForAccessibility(`${sentTitle}. ${target}`);
      } else {
        setOtpPhase('sent');
      }
    } catch (err: unknown) {
      const status = failureStatus(err);
      // A failed first send goes back to the editable field; a failed resend
      // leaves the boxes where they are.
      if (!isResend) setOtpPhase('idle');
      if (status === 409) {
        setContactError(t('auth.signup.contactExists', 'An account already exists with this contact. Log in instead.'));
      } else if (status === 429) {
        setError(t('auth.errors.tooManyRequests', 'Too many requests. Please try again later.'));
      } else if (isTransportFailure(err)) {
        setError(t('common.networkError'));
      } else {
        setError((err as ApiFailure)?.response?.data?.error?.message ?? t('auth.signup.sendFailed', 'Could not send the code. Try again.'));
      }
    } finally {
      busy.current = false;
      setResending(false);
    }
  };

  const handleVerify = async (code: string) => {
    if (busy.current || !parsed.value || !parsed.kind) return;
    busy.current = true;
    setOtpPhase('verifying');
    setOtpError('');
    try {
      setOtpProof(await verifyOtp(parsed.value, code, parsed.kind));
      setOtpPhase('verified');
    } catch (err: unknown) {
      const status = failureStatus(err);
      const message = (err as ApiFailure)?.response?.data?.error?.message ?? '';
      setOtpPhase('sent');
      setOtpResetKey((k) => k + 1);
      // Only a 400/401 says the check ran and rejected the code. A wrong digit is
      // fixed by retyping; an expired code or spent attempts only by a new code.
      // Anything else is not a verdict on the code at all.
      if (status === 400 || status === 401) {
        setOtpError(
          /expired|not sent|too many/i.test(message)
            ? t('auth.signup.codeExpired', 'That code has expired or has no attempts left. Tap Resend code for a new one.')
            : t('auth.signup.codeMismatch', 'That code did not match. Try again.'),
        );
      } else if (status === 429) {
        setOtpError(t('auth.errors.tooManyRequests', 'Too many requests. Please try again later.'));
      } else if (isTransportFailure(err)) {
        setOtpError(t('common.networkError'));
      } else {
        setOtpError(t('common.error'));
      }
    } finally {
      busy.current = false;
    }
  };

  // Phase B submit: the contact is proven, so only the password and Terms remain.
  const handleContinue = () => {
    setTouched((p) => ({ ...p, password: true, terms: true }));
    if (pwProblem || termsProblem || !parsed.value || !parsed.kind) {
      // Input's and the consent row's errors have no live region on iOS and
      // Input's has none on Android either: say what stopped the member.
      const first = pwProblem || termsProblem;
      if (first) AccessibilityInfo.announceForAccessibility(first);
      return;
    }
    navigation.navigate('SignupBasics', {
      contactKind: parsed.kind,
      contactValue: parsed.value,
      password,
      proof: otpProof,
    });
  };

  // Wrong number or address: back to the editable field without leaving the
  // screen. Editing the contact means it must be proven again.
  const handleChangeContact = () => {
    refocusContact.current = true;
    setOtpPhase('idle');
    setOtpError('');
    setError('');
  };

  return (
    <Screen
      edges={['top']}
      keyboard
      scroll
      contentContainerStyle={st.content}
      testID="CreateAccountScreen"
    >
      <PressableScale
        onPress={() => navigation.goBack()}
        style={[st.back, { width: hit, height: hit }]}
        accessibilityRole="button"
        accessibilityLabel={t('common.back', 'Back')}
        testID="signup-back"
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
      </PressableScale>

      <Text variant="caption" color="primary">{t('auth.signup.stepOne', 'Step 1 of 2')}</Text>
      <Text variant="title1" color="textPrimary" style={st.title} accessibilityRole="header">{t('auth.signup.title', 'Create your account')}</Text>
      <Text variant="footnote" color="textSecondary" style={st.sub}>{t('auth.signup.doorSub', 'Two steps. About two minutes.')}</Text>

      {!verified ? (
        <>
          <SmartContactInput
            ref={contactRef}
            label={t('auth.emailOrPhone', 'Email or mobile number')}
            value={contact}
            onChange={(raw) => {
              setContact(raw);
              setContactError('');
              // Only reachable while idle: the field is not editable once a code is on its way.
            }}
            onBlur={() => { if (contact.trim()) setTouched((p) => ({ ...p, contact: true })); }}
            error={(touched.contact && contactProblem) || contactError || undefined}
            helper={t('auth.signup.contactHelper', 'We will send a code to confirm it.')}
            editable={otpPhase === 'idle'}
            // A new-account form must not offer saved logins.
            autoComplete="off"
            textContentType="none"
            returnKeyType="send"
            onSubmitEditing={() => requestCode(false)}
          />

          {error ? <Text variant="footnote" color="error" style={st.error} accessibilityLiveRegion="polite">{error}</Text> : null}

          {otpActive ? (
            <View style={st.otpBlock}>
              <Text variant="footnote" color="textSecondary" style={st.otpTitle}>
                {t('auth.signup.enterCode', { digits: otpLength, defaultValue: 'Enter the {{digits}}-digit code sent to' })} {target}
              </Text>
              <OtpInput
                length={otpLength}
                onComplete={handleVerify}
                disabled={otpPhase === 'verifying' || resending}
                resetKey={otpResetKey}
                error={!!otpError}
                label={`${t('auth.signup.enterCode', { digits: otpLength, defaultValue: 'Enter the {{digits}}-digit code sent to' })} ${target}`}
              />
              {otpError ? (
                <Text variant="footnote" color="error" style={st.otpError} accessibilityLiveRegion="polite">{otpError}</Text>
              ) : null}
              {otpPhase === 'verifying' && (
                <ActivityIndicator size="small" color={c.primary} style={{ marginTop: spacing.sm }} accessibilityLabel={t('auth.signup.verifying', 'Verifying code')} />
              )}
              <View style={st.otpLinks}>
                <PressableScale
                  onPress={() => requestCode(true)}
                  disabled={resendBlocked}
                  style={[st.linkBtn, { minHeight: hit }]}
                  accessibilityRole="button"
                  accessibilityLabel={resendLabel}
                  accessibilityState={{ disabled: resendBlocked, busy: resending }}
                  testID="resend-otp-btn"
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text variant="caption" color={resendBlocked ? 'textMuted' : 'primary'}>{resendLabel}</Text>
                </PressableScale>
                <PressableScale
                  onPress={handleChangeContact}
                  disabled={changeBlocked}
                  style={[st.linkBtn, { minHeight: hit }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.signup.changeContact', 'Change email or number')}
                  accessibilityState={{ disabled: changeBlocked }}
                  testID="change-contact-btn"
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text variant="caption" color={changeBlocked ? 'textMuted' : 'primary'}>{t('auth.signup.changeContact', 'Change email or number')}</Text>
                </PressableScale>
              </View>
            </View>
          ) : (
            <Button
              title={t('auth.signup.sendCode', 'Send verification code')}
              onPress={() => requestCode(false)}
              loading={otpPhase === 'sending'}
              testID="send-otp-btn"
            />
          )}
        </>
      ) : (
        <>
          {/* Proven contact stays visible (with a way to change it), as on the web. */}
          <View style={st.verifiedPanel} testID="otp-verified" accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={22} color={c.successAccent} accessibilityElementsHidden importantForAccessibility="no" />
            <View style={st.verifiedText}>
              <Text variant="subhead" color="textPrimary">{t('auth.signup.verified', 'Verified')}</Text>
              <Text variant="footnote" color="textSecondary" numberOfLines={1}>{target}</Text>
            </View>
            <PressableScale
              onPress={handleChangeContact}
              style={[st.linkBtn, { minHeight: hit }]}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signup.changeContact', 'Change email or number')}
              testID="change-contact-btn"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="caption" color="primary">{t('auth.signup.change', 'Change')}</Text>
            </PressableScale>
          </View>

          <View style={st.pwGroup}>
            <Input
              label={t('auth.password', 'Password')}
              value={password}
              onChangeText={setPassword}
              onBlur={() => {
                if (!password) return;
                setTouched((p) => ({ ...p, password: true }));
                if (pwProblem) AccessibilityInfo.announceForAccessibility(pwProblem);
              }}
              placeholder={t('auth.passwordPlaceholder', 'At least 8 characters')}
              helper={t('auth.passwordHelper', 'Use 8 or more characters with upper and lower case letters, a number and one of @ $ ! % * ? &')}
              error={(touched.password && pwProblem) || undefined}
              secureTextEntry
              secureToggle
              autoCapitalize="none"
              textContentType="newPassword"
              autoComplete="new-password"
              passwordRules={PASSWORD_RULES_ATTR}
              autoFocus
              accessibilityLabel={t('auth.password', 'Password')}
              style={fieldHeight}
              testID="password-input"
            />
            {password.length > 0 && <PasswordStrength password={password} />}
          </View>

          <PressableScale
            haptic
            style={[st.termsRow, { minHeight: hit }]}
            onPress={() => { setTermsAccepted((v) => !v); setTouched((p) => ({ ...p, terms: true })); }}
            accessibilityRole="checkbox"
            accessibilityLabel={t('auth.signup.termsLabel', 'I agree to the Terms & Privacy Policy')}
            accessibilityState={{ checked: termsAccepted }}
            // A screen-reader shortcut to either document without leaving the
            // consent control; sighted users have the two link rows below.
            accessibilityActions={[
              { name: 'openTerms', label: t('auth.signup.termsLink', 'Terms & Conditions') },
              { name: 'openPrivacy', label: t('auth.signup.privacyLink', 'Privacy Policy') },
            ]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'openTerms') navigation.navigate('Terms');
              else if (e.nativeEvent.actionName === 'openPrivacy') navigation.navigate('Privacy');
            }}
            testID="terms-checkbox"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={termsAccepted ? 'checkbox' : 'square-outline'}
              size={CHECKBOX_SIZE}
              color={termsAccepted ? c.primary : c.textMuted}
            />
            <Text variant="footnote" color="textSecondary" style={st.termsText}>
              {t('auth.signup.termsLabel', 'I agree to the Terms & Privacy Policy')}
            </Text>
          </PressableScale>
          {/* The documents are their own full-height targets, not inline text in
              the sentence: nested Text cannot take hitSlop, and a tap on the
              wrapped sentence must always toggle consent, never open a page. */}
          <View style={st.legalLinks}>
            <PressableScale
              onPress={() => navigation.navigate('Terms')}
              style={[st.legalLink, { minHeight: hit }]}
              accessibilityRole="link"
              accessibilityLabel={t('auth.signup.readTerms', 'Read the Terms')}
              testID="terms-link"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="subhead" color="primary">{t('auth.signup.readTerms', 'Read the Terms')}</Text>
            </PressableScale>
            <PressableScale
              onPress={() => navigation.navigate('Privacy')}
              style={[st.legalLink, { minHeight: hit }]}
              accessibilityRole="link"
              accessibilityLabel={t('auth.signup.readPrivacy', 'Read the Privacy Policy')}
              testID="privacy-link"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="subhead" color="primary">{t('auth.signup.readPrivacy', 'Read the Privacy Policy')}</Text>
            </PressableScale>
          </View>
          {touched.terms && termsProblem ? (
            <Text variant="caption" color="error" style={st.termsError}>{termsProblem}</Text>
          ) : null}

          {/* Navigation to the next step, not a commit: no haptic. */}
          <Button
            title={t('common.continue', 'Continue')}
            onPress={handleContinue}
            haptic={false}
            style={st.continueBtn}
            testID="continue-verified-btn"
          />
        </>
      )}

      <View style={st.footerRow}>
        <Text variant="footnote" color="textSecondary">{t('auth.signup.haveAccount', 'Already have an account?')}</Text>
        <PressableScale
          onPress={() => navigation.navigate('Login')}
          style={[st.linkBtn, { minHeight: hit }]}
          accessibilityRole="link"
          accessibilityLabel={t('auth.login.signInAction', 'Sign in')}
          testID="signup-to-login"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="caption" color="primary">{t('auth.login.signInAction', 'Sign in')}</Text>
        </PressableScale>
      </View>
    </Screen>
  );
}

const makeSt = (c: ThemeColours) => StyleSheet.create({
  content: { paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], paddingBottom: spacing['3xl'] },
  // Square target; width/height come from tapSize(elder) at the call site.
  back: { marginLeft: -spacing.sm, marginBottom: spacing.md, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 4 },
  sub: { marginTop: 4, marginBottom: spacing.xl },
  pwGroup: { marginBottom: spacing.xs },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  termsText: { flex: 1 },
  // Sits under the label text, not under the checkbox glyph.
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    paddingLeft: CHECKBOX_SIZE + spacing.sm,
    marginBottom: spacing.xs,
  },
  legalLink: { justifyContent: 'center' },
  termsError: { marginBottom: spacing.sm },
  continueBtn: { marginTop: spacing.md },
  error: { marginBottom: spacing.md },
  otpBlock: { alignItems: 'center', paddingVertical: spacing.md },
  otpTitle: { marginBottom: spacing.md, textAlign: 'center' },
  otpError: { marginTop: spacing.sm, textAlign: 'center' },
  otpLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing.lg, marginTop: spacing.sm },
  linkBtn: { justifyContent: 'center', paddingHorizontal: spacing.sm },
  // Neutral outline on the canvas, not a green success panel: the check icon
  // carries the state. Not filled with surface2: the accent "Change" link is
  // 3.56:1 there in dark mode and 4.76:1 on the canvas.
  verifiedPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    marginBottom: spacing.lg,
  },
  verifiedText: { flex: 1 },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
});
