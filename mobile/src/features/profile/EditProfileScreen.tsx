import React, { useState, useCallback } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import type { TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { EditProfileSkeleton } from '../../components/ui/skeletons';
import { showToast } from '../../utils/toast';
import PickerSheet from '../../components/ui/PickerSheet';
import { PressableScale } from '../../components/motion';
import { PROFILE_PROMPTS, PromptPair, fromProfilePrompts, toProfilePrompts } from '../../constants/prompts';
import { useTranslation } from 'react-i18next';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { getMyProfile, updateMyProfile, uploadPhoto, deletePhoto } from '../../api/profile';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import type { Profile } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Field Editor ─────────────────────────────────────────────────────────────

interface FieldEditorProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  textContentType?: TextInputProps['textContentType'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  testID?: string;
}

function FieldEditor({
  label, value, onChange, multiline, maxLength, keyboardType = 'default',
  textContentType, autoComplete, autoCapitalize, testID,
}: FieldEditorProps) {
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      blurOnSubmit={!multiline}
      returnKeyType={multiline ? 'default' : 'done'}
      maxLength={maxLength}
      keyboardType={keyboardType}
      textContentType={textContentType}
      autoComplete={autoComplete}
      autoCapitalize={autoCapitalize ?? (multiline ? 'sentences' : 'words')}
      testID={testID ?? `field-${label}`}
      accessibilityLabel={label}
      placeholder={`Enter ${label.toLowerCase()}`}
      helper={maxLength ? `${value.length}/${maxLength}` : undefined}
      style={multiline ? feStyles.inputMulti : undefined}
    />
  );
}

const feStyles = StyleSheet.create({
  inputMulti: {
    height: 100,
    textAlignVertical: 'top',
  },
});

// ─── Select Pill ──────────────────────────────────────────────────────────────

interface SelectPillProps<T extends string> {
  label: string;
  options: { key: T; label: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
  testPrefix: string;
}

function SelectPill<T extends string>({ label, options, selected, onSelect, testPrefix }: SelectPillProps<T>) {
  const { c } = useTheme();
  const sp = React.useMemo(() => makeSp(c), [c]);
  return (
    <View style={sp.container}>
      <Text variant="subhead" color="textSecondary" style={sp.label}>{label}</Text>
      <View style={sp.row}>
        {options.map((opt) => {
          const active = selected === opt.key;
          return (
            <PressableScale
              key={opt.key}
              style={[sp.pill, active && sp.pillActive]}
              onPress={() => onSelect(opt.key)}
              testID={`${testPrefix}-${opt.key}`}
              accessibilityLabel={opt.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="footnote" color={active ? 'primary' : 'textSecondary'}>{opt.label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const makeSp = (c: ThemeColours) => StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    marginBottom: 6,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
});

// ─── Section Card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}

function SectionCard({ title, children, expanded, onToggle }: SectionCardProps) {
  const { c } = useTheme();
  const sc = React.useMemo(() => makeSc(c), [c]);
  return (
    <View style={sc.card}>
      <PressableScale
        style={sc.header}
        onPress={onToggle}
        testID={`section-${title}`}
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text variant="headline" color="textPrimary">{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
      </PressableScale>
      {expanded && <View style={sc.body}>{children}</View>}
    </View>
  );
}

const makeSc = (c: ThemeColours) => StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  body: { padding: spacing.lg, paddingTop: 0 },
});

// ─── Photo Grid ───────────────────────────────────────────────────────────────

interface PhotoGridProps {
  photos: string[];
  onAdd: () => void;
  onRemove: (uri: string) => void;
  loading?: boolean;
}

function PhotoGrid({ photos, onAdd, onRemove, loading }: PhotoGridProps) {
  const { c } = useTheme();
  const pg = React.useMemo(() => makePg(c), [c]);
  const slots = Array.from({ length: 6 });
  return (
    <View style={pg.grid}>
      {slots.map((_, i) => {
        const uri = photos[i];
        return (
          <View key={i} style={pg.slot}>
            {uri ? (
              <>
                <Image source={{ uri }} style={pg.photo} resizeMode="cover" />
                {i > 0 && (
                  <PressableScale
                    scaleTo={0.92}
                    style={pg.removeBtn}
                    onPress={() => onRemove(uri)}
                    testID={`remove-photo-${i}`}
                    accessibilityLabel="Remove photo"
                    accessibilityRole="button"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={22} color={c.error} />
                  </PressableScale>
                )}
                {i === 0 && (
                  <View style={pg.primaryBadge}>
                    <Text variant="micro" style={pg.primaryText}>Main</Text>
                  </View>
                )}
              </>
            ) : (
              <PressableScale
                style={pg.addBtn}
                onPress={onAdd}
                disabled={loading}
                testID={`add-photo-${i}`}
                accessibilityLabel="Add photo"
                accessibilityRole="button"
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {loading && i === photos.length ? (
                  <ActivityIndicator size="small" color={c.primary} />
                ) : (
                  <Ionicons name="add" size={28} color={c.textMuted} />
                )}
              </PressableScale>
            )}
          </View>
        );
      })}
    </View>
  );
}

const makePg = (c: ThemeColours) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  slot: {
    width: '30%',
    aspectRatio: 0.85,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: c.border,
    position: 'relative',
  },
  photo: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 11,
  },
  addBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: c.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  primaryText: { color: '#fff' },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

type Section = 'photos' | 'basic' | 'community' | 'career' | 'location' | 'about' | 'prompts' | 'lifestyle' | 'family';

export default function EditProfileScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const ps = React.useMemo(() => makePs(c), [c]);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [expandedSection, setExpandedSection] = useState<Section>('basic');
  const [saving, setSaving] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  });

  // Local form state — only fields user can edit post-onboarding
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [height, setHeight] = useState('');
  const [bio, setBio] = useState('');
  const [religion, setReligion] = useState('');
  const [caste, setCaste] = useState('');
  const [motherTongue, setMotherTongue] = useState('');
  const [profession, setProfession] = useState('');
  const [education, setEducation] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [diet, setDiet] = useState<'vegetarian' | 'non-vegetarian' | 'vegan' | 'jain' | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<PromptPair[]>([]);
  const [promptPickerIdx, setPromptPickerIdx] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate form from loaded profile
  React.useEffect(() => {
    if (profile && !hydrated) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setHeight(profile.height ? String(profile.height) : '');
      setBio(profile.bio || '');
      setReligion(profile.religion || '');
      setCaste(profile.caste || '');
      setMotherTongue(profile.motherTongue || '');
      setProfession(profile.profession || '');
      setEducation(profile.education || '');
      setCity(profile.city || '');
      setState(profile.state || '');
      setDiet(profile.diet || null);
      const allPhotos = profile.profilePhoto
        ? [profile.profilePhoto, ...(profile.photos || []).filter((p) => p !== profile.profilePhoto)]
        : profile.photos || [];
      setPhotos(allPhotos);
      setPrompts(fromProfilePrompts(profile.profilePrompts as Record<string, string> | null));
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Profile>) => updateMyProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      navigation.goBack();
    },
    onError: () => {
      showToast.error('Could not save', 'Your changes were not saved. Please try again.');
    },
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      height: height ? Number(height) : null,
      bio: bio.trim() || null,
      religion: religion.trim() || null,
      caste: caste.trim() || null,
      motherTongue: motherTongue.trim() || null,
      profession: profession.trim() || null,
      education: education.trim() || null,
      city: city.trim(),
      state: state.trim(),
      diet: diet,
      profilePrompts: toProfilePrompts(prompts),
    });
  }, [firstName, lastName, height, bio, religion, caste, motherTongue, profession, education, city, state, diet, prompts, saveMutation]);

  const handleAddPhoto = useCallback(() => {
    // Expo ImagePicker integration — show alert since we can't import without native build
    Alert.alert(
      'Add Photo',
      'Choose source',
      [
        { text: 'Camera', onPress: () => {} },
        { text: 'Gallery', onPress: () => {} },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  const handleRemovePhoto = useCallback((uri: string) => {
    Alert.alert('Remove Photo', 'Remove this photo?', [
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setPhotos((prev) => prev.filter((p) => p !== uri));
          // Backend deletes by photo URL.
          deletePhoto(uri).catch(() => {});
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const toggleSection = (s: Section) =>
    setExpandedSection((prev) => (prev === s ? 'basic' : s));

  if (isLoading) {
    return (
      <View style={styles.loader} testID="EditProfileLoading">
        <EditProfileSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          testID="back-btn"
          accessibilityLabel="Cancel"
          accessibilityRole="button"
          style={styles.headerBtn}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <Text variant="headline" color="textPrimary">Edit Profile</Text>
        <PressableScale
          onPress={handleSave}
          disabled={saveMutation.isPending}
          testID="save-btn"
          accessibilityLabel="Save profile"
          accessibilityRole="button"
          accessibilityState={{ disabled: saveMutation.isPending }}
          style={styles.headerBtn}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <Text variant="headline" color="primary">Save</Text>
          )}
        </PressableScale>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        testID="EditProfileScreen"
      >
        {/* Photos section */}
        <SectionCard
          title="Photos"
          expanded={expandedSection === 'photos'}
          onToggle={() => toggleSection('photos')}
        >
          <PhotoGrid
            photos={photos}
            onAdd={handleAddPhoto}
            onRemove={handleRemovePhoto}
          />
          <Text variant="footnote" color="textMuted" style={styles.photoHint}>
            First photo is your main profile photo. Min 1 required.
          </Text>
        </SectionCard>

        {/* Basic Details */}
        <SectionCard
          title="Basic Details"
          expanded={expandedSection === 'basic'}
          onToggle={() => toggleSection('basic')}
        >
          <FieldEditor
            label="First Name"
            value={firstName}
            onChange={setFirstName}
            textContentType="givenName"
            autoComplete="name-given"
            testID="field-firstName"
          />
          <FieldEditor
            label="Last Name"
            value={lastName}
            onChange={setLastName}
            textContentType="familyName"
            autoComplete="name-family"
            testID="field-lastName"
          />
          <FieldEditor
            label="Height (cm)"
            value={height}
            onChange={setHeight}
            keyboardType="numeric"
            testID="field-height"
          />
        </SectionCard>

        {/* Community */}
        <SectionCard
          title="Community"
          expanded={expandedSection === 'community'}
          onToggle={() => toggleSection('community')}
        >
          <FieldEditor label="Religion" value={religion} onChange={setReligion} testID="field-religion" />
          <FieldEditor label="Caste" value={caste} onChange={setCaste} testID="field-caste" />
          <FieldEditor label="Mother Tongue" value={motherTongue} onChange={setMotherTongue} testID="field-motherTongue" />
        </SectionCard>

        {/* Education & Career */}
        <SectionCard
          title="Education & Career"
          expanded={expandedSection === 'career'}
          onToggle={() => toggleSection('career')}
        >
          <FieldEditor label="Education" value={education} onChange={setEducation} testID="field-education" />
          <FieldEditor label="Profession" value={profession} onChange={setProfession} testID="field-profession" />
        </SectionCard>

        {/* Location */}
        <SectionCard
          title="Location"
          expanded={expandedSection === 'location'}
          onToggle={() => toggleSection('location')}
        >
          <FieldEditor label="City" value={city} onChange={setCity} textContentType="addressCity" autoComplete="postal-address-locality" testID="field-city" />
          <FieldEditor label="State" value={state} onChange={setState} textContentType="addressState" autoComplete="postal-address-region" testID="field-state" />
        </SectionCard>

        {/* About Me */}
        <SectionCard
          title="About Me"
          expanded={expandedSection === 'about'}
          onToggle={() => toggleSection('about')}
        >
          <FieldEditor
            label="Bio"
            value={bio}
            onChange={setBio}
            multiline
            maxLength={500}
            testID="field-bio"
          />
        </SectionCard>

        {/* Prompts — "Get to know me" Q&As shown between photos on the story */}
        <SectionCard
          title="Prompts"
          expanded={expandedSection === 'prompts'}
          onToggle={() => toggleSection('prompts')}
        >
          <Text variant="footnote" color="textMuted" style={ps.hint}>
            Answer up to three prompts — they appear on your profile between your photos and give
            matches something real to start from.
          </Text>
          {[0, 1, 2].map((i) => {
            const pair = prompts[i];
            return (
              <View key={i} style={ps.slot}>
                <PressableScale
                  style={ps.promptBtn}
                  onPress={() => setPromptPickerIdx(i)}
                  testID={`prompt-select-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={pair?.prompt ?? 'Choose a prompt'}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text
                    variant={pair?.prompt ? 'subhead' : 'footnote'}
                    color={pair?.prompt ? 'textPrimary' : 'textMuted'}
                    style={ps.promptText}
                    numberOfLines={1}
                  >
                    {pair?.prompt ?? 'Choose a prompt…'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={c.textMuted} />
                </PressableScale>
                {pair?.prompt ? (
                  <FieldEditor
                    label="Your answer"
                    value={pair.answer}
                    onChange={(text) =>
                      setPrompts((prev) => {
                        const next = [...prev];
                        next[i] = { prompt: pair.prompt, answer: text };
                        return next;
                      })
                    }
                    multiline
                    maxLength={280}
                    testID={`prompt-answer-${i}`}
                  />
                ) : null}
              </View>
            );
          })}
        </SectionCard>

        {/* Lifestyle */}
        <SectionCard
          title="Lifestyle"
          expanded={expandedSection === 'lifestyle'}
          onToggle={() => toggleSection('lifestyle')}
        >
          <SelectPill
            label="Diet"
            options={[
              { key: 'vegetarian', label: 'Vegetarian' },
              { key: 'non-vegetarian', label: 'Non-Veg' },
              { key: 'jain', label: 'Jain' },
              { key: 'vegan', label: 'Vegan' },
            ]}
            selected={diet}
            onSelect={setDiet}
            testPrefix="diet"
          />
        </SectionCard>

        <View style={{ height: 40 }} />
      </ScrollView>

      <PickerSheet
        visible={promptPickerIdx !== null}
        title="Choose a prompt"
        options={PROFILE_PROMPTS.filter(
          (opt) => !prompts.some((p2, j) => j !== promptPickerIdx && p2?.prompt === opt),
        )}
        selected={promptPickerIdx !== null ? prompts[promptPickerIdx]?.prompt ?? null : null}
        onSelect={(val) => {
          if (promptPickerIdx === null) return;
          setPrompts((prev) => {
            const next = [...prev];
            next[promptPickerIdx] = { prompt: String(val), answer: next[promptPickerIdx]?.answer ?? '' };
            return next;
          });
        }}
        onClose={() => setPromptPickerIdx(null)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: c.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.background,
  },
  headerBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  photoHint: {
    marginTop: spacing.sm,
  },
});

const makePs = (c: ThemeColours) => StyleSheet.create({
  hint: {
    marginBottom: spacing.md,
  },
  slot: { marginBottom: spacing.md },
  promptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    marginBottom: spacing.sm,
  },
  promptText: { flex: 1 },
});
