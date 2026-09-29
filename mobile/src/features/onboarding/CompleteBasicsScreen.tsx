/**
 * Legacy-account gate. Accounts created before the D6 door (or via web without
 * basics) have onboardingComplete=false, so RootNavigator still routes them to
 * the Onboarding stack — which is now just this one screen. It collects the
 * three fields the server derives completion from (firstName + gender + DOB),
 * saves via PUT /profile/me, then refreshes the user so RootNavigator flips to
 * Main. Everything else is the in-app journey's job.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AccessibilityInfo, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/motion';
import Screen from '../../components/layout/Screen';
import { useTheme } from '../../hooks/useTheme';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { showToast } from '../../utils/toast';
import { useOnboardingControls } from './OnboardingLayout';
import { getMyProfile, updateMyProfile } from '../../api/profile';
import { getMe } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { tapSize } from '../../utils/elderTheme';
import { minAgeFor, ageOnIso } from '../../utils/marriageableAge';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';

/** Calendar-valid DD/MM/YYYY -> ISO date, or null. `new Date('2000-02-31')` may roll over, so round-trip it. */
const toIsoDate = (dd: string, mm: string, yyyy: string): string | null => {
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * The server's rule for firstName / lastName (validators updateProfileValidation):
 * trimmed, 2-50 characters, English letters, spaces, apostrophes and hyphens.
 * Mirrored here so a rejected name is explained beside its field instead of
 * coming back from the save as an opaque "Validation failed".
 */
const NAME_PATTERN = /^[a-zA-Z\s'-]+$/;
const isValidName = (raw: string): boolean => {
  const v = raw.trim();
  return v.length >= 2 && v.length <= 50 && NAME_PATTERN.test(v);
};

export default function CompleteBasicsScreen() {
  const { c, elder } = useTheme();
  const st = React.useMemo(() => makeSt(c), [c]);
  const { t } = useTranslation();
  const controls = useOnboardingControls();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const dobTouched = useRef(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [dobDisplay, setDobDisplay] = useState('');
  const [dob, setDob] = useState('');
  const [dobError, setDobError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Prefill whatever the account already has (partially-onboarded legacy data).
  // Functional updates only fill a field the member has not typed into yet, so a
  // slow response never overwrites what they are already entering.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getMyProfile();
        if (cancelled) return;
        if (p.firstName) setFirstName((cur) => cur || p.firstName);
        if (p.lastName) setLastName((cur) => cur || p.lastName);
        if (p.gender === 'male' || p.gender === 'female') {
          const g = p.gender;
          setGender((cur) => cur ?? g);
        }
        if (p.dateOfBirth) {
          const iso = p.dateOfBirth.slice(0, 10);
          const [yyyy, mm, dd] = iso.split('-');
          if (yyyy && mm && dd && !dobTouched.current) {
            setDob(iso);
            setDobDisplay(`${dd}/${mm}/${yyyy}`);
          }
        }
      } catch {
        // A blank form is a valid starting point, but say why it is blank: a
        // legacy member with saved details would otherwise assume they were lost.
        if (!cancelled) {
          showToast.info(
            t('auth.signup.profileLoadFailed', "Couldn't load your saved details"),
            t('auth.signup.profileLoadFailedBody', 'You can still fill these in.'),
          );
        }
      }
    })();
    return () => { cancelled = true; };
    // Runs once on mount; `t` is only read for the failure toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Errors appear without a tap. The save error carries a live region, which
  // Android reads on its own, so only iOS needs the explicit announce (both
  // together made TalkBack say it twice). The date error renders inside Input,
  // which has no live region, so it is announced on both platforms.
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  useEffect(() => {
    if (dobError) AccessibilityInfo.announceForAccessibility(dobError);
  }, [dobError]);
  useEffect(() => {
    if (firstNameError) AccessibilityInfo.announceForAccessibility(firstNameError);
  }, [firstNameError]);
  useEffect(() => {
    if (lastNameError) AccessibilityInfo.announceForAccessibility(lastNameError);
  }, [lastNameError]);

  // Shared by blur and submit. Empty says what is missing; anything else that
  // fails the server's rule says how to fix it.
  const nameProblem = (raw: string, requiredMsg: string): string => {
    if (!raw.trim()) return requiredMsg;
    return isValidName(raw) ? '' : t('auth.signup.nameInvalid', 'Enter at least 2 letters, using English letters only.');
  };
  const firstNameRequired = t('auth.signup.firstNameRequired', 'Enter your first name');
  const lastNameRequired = t('auth.signup.lastNameRequired', 'Enter your last name');

  // Numeric keypads have no "/" — insert separators as they type (4b3ccd5).
  const formatDob = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const handleDobChange = (raw: string) => {
    dobTouched.current = true;
    const text = formatDob(raw);
    setDobDisplay(text);
    setDobError('');
    setDob('');
    const parts = text.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      const [dd, mm, yyyy] = parts;
      const iso = toIsoDate(dd, mm, yyyy);
      if (!iso) { setDobError(t('auth.signup.dobInvalid', 'Enter a valid date')); return; }
      // Same arithmetic as the server's validator, so client and server agree at the boundary.
      const age = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      // Same keys and wording as the Basics screen the new-account path uses.
      if (age < 18) { setDobError(t('auth.signup.dobUnder', { min: 18, defaultValue: 'You must be at least {{min}} years old' })); return; }
      if (age > 65) { setDobError(t('auth.signup.dobOver', 'Members must be 65 or younger')); return; }
      setDob(iso);
    }
  };

  // Validate on blur too: a half-typed date otherwise disables Continue with no reason given.
  const handleDobBlur = () => {
    if (dobDisplay && !dob && !dobError) {
      setDobError(t('auth.signup.dobRequired', 'Enter your date of birth as DD/MM/YYYY'));
    }
  };

  // Men must be 21, women 18 — against whichever gender is chosen, in either fill order.
  const minAge = minAgeFor(gender);
  const dobAgeError = dob && ageOnIso(dob) < minAge
    ? t('auth.signup.dobUnder', { min: minAge, defaultValue: 'You must be at least {{min}} years old' })
    : '';
  const isValid = !!(firstName.trim() && lastName.trim() && gender && dob && !dobError && !dobAgeError);

  const handleContinue = async () => {
    if (!isValid || loading) return;
    // Validate on submit as well as on blur: Continue is enabled by "not empty",
    // so a one-letter or non-English name reaches here and must be explained,
    // not sent to the server to come back as "Validation failed".
    const firstProblem = nameProblem(firstName, firstNameRequired);
    const lastProblem = nameProblem(lastName, lastNameRequired);
    setFirstNameError(firstProblem);
    setLastNameError(lastProblem);
    if (firstProblem || lastProblem) {
      (firstProblem ? firstNameRef : lastNameRef).current?.focus();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        dateOfBirth: dob,
      });
      const me = await getMe();
      setUser(me); // onboardingComplete now true → RootNavigator switches to Main
      // If the server still reads the account as incomplete, the navigator will
      // not move: say so instead of leaving a silent, inert screen.
      if (!me.onboardingComplete) {
        setError(t('auth.signup.stillIncomplete', {
          defaultValue: "Your details were saved, but your account isn't ready yet. Tap {{action}} to try again.",
          action: t('common.continue', 'Continue'),
        }));
      }
    } catch (err) {
      // The server's own text for a 400 is the English "Validation failed" (its
      // field details are stripped in production), which names nothing and is
      // not translated. Say which fields to check instead.
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 400
          ? t('auth.signup.detailsRejected', "Those details weren't accepted. Check your name and date of birth, then try again.")
          : t('auth.signup.saveFailed', "Couldn't save your details. Check your connection and try again."),
      );
    } finally {
      // Always release the button: on success the navigator unmounts this screen
      // in the same batch, but when it does not, Continue and Log Out (which is
      // disabled while loading) must not stay locked behind a spinner.
      setLoading(false);
    }
  };

  const genderOptions = [
    { key: 'male', label: t('onboarding.step1.genderOptions.male', 'Male'), icon: 'male' },
    { key: 'female', label: t('onboarding.step1.genderOptions.female', 'Female'), icon: 'female' },
  ] as const;

  return (
    <Screen
      edges={['top', 'bottom']}
      keyboard
      scroll
      contentContainerStyle={[st.content, { paddingTop: spacing['2xl'] }]}
      testID="CompleteBasicsScreen"
    >
      <Text variant="title2" color="textPrimary" accessibilityRole="header">{t('auth.signup.basicsTitle', 'A few basics')}</Text>
      <Text variant="footnote" color="textSecondary" style={st.sub}>{t('auth.signup.legacyBasicsSub', 'Finish setting up your profile. This takes under a minute.')}</Text>

      <View style={st.nameRow}>
        <Input
          ref={firstNameRef}
          {...controls.inputProps}
          label={t('auth.signup.firstName', 'First name')}
          containerStyle={st.nameField}
          value={firstName}
          onChangeText={(text) => {
            setFirstName(text);
            if (firstNameError && !nameProblem(text, firstNameRequired)) setFirstNameError('');
          }}
          onBlur={() => setFirstNameError(nameProblem(firstName, firstNameRequired))}
          error={firstNameError}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          onSubmitEditing={() => lastNameRef.current?.focus()}
          blurOnSubmit={false}
          maxLength={50}
          testID="first-name-input"
          accessibilityLabel={t('auth.signup.firstName', 'First name')}
        />
        <Input
          ref={lastNameRef}
          {...controls.inputProps}
          label={t('auth.signup.lastName', 'Last name')}
          containerStyle={st.nameField}
          value={lastName}
          onChangeText={(text) => {
            setLastName(text);
            if (lastNameError && !nameProblem(text, lastNameRequired)) setLastNameError('');
          }}
          onBlur={() => setLastNameError(nameProblem(lastName, lastNameRequired))}
          error={lastNameError}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="done"
          maxLength={50}
          testID="last-name-input"
          accessibilityLabel={t('auth.signup.lastName', 'Last name')}
        />
      </View>

      <Text variant="footnote" color="textPrimary" style={st.label}>{t('auth.signup.gender', 'Gender')}</Text>
      <View
        style={st.genderRow}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('auth.signup.gender', 'Gender')}
      >
        {genderOptions.map((g) => {
          const active = gender === g.key;
          return (
            <PressableScale
              key={g.key}
              haptic
              style={[st.genderBtn, { minHeight: Math.max(50, tapSize(elder)) }, active && st.genderBtnActive]}
              onPress={() => setGender(g.key)}
              accessibilityRole="radio"
              accessibilityLabel={g.label}
              accessibilityState={{ selected: active, checked: active }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID={`gender-${g.key}`}
            >
              <Ionicons
                name={g.icon}
                size={18}
                color={active ? c.accent : c.textSecondary}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Text variant="callout" color={active ? 'primary' : 'textSecondary'}>{g.label}</Text>
              {active ? (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={c.accent}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              ) : null}
            </PressableScale>
          );
        })}
      </View>

      <Input
        {...controls.inputProps}
        label={t('auth.signup.dob', 'Date of birth')}
        containerStyle={st.dobField}
        value={dobDisplay}
        onChangeText={handleDobChange}
        onBlur={handleDobBlur}
        placeholder="DD/MM/YYYY"
        keyboardType="numeric"
        maxLength={10}
        error={dobError || dobAgeError}
        testID="dob-input"
        accessibilityLabel={t('auth.signup.dob', 'Date of birth')}
      />
      {error ? (
        <Text variant="footnote" color="error" style={st.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>
      ) : null}

      <Button
        title={t('common.continue', 'Continue')}
        onPress={handleContinue}
        loading={loading}
        disabled={!isValid}
        size="lg"
        style={[st.cta, controls.buttonStyle]}
        testID="continue-btn"
      />

      {/* This gate is the only screen a legacy account can reach; without an exit a
          permanent failure here would strand them. Signing out loses nothing. */}
      <Button
        title={t('settings.logout', 'Log Out')}
        onPress={() => { logout(); }}
        variant="text"
        disabled={loading}
        style={[st.logout, controls.textButtonStyle]}
        testID="basics-logout-btn"
      />
    </Screen>
  );
}

const makeSt = (c: ThemeColours) => StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing['3xl'] },
  sub: { marginTop: 4, marginBottom: spacing.xl },
  // Same treatment as Input's label, so the gender group reads as part of the same form.
  label: { fontFamily: 'Inter-SemiBold', marginBottom: 6 },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  nameField: { flex: 1 },
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  dobField: { marginTop: spacing.md },
  genderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    // 1.5 in both states, so choosing one never shifts its content by half a point.
    borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: c.border,
    backgroundColor: c.surfaceCard,
  },
  // Tint + accent border + checkmark (not a flat burgundy fill, and not colour alone).
  genderBtnActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
  error: { marginTop: spacing.sm },
  cta: { marginTop: spacing.xl },
  logout: { marginTop: spacing.sm, alignSelf: 'center' },
});
