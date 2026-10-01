/**
 * D6 door, screen 2 of 2. Names, gender, DOB, and the "profile for" chip row
 * (absorbs Step0). Submits ONE signup call carrying the basics so the server
 * derives onboardingComplete=true and RootNavigator lands on Main directly —
 * the old 14-step gate is gone; the preferences journey continues in-app.
 *
 * registeringFor has no backend column (Step0 only ever kept it in context and
 * dropped it at submit); we persist it to AsyncStorage so journey/guardian copy
 * can read it without pretending the server stores it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { PressableScale } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import {
  View, StyleSheet,
  AccessibilityInfo,
  Platform,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Screen from '../../components/layout/Screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import type { AuthStackParamList } from '../../navigation/types';
import { signup } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { spacing, borderRadius, type, type ThemeColours } from '@shared/constants/theme';
import { tapSize } from '../../utils/elderTheme';
import { minAgeFor, ageOnIso } from '../../utils/marriageableAge';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SignupBasics'>;
type Route = RouteProp<AuthStackParamList, 'SignupBasics'>;

const REGISTERING_FOR: { key: string; labelKey: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'self', labelKey: 'auth.signup.for.self', label: 'Myself', icon: 'person-outline' },
  { key: 'son', labelKey: 'auth.signup.for.son', label: 'Son', icon: 'man-outline' },
  { key: 'daughter', labelKey: 'auth.signup.for.daughter', label: 'Daughter', icon: 'woman-outline' },
  { key: 'sibling', labelKey: 'auth.signup.for.sibling', label: 'Sibling', icon: 'people-outline' },
  { key: 'relative', labelKey: 'auth.signup.for.relative', label: 'Relative', icon: 'home-outline' },
  { key: 'friend', labelKey: 'auth.signup.for.friend', label: 'Friend', icon: 'happy-outline' },
];

export const REGISTERING_FOR_KEY = 'registeringFor';

// Past this OS text scale two side-by-side name fields no longer fit a hi/pa
// label on one line, so they stack.
const STACK_NAMES_FONT_SCALE = 1.3;

// Mirrors the signup validator in backend/validators/index.js (firstName and
// lastName): 2-50 characters after trimming, English/Hindi/Punjabi letters, spaces, hyphens
// and apostrophes. A client looser than that turns a typo into a rejection on
// the very last step of the funnel, and in production the server's reason is
// stripped down to "Validation failed". Non-Latin names are a server/product
// change, not something to accept here and fail there.
const NAME_PATTERN = /^(?:[A-Za-zÀ-ÖØ-öø-ÿ]|[ऀ-ॣ]|[ॱ-ॿ]|[ਁ-੥]|[ੰ-ੵ]|[\s'’.-]|‌|‍)+$/;
const NAME_MIN = 2;
const NAME_MAX = 50;

// Oldest date of birth accepted. The web signup form's bound (validateAge in
// frontend/src/utils/validators.js); the server's own ceiling is 120.
const MAX_AGE = 100;

// What signup() can reject with. api/client.ts rewrites EVERY 429 into a bare
// Error that carries `retryAfter` and no `response`, so a rate limit is
// recognised by that shape and never read as "offline".
type ApiFailure = {
  response?: { status?: number; data?: { error?: { code?: string; message?: string } } };
  retryAfter?: number;
};

export default function BasicsScreen() {
  const { c, elder } = useTheme();
  const st = React.useMemo(() => makeSt(c), [c]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { t } = useTranslation();
  const setUser = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const { fontScale } = useWindowDimensions();
  const hit = tapSize(elder);
  // Input's own floor is 50; elder mode needs its 60pt target. (The CTA needs
  // the same and cannot get it from here: primitive request on Button.)
  const fieldHeight = { minHeight: Math.max(50, hit) };
  const stackNames = elder || fontScale > STACK_NAMES_FONT_SCALE;

  const { contactKind, contactValue, password, proof } = route.params;

  const [registeringFor, setRegisteringFor] = useState('self');
  // A profile made for someone else needs the operator's attestation, recorded by the server.
  const [attested, setAttested] = useState(false);
  const [attestTouched, setAttestTouched] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [dobDisplay, setDobDisplay] = useState('');
  const [dob, setDob] = useState('');
  const [dobError, setDobError] = useState('');
  // A field shows its problem once it has been left, or once submit was tried.
  const [touched, setTouched] = useState({ first: false, last: false, dob: false });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lastNameRef = useRef<TextInput>(null);

  // Android reads accessibilityLiveRegion; iOS needs an explicit announcement.
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  // Numeric keypads have no "/" key (the 4b3ccd5 iOS onboarding blocker) —
  // insert separators as they type.
  const formatDob = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  // A date that has been typed in full and is wrong appears under the field the
  // moment the last digit lands; Input's error text has no live region, so say it.
  const rejectDob = (message: string) => {
    setDobError(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  const handleDobChange = (raw: string) => {
    const text = formatDob(raw);
    setDobDisplay(text);
    setDobError('');
    setDob('');
    const parts = text.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      const [dd, mm, yyyy] = parts;
      const iso = `${yyyy}-${mm}-${dd}`;
      const date = new Date(`${iso}T00:00:00Z`);
      // Round-trip: a parser that rolls 31 Feb over to March still yields a
      // valid Date, so compare the calendar day back against what was typed.
      if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
        rejectDob(t('auth.signup.dobInvalid', 'Enter a valid date'));
        return;
      }
      // Same arithmetic as the server's signup validator, so the two agree on
      // who is 18 today.
      const age = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      // 18 is the floor for anyone; men need 21 — checked against the chosen gender below.
      if (age < 18) { rejectDob(t('auth.signup.dobUnder', { min: 18, defaultValue: 'You must be at least {{min}} years old' })); return; }
      if (Math.floor(age) > MAX_AGE) { rejectDob(t('auth.signup.dobInvalid', 'Enter a valid date')); return; }
      setDob(iso);
    }
  };

  const firstNameMsg = t('auth.signup.firstNameRequired', 'Enter your first name');
  const lastNameMsg = t('auth.signup.lastNameRequired', 'Enter your last name');
  const genderMsg = t('auth.signup.genderRequired', 'Choose one');
  const dobRequiredMsg = t('auth.signup.dobRequired', 'Enter your date of birth as DD/MM/YYYY');

  const nameCharsMsg = t('auth.signup.nameChars', 'Use letters only, with no digits or symbols.');
  const nameLengthMsg = t('auth.signup.nameLength', 'Names need 2 to 50 characters.');
  // Characters before length: a Hindi or Punjabi name fails the alphabet first, and
  // "2 to 50 characters" would send that member the wrong way.
  const nameProblem = (raw: string, requiredMsg: string): string | undefined => {
    const value = raw.trim();
    if (!value) return requiredMsg;
    if (!NAME_PATTERN.test(value)) return nameCharsMsg;
    if (value.length < NAME_MIN || value.length > NAME_MAX) return nameLengthMsg;
    return undefined;
  };
  const firstNameProblem = nameProblem(firstName, firstNameMsg);
  const lastNameProblem = nameProblem(lastName, lastNameMsg);

  const firstNameError = (submitted || touched.first) ? firstNameProblem : undefined;
  const lastNameError = (submitted || touched.last) ? lastNameProblem : undefined;
  const genderError = submitted && !gender ? genderMsg : undefined;
  // Men must be 21, women 18 — judged against the gender chosen, whichever order they are filled in.
  const minAge = minAgeFor(gender);
  const dobAgeError = dob && ageOnIso(dob) < minAge
    ? t('auth.signup.dobUnder', { min: minAge, defaultValue: 'You must be at least {{min}} years old' })
    : '';
  const dobShownError = dobError || dobAgeError || ((submitted || touched.dob) && !dob ? dobRequiredMsg : '');

  // Input's error text has no live region, so a blur that produces an error says so.
  const leaveField = (key: 'first' | 'last' | 'dob', problem: string | undefined) => {
    setTouched((p) => ({ ...p, [key]: true }));
    if (problem) AccessibilityInfo.announceForAccessibility(problem);
  };

  const handleCreate = async () => {
    if (loading) return;
    setSubmitted(true);
    if (firstNameProblem || lastNameProblem || !gender || !dob || dobError || dobAgeError) {
      // Nothing moves on screen for a screen-reader user: read out what is missing.
      const problems = [
        firstNameProblem,
        lastNameProblem,
        !gender && genderMsg,
        (dobError || dobAgeError || !dob) && (dobError || dobAgeError || dobRequiredMsg),
      ].filter(Boolean) as string[];
      AccessibilityInfo.announceForAccessibility(problems.join('. '));
      return;
    }
    if (registeringFor !== 'self' && !attested) {
      setAttestTouched(true);
      AccessibilityInfo.announceForAccessibility(t('auth.signup.attestRequired', 'Confirm the person agrees to this profile'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await AsyncStorage.setItem(REGISTERING_FOR_KEY, registeringFor).catch(() => {});
      const result = await signup({
        [contactKind === 'phone' ? 'phone' : 'email']: contactValue,
        [contactKind === 'phone' ? 'phoneProof' : 'emailProof']: proof,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        dateOfBirth: dob,
        // This screen is only reachable after the Terms box was ticked on the
        // previous one; the server needs it stated in the request.
        termsAccepted: true,
        marketingConsent: Boolean(route.params.marketing),
        ...(route.params.referralCode ? { referralCode: route.params.referralCode } : {}),
        creatingFor: registeringFor === 'self' ? 'self' : 'other',
        ...(registeringFor === 'self' ? {} : {
          relationshipToProfile: registeringFor === 'son' || registeringFor === 'daughter' ? 'child' : registeringFor,
          subjectAttestation: attested,
        }),
      });
      setAccessToken(result.accessToken);
      setUser(result.user);
      // RootNavigator switches to Main (onboardingComplete derives true from firstName).
    } catch (err: unknown) {
      const failure = err as ApiFailure;
      const status = failure?.response?.status ?? (typeof failure?.retryAfter === 'number' ? 429 : undefined);
      const code = failure?.response?.data?.error?.code;
      const message = failure?.response?.data?.error?.message;
      setLoading(false);
      if (status === 409) {
        setError(t('auth.signup.contactExists', 'An account already exists with this contact. Log in instead.'));
      } else if (status === 429) {
        setError(t('auth.signup.tooManySignups', 'Too many signup attempts. Please try again later.'));
      } else if (status === 400 && code === 'VALIDATION_ERROR') {
        // Production strips the field detail, so the server's own text is the
        // literal "Validation failed": name what the member can actually check.
        setError(t('auth.signup.checkDetails', 'Check your name and date of birth, then try again.'));
      } else if (status === 400 && message) {
        setError(message);
      } else if (!failure?.response && axios.isAxiosError(err)) {
        // A real transport failure: the request never reached the server.
        setError(t('common.networkError'));
      } else {
        setError(t('common.error', 'Something went wrong. Try again.'));
      }
    }
  };

  return (
    <Screen
      edges={['top']}
      keyboard
      scroll
      contentContainerStyle={st.content}
      testID="BasicsScreen"
    >
      <PressableScale
        onPress={() => navigation.goBack()}
        style={[st.back, { width: hit, height: hit }]}
        accessibilityRole="button"
        accessibilityLabel={t('common.back', 'Back')}
        testID="basics-back"
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
      </PressableScale>

      <Text variant="caption" color="primary">{t('auth.signup.stepTwo', 'Step 2 of 2')}</Text>
      <Text variant="title1" color="textPrimary" style={st.title} accessibilityRole="header">{t('auth.signup.basicsTitle', 'A few basics')}</Text>
      <Text variant="footnote" color="textSecondary" style={st.sub}>{t('auth.signup.basicsIntro', 'This creates the profile. Everything else can wait.')}</Text>

      <Text variant="footnote" color="textPrimary" style={st.label}>{t('auth.signup.profileFor', 'This profile is for')}</Text>
      <View style={st.chipRow} accessibilityRole="radiogroup" accessibilityLabel={t('auth.signup.profileFor', 'This profile is for')}>
        {REGISTERING_FOR.map((opt) => {
          const active = registeringFor === opt.key;
          const label = t(opt.labelKey, opt.label);
          return (
            <PressableScale
              key={opt.key}
              haptic
              style={[st.chip, active && st.chipActive, { minHeight: hit }]}
              onPress={() => setRegisteringFor(opt.key)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: active, selected: active }}
              testID={`profile-for-${opt.key}`}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {/* Selected swaps the glyph for a check, so state never rests on colour alone. */}
              <Ionicons name={active ? 'checkmark' : opt.icon} size={16} color={active ? c.accent : c.textSecondary} />
              {/* Neutral label: accent text on the accent tint is 4.4:1 in dark mode. */}
              <Text variant="subhead" color={active ? 'textPrimary' : 'textSecondary'}>{label}</Text>
            </PressableScale>
          );
        })}
      </View>

      {registeringFor !== 'self' && (
        <View>
          <PressableScale
            haptic
            style={[st.attestRow, { minHeight: hit }]}
            onPress={() => { setAttested((v) => !v); setAttestTouched(true); }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: attested }}
            accessibilityLabel={t('auth.signup.attestSubject', 'The person this profile is for is of legal age to marry, knows about it, and agrees to it.')}
            testID="attest-checkbox"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={attested ? 'checkbox' : 'square-outline'} size={22} color={attested ? c.primary : c.textMuted} />
            <Text variant="footnote" color="textSecondary" style={st.attestText}>
              {t('auth.signup.attestSubject', 'The person this profile is for is of legal age to marry, knows about it, and agrees to it.')}
            </Text>
          </PressableScale>
          {attestTouched && !attested && (
            <Text variant="footnote" color="error" style={st.attestError}>{t('auth.signup.attestRequired', 'Confirm the person agrees to this profile')}</Text>
          )}
        </View>
      )}

      <View style={[st.nameRow, stackNames && st.nameRowStacked]}>
        <Input
          containerStyle={stackNames ? undefined : st.nameField}
          label={t('auth.signup.firstName', 'First name')}
          value={firstName}
          onChangeText={setFirstName}
          onBlur={() => leaveField('first', firstNameProblem)}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          onSubmitEditing={() => lastNameRef.current?.focus()}
          accessibilityLabel={t('auth.signup.firstName', 'First name')}
          error={firstNameError}
          style={fieldHeight}
          testID="first-name-input"
        />
        <Input
          ref={lastNameRef}
          containerStyle={stackNames ? undefined : st.nameField}
          label={t('auth.signup.lastName', 'Last name')}
          value={lastName}
          onChangeText={setLastName}
          onBlur={() => leaveField('last', lastNameProblem)}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="done"
          accessibilityLabel={t('auth.signup.lastName', 'Last name')}
          error={lastNameError}
          style={fieldHeight}
          testID="last-name-input"
        />
      </View>
      {/* Named up front so a hi/pa member is not first told on blur. Swapped for the error once there is one. */}
      {!firstNameError && !lastNameError ? (
        <Text variant="caption" color="textSecondary" style={st.nameHint}>{t('auth.signup.nameHint', 'English, Hindi or Punjabi letters, 2 to 50 characters.')}</Text>
      ) : null}

      <Text variant="footnote" color="textPrimary" style={st.label}>{t('auth.signup.gender', 'Gender')}</Text>
      <View style={st.genderRow} accessibilityRole="radiogroup" accessibilityLabel={t('auth.signup.gender', 'Gender')}>
        {(['male', 'female'] as const).map((g) => {
          const active = gender === g;
          const label = g === 'male' ? t('auth.signup.male', 'Male') : t('auth.signup.female', 'Female');
          return (
            <PressableScale
              key={g}
              haptic
              style={[st.genderBtn, active && st.genderBtnActive, { minHeight: Math.max(50, hit) }]}
              onPress={() => setGender(g)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: active, selected: active }}
              testID={`gender-${g}`}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={active ? 'checkmark' : g === 'male' ? 'male' : 'female'} size={18} color={active ? c.accent : c.textSecondary} />
              <Text variant="callout" color={active ? 'textPrimary' : 'textSecondary'}>{label}</Text>
            </PressableScale>
          );
        })}
      </View>
      {genderError ? <Text variant="caption" color="error" style={st.groupError}>{genderError}</Text> : null}

      <Input
        containerStyle={st.dobField}
        label={t('auth.signup.dob', 'Date of birth')}
        value={dobDisplay}
        onChangeText={handleDobChange}
        // A typed-in-full bad date was already spoken by rejectDob; only "missing" is news on blur.
        onBlur={() => leaveField('dob', dobError || dob ? undefined : dobRequiredMsg)}
        placeholder="DD/MM/YYYY"
        keyboardType="numeric"
        returnKeyType="done"
        maxLength={10}
        accessibilityLabel={t('auth.signup.dob', 'Date of birth')}
        accessibilityHint={t('auth.signup.dobA11yHint', 'Type day, month and year as eight digits. The slashes are added for you.')}
        style={fieldHeight}
        testID="dob-input"
        error={dobShownError || undefined}
        helper={t('auth.signup.dobHintMin', 'You must be 18 or older. Shown as age only.')}
      />

      {error ? <Text variant="footnote" color="error" style={st.error} accessibilityLiveRegion="polite">{error}</Text> : null}

      <Button
        title={t('auth.signup.createProfile', 'Create my profile')}
        onPress={handleCreate}
        loading={loading}
        style={st.cta}
        testID="create-profile-btn"
      />
    </Screen>
  );
}

const makeSt = (c: ThemeColours) => StyleSheet.create({
  content: { paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], paddingBottom: spacing['3xl'] },
  // Square target; width/height come from tapSize(elder) at the call site.
  back: { marginLeft: -spacing.sm, marginBottom: spacing.md, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 4 },
  sub: { marginTop: 4, marginBottom: spacing.xl },
  // Same face as the Input primitive's label, so group labels and field labels match.
  label: { fontFamily: type.headline.fontFamily, marginBottom: 6, marginTop: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  attestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  attestText: { flex: 1 },
  attestError: { marginBottom: spacing.md },
  // Selected = accent-tinted (the Chip primitive's idiom), not a flat burgundy
  // fill: white on the dark-mode accent (#C75D7E) is only ~4:1.
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: borderRadius.pill, borderWidth: 1.5, borderColor: c.border,
    backgroundColor: c.surfaceCard,
  },
  chipActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  // Stacked: no `flex: 1` on the fields (it would collapse them in this
  // auto-height column); each one takes the full width instead.
  nameRowStacked: { flexDirection: 'column', gap: 0 },
  nameField: { flex: 1 },
  // The fields carry their own 15pt bottom margin; pull the hint up under them.
  nameHint: { marginTop: -spacing.sm },
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: c.border,
    backgroundColor: c.surfaceCard,
  },
  genderBtnActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
  groupError: { marginTop: 5 },
  dobField: { marginTop: spacing.lg },
  error: { marginTop: spacing.sm },
  cta: { marginTop: spacing.xl },
});
