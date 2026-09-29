import React, { useState, useCallback, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  AccessibilityInfo,
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Screen from '../../components/layout/Screen';
import SmartImage from '../../components/common/SmartImage';
import type { TextInputProps } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, ScreenHeader, SkeletonBlock } from '../../components/ui';
import { showToast } from '../../utils/toast';
import { tapSize } from '../../utils/elderTheme';
import PickerSheet from '../../components/ui/PickerSheet';
import { PressableScale } from '../../components/motion';
import { PROFILE_PROMPTS, PromptPair, fromProfilePrompts, toProfilePrompts } from '../../constants/prompts';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { getMyProfile, updateMyProfile, uploadPhoto, deletePhoto } from '../../api/profile';
import { queryKeys } from '../../constants/queryKeys';
import { refreshProfileCaches } from '../../utils/profileCache';
import type { MainStackParamList } from '../../navigation/types';
import type { Profile } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const MAX_PHOTOS = 6;

// Mirrors backend/validators/index.js `updateProfileValidation`, so a value the
// server would refuse is caught on the field instead of surfacing as a vague
// "could not save" after the round trip.
const NAME_RE = /^(?:[A-Za-zÀ-ÖØ-öø-ÿ]|[ऀ-ॣ]|[ॱ-ॿ]|[ਁ-੥]|[ੰ-ੵ]|[\s'’.-]|‌|‍)+$/;
const HEIGHT_MIN_CM = 100;
const HEIGHT_MAX_CM = 250;

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'height', string>>;

// One rule per field, shared by the blur check and the Save check so the two
// can never disagree.
const firstNameError = (value: string): string | undefined => {
  const fn = value.trim();
  if (fn.length < 2 || fn.length > 50) return 'Enter your first name (2 to 50 letters).';
  if (!NAME_RE.test(fn)) return 'Use letters only (English, Hindi or Punjabi).';
  return undefined;
};

// A blank last name is left out of the save payload; one that is filled in has
// to be valid.
const lastNameError = (value: string): string | undefined => {
  const ln = value.trim();
  if (!ln) return undefined;
  if (ln.length < 2 || ln.length > 50) return 'Last name must be 2 to 50 letters.';
  if (!NAME_RE.test(ln)) return 'Use letters only (English, Hindi or Punjabi).';
  return undefined;
};

const heightError = (value: string): string | undefined => {
  const h = value.trim();
  if (!h) return undefined;
  const n = Number(h);
  if (!Number.isInteger(n) || n < HEIGHT_MIN_CM || n > HEIGHT_MAX_CM) {
    return `Enter your height in cm, between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM}.`;
  }
  return undefined;
};

/**
 * The editable text/choice fields as one comparable string. The form is "dirty"
 * when this differs from the snapshot taken as it hydrated. Strings are trimmed
 * (a trailing space is not a change worth a Discard prompt) and prompts go
 * through the same flattening the save uses, so an empty slot and a missing slot
 * compare equal. Photos are not part of it: they save the moment they change.
 */
const formSnapshot = (f: {
  firstName: string; lastName: string; height: string; bio: string; religion: string;
  caste: string; motherTongue: string; profession: string; education: string;
  city: string; state: string; diet: string | null; prompts: PromptPair[];
}): string =>
  JSON.stringify([
    f.firstName.trim(), f.lastName.trim(), f.height.trim(), f.bio.trim(), f.religion.trim(),
    f.caste.trim(), f.motherTongue.trim(), f.profession.trim(), f.education.trim(),
    // `filter(Boolean)` also drops the holes left when slot 2 is chosen before
    // slot 1 (`next[1] = …` on an empty array); `toProfilePrompts` would throw on one.
    f.city.trim(), f.state.trim(), f.diet, toProfilePrompts(f.prompts.filter(Boolean)),
  ]);

const serverMessage = (err: unknown): string | undefined => {
  const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
  return data?.error?.message ?? data?.message;
};

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
  error?: string;
  /** Runs when the field loses focus (validation lives with the caller). */
  onBlur?: () => void;
  /** Overrides the screen-reader name when several fields share one visible label. */
  a11yLabel?: string;
  testID?: string;
}

function FieldEditor({
  label, value, onChange, multiline, maxLength, keyboardType = 'default',
  textContentType, autoComplete, autoCapitalize, error, onBlur, a11yLabel, testID,
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
      onBlur={onBlur}
      testID={testID ?? `field-${label}`}
      accessibilityLabel={a11yLabel ?? label}
      placeholder={`Enter ${label.toLowerCase()}`}
      error={error}
      helper={maxLength ? `${value.length}/${maxLength}` : undefined}
      style={multiline ? feStyles.inputMulti : undefined}
    />
  );
}

// `minHeight`, not `height`: at a large OS text size a fixed box would clip the
// text the member is typing.
const feStyles = StyleSheet.create({
  inputMulti: {
    minHeight: 100,
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
  const { c, elder } = useTheme();
  const sp = React.useMemo(() => makeSp(c), [c]);
  return (
    <View style={sp.container}>
      <Text variant="subhead" color="textSecondary" style={sp.label}>{label}</Text>
      <View style={sp.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((opt) => {
          const active = selected === opt.key;
          return (
            <PressableScale
              key={opt.key}
              style={[sp.pill, { minHeight: tapSize(elder) }, active && sp.pillActive]}
              onPress={() => onSelect(opt.key)}
              haptic
              testID={`${testPrefix}-${opt.key}`}
              accessibilityLabel={opt.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
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
  onLayoutY?: (y: number) => void;
}

function SectionCard({ title, children, expanded, onToggle, onLayoutY }: SectionCardProps) {
  const { c, elder } = useTheme();
  const sc = React.useMemo(() => makeSc(c), [c]);
  return (
    <View style={sc.card} onLayout={onLayoutY ? (e) => onLayoutY(e.nativeEvent.layout.y) : undefined}>
      <PressableScale
        style={[sc.header, { minHeight: tapSize(elder) }]}
        onPress={onToggle}
        testID={`section-${title}`}
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text variant="headline" color="textPrimary" style={sc.title}>{title}</Text>
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
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: { flex: 1 },
  body: { padding: spacing.lg, paddingTop: 0 },
});

// ─── Photo Grid ───────────────────────────────────────────────────────────────

interface PhotoGridProps {
  photos: string[];
  name: string;
  onAdd: () => void;
  onRemove: (uri: string) => void;
  uploading?: boolean;
}

function PhotoGrid({ photos, name, onAdd, onRemove, uploading }: PhotoGridProps) {
  const { c, elder } = useTheme();
  const pg = React.useMemo(() => makePg(c), [c]);
  const tap = tapSize(elder);
  const slots = Array.from({ length: MAX_PHOTOS });
  return (
    <View style={pg.grid}>
      {slots.map((_, i) => {
        const uri = photos[i];
        return (
          <View key={i} style={pg.slot}>
            {uri ? (
              <>
                <View
                  style={StyleSheet.absoluteFill}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={i === 0 ? 'Main profile photo' : `Photo ${i + 1}`}
                >
                  <SmartImage uri={uri} name={name} style={pg.photo} initialSize={36} />
                </View>
                {i > 0 && (
                  // A 44pt corner target around a 22pt mark: the box is the
                  // control, the chip is only its face.
                  <PressableScale
                    scaleTo={0.92}
                    style={[pg.removeBtn, { width: tap, height: tap }]}
                    onPress={() => onRemove(uri)}
                    testID={`remove-photo-${i}`}
                    accessibilityLabel={`Remove photo ${i + 1}`}
                    accessibilityRole="button"
                    pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <View style={pg.removeChip}>
                      <Ionicons name="close-circle" size={22} color={c.error} />
                    </View>
                  </PressableScale>
                )}
                {i === 0 && (
                  <View style={pg.primaryBadge}>
                    <Text variant="micro" color="onPrimary">Main</Text>
                  </View>
                )}
              </>
            ) : (
              <PressableScale
                style={pg.addBtn}
                onPress={onAdd}
                disabled={uploading}
                testID={`add-photo-${i}`}
                accessibilityLabel="Add photo"
                accessibilityRole="button"
                accessibilityState={{ disabled: !!uploading, busy: !!uploading && i === photos.length }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {uploading && i === photos.length ? (
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
    top: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // White chip so the red mark reads on any photo, in either theme.
  removeChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: c.p500,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});

// ─── Loading ─────────────────────────────────────────────────────────────────
// Shaped like the screen's real first paint: a collapsed Photos row, Basic
// Details open with three fields, then the collapsed section rows.

function EditProfileLoading() {
  return (
    // One busy element for a screen reader: without it the header is followed by
    // silence until the form appears.
    <View
      style={sk.wrap}
      testID="EditProfileLoading-body"
      accessible
      accessibilityLabel="Loading your profile"
      accessibilityState={{ busy: true }}
    >
      <SkeletonBlock height={56} radius={borderRadius.md} />
      <View style={sk.card}>
        <SkeletonBlock width="40%" height={20} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={sk.field}>
            <SkeletonBlock width="28%" height={13} />
            <SkeletonBlock height={50} radius={borderRadius.md} style={sk.gapSm} />
          </View>
        ))}
      </View>
      {[0, 1, 2, 3, 4].map((i) => (
        <SkeletonBlock key={i} height={56} radius={borderRadius.md} />
      ))}
    </View>
  );
}

// Layout only, no colour.
const sk = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.md, paddingVertical: spacing.sm },
  field: { marginTop: spacing.sm },
  gapSm: { marginTop: spacing.sm },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

type Section = 'photos' | 'basic' | 'community' | 'career' | 'location' | 'about' | 'prompts' | 'lifestyle' | 'family';

// OwnProfile opens this screen on the section whose pencil was tapped. The
// param is not yet declared on `MainStackParamList` (`EditProfile: undefined`,
// navigation/types.ts), so it is typed here; params reach the route at runtime
// regardless of that declaration.
type EditProfileRoute = RouteProp<{ EditProfile: { section?: Section } | undefined }, 'EditProfile'>;

export default function EditProfileScreen() {
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const ps = React.useMemo(() => makePs(c), [c]);
  const tap = tapSize(elder);
  const navigation = useNavigation<Nav>();
  const route = useRoute<EditProfileRoute>();
  const requestedSection = route.params?.section;
  const [expandedSection, setExpandedSection] = useState<Section | null>(requestedSection ?? 'basic');
  const scrollRef = useRef<ScrollView>(null);
  // A section further down the list has to be scrolled to once it has laid out.
  const pendingScroll = useRef<Section | null>(
    requestedSection && requestedSection !== 'basic' ? requestedSection : null,
  );
  const onSectionLayout = (id: Section) => (y: number) => {
    if (pendingScroll.current !== id) return;
    pendingScroll.current = null;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.sm), animated: false });
  };

  const { data: profile, isLoading, refetch } = useQuery({
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
  /** `formSnapshot` of the values the form opened with; null until hydrated. */
  const [baseline, setBaseline] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const clearError = (key: keyof FieldErrors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  // Hydrate form from loaded profile
  React.useEffect(() => {
    if (profile && !hydrated) {
      const initial = {
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        height: profile.height ? String(profile.height) : '',
        bio: profile.bio || '',
        religion: profile.religion || '',
        caste: profile.caste || '',
        motherTongue: profile.motherTongue || '',
        profession: profile.profession || '',
        education: profile.education || '',
        city: profile.city || '',
        state: profile.state || '',
        diet: (profile.diet || null) as typeof diet,
        prompts: fromProfilePrompts(profile.profilePrompts as Record<string, string> | null),
      };
      setFirstName(initial.firstName);
      setLastName(initial.lastName);
      setHeight(initial.height);
      setBio(initial.bio);
      setReligion(initial.religion);
      setCaste(initial.caste);
      setMotherTongue(initial.motherTongue);
      setProfession(initial.profession);
      setEducation(initial.education);
      setCity(initial.city);
      setState(initial.state);
      setDiet(initial.diet);
      const allPhotos = profile.profilePhoto
        ? [profile.profilePhoto, ...(profile.photos || []).filter((p) => p !== profile.profilePhoto)]
        : profile.photos || [];
      setPhotos(allPhotos);
      setPrompts(initial.prompts);
      setBaseline(formSnapshot(initial));
      setHydrated(true);
    }
  }, [profile, hydrated]);

  // getMyProfile is cached under two keys; utils/profileCache refreshes both.
  const refreshProfile = refreshProfileCaches;

  // Unsaved-changes guard. Leaving with edited fields would silently discard,
  // say, a 500-character bio. Set just before the post-save goBack so a
  // successful save is not asked to confirm its own exit.
  const dirty =
    baseline !== null &&
    formSnapshot({ firstName, lastName, height, bio, religion, caste, motherTongue, profession, education, city, state, diet, prompts }) !== baseline;
  const dirtyRef = useRef(false);
  const skipGuardRef = useRef(false);
  React.useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  React.useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (skipGuardRef.current || !dirtyRef.current) return;
      e.preventDefault();
      // The one Alert this screen keeps besides removing a photo: a destructive
      // confirmation (ruling 22).
      Alert.alert('Discard changes?', 'You have unsaved changes to your profile details.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [navigation]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Profile>) => updateMyProfile(data),
    onSuccess: () => {
      refreshProfile();
      skipGuardRef.current = true;
      navigation.goBack();
    },
    onError: (err: unknown) => {
      showToast.error('Could not save', serverMessage(err) ?? 'Your changes were not saved. Please try again.');
    },
  });

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const fe = firstNameError(firstName);
    const le = lastNameError(lastName);
    const he = heightError(height);
    if (fe) next.firstName = fe;
    if (le) next.lastName = le;
    if (he) next.height = he;
    return next;
  };

  // Validate when the member leaves a field, not only when they press Save. The
  // message is spoken too: the error text appears without a tap.
  const checkOnBlur = (key: keyof FieldErrors, message: string | undefined) => {
    if (errors[key] === message) return;
    setErrors((prev) => ({ ...prev, [key]: message }));
    if (message) AccessibilityInfo.announceForAccessibility(message);
  };

  const handleSave = useCallback(() => {
    const found = validate();
    setErrors(found);
    const first = Object.values(found).find(Boolean);
    if (first) {
      // Name and height live in Basic Details; make sure the field is on screen.
      setExpandedSection('basic');
      showToast.error('Check your details', first);
      AccessibilityInfo.announceForAccessibility(first);
      return;
    }
    const ln = lastName.trim();
    saveMutation.mutate({
      firstName: firstName.trim(),
      // '' fails the server's 2-character minimum; omitting it leaves the stored value alone.
      ...(ln ? { lastName: ln } : {}),
      height: height.trim() ? Number(height) : null,
      bio: bio.trim() || null,
      religion: religion.trim() || null,
      caste: caste.trim() || null,
      motherTongue: motherTongue.trim() || null,
      profession: profession.trim() || null,
      education: education.trim() || null,
      city: city.trim(),
      state: state.trim(),
      diet: diet,
      profilePrompts: toProfilePrompts(prompts.filter(Boolean)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, height, bio, religion, caste, motherTongue, profession, education, city, state, diet, prompts, saveMutation]);

  // Photo changes are saved as they happen (the server appends on upload and
  // removes on delete), independent of the Save button.
  const handleAddPhoto = useCallback(async () => {
    if (uploading || photos.length >= MAX_PHOTOS) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [4, 5],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const formData = new FormData();
      formData.append('photos', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: `photo_${photos.length}.jpg`,
      } as unknown as Blob);
      const { url } = await uploadPhoto(formData, 'photos');
      if (url) setPhotos((prev) => (prev.includes(url) ? prev : [...prev, url]));
      refreshProfile();
      showToast.success('Photo added');
      AccessibilityInfo.announceForAccessibility('Photo added');
    } catch (err) {
      showToast.error('Could not add photo', serverMessage(err) ?? 'Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }, [uploading, photos.length, refreshProfile]);

  const handleRemovePhoto = useCallback((uri: string) => {
    const index = photos.indexOf(uri);
    Alert.alert('Remove photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotos((prev) => prev.filter((p) => p !== uri));
          try {
            // Backend deletes by photo URL.
            await deletePhoto(uri);
            refreshProfile();
            AccessibilityInfo.announceForAccessibility('Photo removed');
          } catch (err) {
            // Put it back where it was: the server still has it.
            setPhotos((prev) => {
              if (prev.includes(uri)) return prev;
              const next = [...prev];
              next.splice(Math.min(Math.max(index, 0), next.length), 0, uri);
              return next;
            });
            showToast.error('Could not remove photo', serverMessage(err) ?? 'Please try again.');
          }
        },
      },
    ]);
  }, [photos, refreshProfile]);

  const toggleSection = (s: Section) =>
    setExpandedSection((prev) => (prev === s ? null : s));

  if (isLoading) {
    return (
      <Screen edges={['top']} testID="EditProfileLoading">
        <ScreenHeader title="Edit profile" />
        <EditProfileLoading />
      </Screen>
    );
  }

  // Nothing to edit: the load failed (or is paused offline) and no cached profile
  // exists. The form must never fall through to blank editable fields, and a Save
  // from that state would overwrite the real profile with empty strings. A failed
  // background refetch with a cached profile still renders the form below.
  if (!profile) {
    return (
      <Screen edges={['top']} style={styles.wrapper}>
        <ScreenHeader title="Edit profile" />
        <View style={styles.errorBody}>
          <EmptyState
            variant="error"
            icon="person-circle-outline"
            title="Couldn't load your profile"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => refetch()}
            testID="EditProfileScreen-error"
          />
        </View>
      </Screen>
    );
  }

  const saveControl = (
    <PressableScale
      onPress={handleSave}
      disabled={saveMutation.isPending}
      testID="save-btn"
      accessibilityLabel="Save profile"
      accessibilityRole="button"
      accessibilityState={{ disabled: saveMutation.isPending, busy: saveMutation.isPending }}
      style={{ minWidth: tap, minHeight: tap, alignItems: 'center', justifyContent: 'center' }}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {saveMutation.isPending ? (
        <ActivityIndicator size="small" color={c.primary} />
      ) : (
        <Text variant="headline" color="primary">Save</Text>
      )}
    </PressableScale>
  );

  return (
    <Screen edges={['top']} keyboard style={styles.wrapper}>
      <ScreenHeader title="Edit profile" right={saveControl} />

      <ScrollView
        ref={scrollRef}
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
          onLayoutY={onSectionLayout('photos')}
        >
          <PhotoGrid
            photos={photos}
            name={firstName}
            onAdd={handleAddPhoto}
            onRemove={handleRemovePhoto}
            uploading={uploading}
          />
          <Text variant="footnote" color="textSecondary" style={styles.photoHint}>
            First photo is your main profile photo. Min 1 required.
          </Text>
        </SectionCard>

        {/* Basic Details */}
        <SectionCard
          title="Basic details"
          expanded={expandedSection === 'basic'}
          onToggle={() => toggleSection('basic')}
        >
          <FieldEditor
            label="First name"
            value={firstName}
            onChange={(v) => { setFirstName(v); clearError('firstName'); }}
            textContentType="givenName"
            autoComplete="name-given"
            error={errors.firstName}
            onBlur={() => checkOnBlur('firstName', firstNameError(firstName))}
            testID="field-firstName"
          />
          <FieldEditor
            label="Last name"
            value={lastName}
            onChange={(v) => { setLastName(v); clearError('lastName'); }}
            textContentType="familyName"
            autoComplete="name-family"
            error={errors.lastName}
            onBlur={() => checkOnBlur('lastName', lastNameError(lastName))}
            testID="field-lastName"
          />
          <FieldEditor
            label="Height (cm)"
            value={height}
            onChange={(v) => { setHeight(v); clearError('height'); }}
            keyboardType="numeric"
            error={errors.height}
            onBlur={() => checkOnBlur('height', heightError(height))}
            testID="field-height"
          />
        </SectionCard>

        {/* Community */}
        <SectionCard
          title="Community"
          expanded={expandedSection === 'community'}
          onToggle={() => toggleSection('community')}
          onLayoutY={onSectionLayout('community')}
        >
          <FieldEditor label="Religion" value={religion} onChange={setReligion} testID="field-religion" />
          <FieldEditor label="Caste" value={caste} onChange={setCaste} testID="field-caste" />
          <FieldEditor label="Mother tongue" value={motherTongue} onChange={setMotherTongue} testID="field-motherTongue" />
        </SectionCard>

        {/* Education & Career */}
        <SectionCard
          title="Education & career"
          expanded={expandedSection === 'career'}
          onToggle={() => toggleSection('career')}
          onLayoutY={onSectionLayout('career')}
        >
          <FieldEditor label="Education" value={education} onChange={setEducation} testID="field-education" />
          <FieldEditor label="Profession" value={profession} onChange={setProfession} testID="field-profession" />
        </SectionCard>

        {/* Location */}
        <SectionCard
          title="Location"
          expanded={expandedSection === 'location'}
          onToggle={() => toggleSection('location')}
          onLayoutY={onSectionLayout('location')}
        >
          <FieldEditor label="City" value={city} onChange={setCity} textContentType="addressCity" autoComplete="postal-address-locality" testID="field-city" />
          <FieldEditor label="State" value={state} onChange={setState} textContentType="addressState" autoComplete="postal-address-region" testID="field-state" />
        </SectionCard>

        {/* About Me */}
        <SectionCard
          title="About me"
          expanded={expandedSection === 'about'}
          onToggle={() => toggleSection('about')}
          onLayoutY={onSectionLayout('about')}
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
          onLayoutY={onSectionLayout('prompts')}
        >
          <Text variant="footnote" color="textSecondary" style={ps.hint}>
            Answer up to three prompts. They appear on your profile between your photos and give
            matches something real to start from.
          </Text>
          {[0, 1, 2].map((i) => {
            const pair = prompts[i];
            return (
              <View key={i} style={ps.slot}>
                <PressableScale
                  style={[ps.promptBtn, { minHeight: Math.max(48, tap) }]}
                  onPress={() => setPromptPickerIdx(i)}
                  testID={`prompt-select-${i}`}
                  accessibilityRole="button"
                  // Starts with the visible text (Voice Control) and says which of the
                  // three slots this is, so they are not three identical buttons.
                  accessibilityLabel={
                    pair?.prompt ? `${pair.prompt}, prompt ${i + 1}` : `Choose a prompt, slot ${i + 1}`
                  }
                  accessibilityHint="Opens the prompt list"
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text
                    variant={pair?.prompt ? 'subhead' : 'footnote'}
                    color={pair?.prompt ? 'textPrimary' : 'textSecondary'}
                    style={ps.promptText}
                    numberOfLines={2}
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
                    a11yLabel={`Your answer, prompt ${i + 1}`}
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
          onLayoutY={onSectionLayout('lifestyle')}
        >
          <SelectPill
            label="Diet"
            options={[
              { key: 'vegetarian', label: 'Vegetarian' },
              { key: 'non-vegetarian', label: 'Non-veg' },
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
    </Screen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: c.background },
  errorBody: { flex: 1, justifyContent: 'center' },
  container: { flex: 1 },

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
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  promptText: { flex: 1 },
});
