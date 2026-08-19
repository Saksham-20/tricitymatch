/**
 * Legacy-account gate. Accounts created before the D6 door (or via web without
 * basics) have onboardingComplete=false, so RootNavigator still routes them to
 * the Onboarding stack — which is now just this one screen. It collects the
 * three fields the server derives completion from (firstName + gender + DOB),
 * saves via PUT /profile/me, then refreshes the user so RootNavigator flips to
 * Main. Everything else is the in-app journey's job.
 */
import React, { useEffect, useState } from 'react';
import { PressableScale } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getMyProfile, updateMyProfile } from '../../api/profile';
import { getMe } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';

export default function CompleteBasicsScreen() {
  const { c } = useTheme();
  const st = React.useMemo(() => makeSt(c), [c]);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const setUser = useAuthStore((s) => s.setUser);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [dobDisplay, setDobDisplay] = useState('');
  const [dob, setDob] = useState('');
  const [dobError, setDobError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Prefill whatever the account already has (partially-onboarded legacy data).
  useEffect(() => {
    (async () => {
      try {
        const p = await getMyProfile();
        if (p.firstName) setFirstName(p.firstName);
        if (p.lastName) setLastName(p.lastName);
        if (p.gender === 'male' || p.gender === 'female') setGender(p.gender);
        if (p.dateOfBirth) {
          const iso = p.dateOfBirth.slice(0, 10);
          const [yyyy, mm, dd] = iso.split('-');
          if (yyyy && mm && dd) {
            setDob(iso);
            setDobDisplay(`${dd}/${mm}/${yyyy}`);
          }
        }
      } catch {
        // Blank form is a valid starting point.
      }
    })();
  }, []);

  // Numeric keypads have no "/" — insert separators as they type (4b3ccd5).
  const formatDob = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const handleDobChange = (raw: string) => {
    const text = formatDob(raw);
    setDobDisplay(text);
    setDobError('');
    setDob('');
    const parts = text.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      const [dd, mm, yyyy] = parts;
      const date = new Date(`${yyyy}-${mm}-${dd}`);
      if (isNaN(date.getTime())) { setDobError('Invalid date'); return; }
      const age = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 18) { setDobError('Must be at least 18 years old'); return; }
      if (age > 65) { setDobError('Must be under 65 years old'); return; }
      setDob(`${yyyy}-${mm}-${dd}`);
    }
  };

  const isValid = !!(firstName.trim() && lastName.trim() && gender && dob && !dobError);

  const handleContinue = async () => {
    if (!isValid || loading) return;
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
    } catch {
      setLoading(false);
      setError(t('common.error', 'Something went wrong. Try again.'));
    }
  };

  return (
    <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID="CompleteBasicsScreen">
      <ScrollView
        style={st.flex}
        contentContainerStyle={[st.content, { paddingTop: insets.top + spacing['2xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={st.title}>{t('auth.signup.basicsTitle', 'A few basics')}</Text>
        <Text style={st.sub}>{t('auth.signup.legacySub', 'Finish setting up your profile — this takes under a minute.')}</Text>

        <Text style={st.label}>{t('auth.signup.fullName', 'Full name')}</Text>
        <View style={st.nameRow}>
          <TextInput
            style={[st.input, { flex: 1 }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={c.textMuted}
            autoCapitalize="words"
            testID="first-name-input"
          />
          <TextInput
            style={[st.input, { flex: 1 }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={c.textMuted}
            autoCapitalize="words"
            testID="last-name-input"
          />
        </View>

        <Text style={st.label}>{t('auth.signup.gender', 'Gender')}</Text>
        <View style={st.nameRow}>
          {(['male', 'female'] as const).map((g) => {
            const active = gender === g;
            return (
              <TouchableOpacity
                key={g}
                style={[st.genderBtn, active && st.genderBtnActive]}
                onPress={() => setGender(g)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`gender-${g}`}
              >
                <Ionicons name={g === 'male' ? 'male' : 'female'} size={18} color={active ? '#fff' : c.textSecondary} />
                <Text style={[st.genderText, active && st.genderTextActive]}>{g === 'male' ? 'Male' : 'Female'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={st.label}>{t('auth.signup.dob', 'Date of birth')}</Text>
        <TextInput
          style={[st.input, dobError ? st.inputError : null]}
          value={dobDisplay}
          onChangeText={handleDobChange}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={c.textMuted}
          keyboardType="numeric"
          maxLength={10}
          testID="dob-input"
        />
        {dobError ? <Text style={st.error}>{dobError}</Text> : null}
        {error ? <Text style={st.error} accessibilityLiveRegion="polite">{error}</Text> : null}

        <PressableScale haptic
          style={[st.cta, (!isValid || loading) && st.ctaDisabled]}
          onPress={handleContinue}
          disabled={loading}
          testID="continue-btn"
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={st.ctaText}>{t('common.continue', 'Continue')}</Text>}
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeSt = (c: ThemeColours) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing['3xl'] },
  title: { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold, color: c.textPrimary },
  sub: { fontSize: typography.fontSize.sm, color: c.textMuted, marginTop: 4, marginBottom: spacing.xl },
  label: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: c.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.md,
    backgroundColor: c.surfaceCard, paddingHorizontal: spacing.md,
    minHeight: 50, fontSize: typography.fontSize.base, color: c.textPrimary,
  },
  inputError: { borderColor: c.error },
  genderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 50, borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.surfaceCard,
  },
  genderBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  genderText: { fontSize: typography.fontSize.base, color: c.textSecondary },
  genderTextActive: { color: '#fff', fontFamily: typography.fontFamily.semiBold },
  error: { color: c.error, fontSize: typography.fontSize.sm, marginTop: spacing.sm },
  cta: {
    backgroundColor: c.primary, borderRadius: borderRadius.pill,
    minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.base },
});
