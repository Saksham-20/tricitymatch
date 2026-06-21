import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
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
  testID?: string;
}

function FieldEditor({
  label, value, onChange, multiline, maxLength, keyboardType = 'default', testID,
}: FieldEditorProps) {
  return (
    <View style={fe.container}>
      <Text style={fe.label}>{label}</Text>
      <TextInput
        style={[fe.input, multiline && fe.inputMulti]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        maxLength={maxLength}
        keyboardType={keyboardType}
        testID={testID ?? `field-${label}`}
        accessibilityLabel={label}
        placeholderTextColor={colours.textMuted}
        placeholder={`Enter ${label.toLowerCase()}`}
      />
      {maxLength && (
        <Text style={fe.counter}>{value.length}/{maxLength}</Text>
      )}
    </View>
  );
}

const fe = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    fontFamily: typography.fontFamily.regular,
    backgroundColor: colours.background,
    minHeight: 48,
  },
  inputMulti: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  counter: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    textAlign: 'right',
    marginTop: 4,
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
  return (
    <View style={sp.container}>
      <Text style={sp.label}>{label}</Text>
      <View style={sp.row}>
        {options.map((opt) => {
          const active = selected === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[sp.pill, active && sp.pillActive]}
              onPress={() => onSelect(opt.key)}
              testID={`${testPrefix}-${opt.key}`}
              accessibilityLabel={opt.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[sp.pillText, active && sp.pillTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const sp = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textSecondary,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.background,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { borderColor: colours.primary, backgroundColor: colours.primaryLight },
  pillText: { fontSize: typography.fontSize.sm, color: colours.textSecondary },
  pillTextActive: { color: colours.primary, fontFamily: typography.fontFamily.medium },
});

// ─── Section Card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}

function SectionCard({ title, children, expanded, onToggle }: SectionCardProps) {
  return (
    <View style={sc.card}>
      <TouchableOpacity
        style={sc.header}
        onPress={onToggle}
        testID={`section-${title}`}
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={sc.title}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colours.textMuted} />
      </TouchableOpacity>
      {expanded && <View style={sc.body}>{children}</View>}
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colours.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
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
                  <TouchableOpacity
                    style={pg.removeBtn}
                    onPress={() => onRemove(uri)}
                    testID={`remove-photo-${i}`}
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close-circle" size={22} color={colours.error} />
                  </TouchableOpacity>
                )}
                {i === 0 && (
                  <View style={pg.primaryBadge}>
                    <Text style={pg.primaryText}>Main</Text>
                  </View>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={pg.addBtn}
                onPress={onAdd}
                disabled={loading}
                testID={`add-photo-${i}`}
                accessibilityLabel="Add photo"
              >
                {loading && i === photos.length ? (
                  <ActivityIndicator size="small" color={colours.primary} />
                ) : (
                  <Ionicons name="add" size={28} color={colours.textMuted} />
                )}
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const pg = StyleSheet.create({
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
    backgroundColor: colours.border,
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
    borderColor: colours.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colours.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  primaryText: { fontSize: 10, color: '#fff', fontFamily: typography.fontFamily.semiBold },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

type Section = 'photos' | 'basic' | 'community' | 'career' | 'location' | 'about' | 'lifestyle' | 'family';

export default function EditProfileScreen() {
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
      Alert.alert('Error', 'Could not save profile. Please try again.');
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
    });
  }, [firstName, lastName, height, bio, religion, caste, motherTongue, profession, education, city, state, diet, saveMutation]);

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
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colours.primary} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          testID="back-btn"
          accessibilityLabel="Cancel"
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saveMutation.isPending}
          testID="save-btn"
          accessibilityLabel="Save profile"
          style={styles.headerBtn}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator size="small" color={colours.primary} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
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
          <Text style={styles.photoHint}>
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
            testID="field-firstName"
          />
          <FieldEditor
            label="Last Name"
            value={lastName}
            onChange={setLastName}
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
          <FieldEditor label="City" value={city} onChange={setCity} testID="field-city" />
          <FieldEditor label="State" value={state} onChange={setState} testID="field-state" />
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
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colours.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
    backgroundColor: colours.background,
  },
  headerBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  saveText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.primary,
  },

  photoHint: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    marginTop: spacing.sm,
    fontFamily: typography.fontFamily.regular,
  },
});
