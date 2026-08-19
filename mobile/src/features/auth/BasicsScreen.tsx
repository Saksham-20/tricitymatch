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
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { signup } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SignupBasics'>;
type Route = RouteProp<AuthStackParamList, 'SignupBasics'>;

const REGISTERING_FOR: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'self', label: 'Myself', icon: 'person-outline' },
  { key: 'son', label: 'Son', icon: 'man-outline' },
  { key: 'daughter', label: 'Daughter', icon: 'woman-outline' },
  { key: 'sibling', label: 'Sibling', icon: 'people-outline' },
  { key: 'relative', label: 'Relative', icon: 'home-outline' },
  { key: 'friend', label: 'Friend', icon: 'happy-outline' },
];

export const REGISTERING_FOR_KEY = 'registeringFor';

export default function BasicsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const setUser = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  const { contactKind, contactValue, password } = route.params;

  const [registeringFor, setRegisteringFor] = useState('self');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [dobDisplay, setDobDisplay] = useState('');
  const [dob, setDob] = useState('');
  const [dobError, setDobError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Numeric keypads have no "/" key (the 4b3ccd5 iOS onboarding blocker) —
  // insert separators as they type.
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

  const handleCreate = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError('');
    try {
      await AsyncStorage.setItem(REGISTERING_FOR_KEY, registeringFor).catch(() => {});
      const result = await signup({
        [contactKind === 'phone' ? 'phone' : 'email']: contactValue,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        dateOfBirth: dob,
      });
      setAccessToken(result.accessToken);
      setUser(result.user);
      // RootNavigator switches to Main (onboardingComplete derives true from firstName).
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      setLoading(false);
      if (anyErr?.response?.status === 409) {
        setError('An account already exists with this contact — log in instead.');
      } else if (anyErr?.response?.status === 429) {
        setError('Too many signup attempts. Please try again later.');
      } else {
        setError(anyErr?.response?.data?.error?.message ?? t('common.error', 'Something went wrong. Try again.'));
      }
    }
  };

  return (
    <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID="BasicsScreen">
      <ScrollView
        style={st.flex}
        contentContainerStyle={[st.content, { paddingTop: insets.top + spacing['2xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.back} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colours.textPrimary} />
        </TouchableOpacity>

        <Text style={st.stepTag}>{t('auth.signup.stepTwo', 'Step 2 of 2')}</Text>
        <Text style={st.title}>{t('auth.signup.basicsTitle', 'A few basics')}</Text>
        <Text style={st.sub}>{t('auth.signup.basicsSub', 'This creates the profile — everything else can wait.')}</Text>

        <Text style={st.label}>{t('auth.signup.profileFor', 'This profile is for')}</Text>
        <View style={st.chipRow}>
          {REGISTERING_FOR.map((opt) => {
            const active = registeringFor === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[st.chip, active && st.chipActive]}
                onPress={() => setRegisteringFor(opt.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`profile-for-${opt.key}`}
              >
                <Ionicons name={opt.icon} size={16} color={active ? '#fff' : colours.textSecondary} />
                <Text style={[st.chipText, active && st.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={st.label}>{t('auth.signup.fullName', 'Full name')}</Text>
        <View style={st.nameRow}>
          <TextInput
            style={[st.input, { flex: 1 }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={colours.textMuted}
            autoCapitalize="words"
            autoComplete="given-name"
            testID="first-name-input"
          />
          <TextInput
            style={[st.input, { flex: 1 }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={colours.textMuted}
            autoCapitalize="words"
            autoComplete="family-name"
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
                <Ionicons name={g === 'male' ? 'male' : 'female'} size={18} color={active ? '#fff' : colours.textSecondary} />
                <Text style={[st.genderText, active && st.chipTextActive]}>{g === 'male' ? 'Male' : 'Female'}</Text>
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
          placeholderTextColor={colours.textMuted}
          keyboardType="numeric"
          maxLength={10}
          testID="dob-input"
        />
        <Text style={st.hint}>{t('auth.signup.dobHint', 'Members must be 18–65. Shown as age only.')}</Text>
        {dobError ? <Text style={st.error}>{dobError}</Text> : null}

        {error ? <Text style={st.error} accessibilityLiveRegion="polite">{error}</Text> : null}

        <TouchableOpacity
          style={[st.cta, (!isValid || loading) && st.ctaDisabled]}
          onPress={handleCreate}
          disabled={loading}
          testID="create-profile-btn"
          accessibilityRole="button"
          accessibilityLabel="Create my profile"
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={st.ctaText}>{t('auth.signup.createProfile', 'Create my profile')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colours.background },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing['3xl'] },
  back: { marginBottom: spacing.md, alignSelf: 'flex-start' },
  stepTag: { fontSize: typography.fontSize.xs, color: colours.primary, fontFamily: typography.fontFamily.semiBold, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginTop: 4 },
  sub: { fontSize: typography.fontSize.sm, color: colours.textMuted, marginTop: 4, marginBottom: spacing.xl },
  label: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: colours.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: borderRadius.pill, borderWidth: 1, borderColor: colours.border,
    backgroundColor: colours.surfaceCard,
  },
  chipActive: { backgroundColor: colours.primary, borderColor: colours.primary },
  chipText: { fontSize: typography.fontSize.sm, color: colours.textSecondary },
  chipTextActive: { color: '#fff', fontFamily: typography.fontFamily.semiBold },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colours.border, borderRadius: borderRadius.md,
    backgroundColor: colours.surfaceCard, paddingHorizontal: spacing.md,
    minHeight: 50, fontSize: typography.fontSize.base, color: colours.textPrimary,
  },
  inputError: { borderColor: colours.error },
  genderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 50, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colours.border,
    backgroundColor: colours.surfaceCard,
  },
  genderBtnActive: { backgroundColor: colours.primary, borderColor: colours.primary },
  genderText: { fontSize: typography.fontSize.base, color: colours.textSecondary },
  hint: { fontSize: typography.fontSize.xs, color: colours.textMuted, marginTop: 4 },
  error: { color: colours.error, fontSize: typography.fontSize.sm, marginTop: spacing.sm },
  cta: {
    backgroundColor: colours.primary, borderRadius: borderRadius.pill,
    minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.base },
});
