import React, { useRef, useState } from 'react';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { useBiodataShare } from '../../hooks/useBiodataShare';
import {
  AccessibilityInfo,
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  useWindowDimensions,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import SmartImage, { resolveImageUri } from '../../components/common/SmartImage';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PLANS } from '@shared/constants/plans';
import { CompletionRing as SharedCompletionRing, EmptyState, SkeletonBlock } from '../../components/ui';
import { PressableScale, StaggeredEntrance, useReduceMotion } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';
import { showToast } from '../../utils/toast';
import { getMyProfile, getProfileViewers, getRecentlyViewed } from '../../api/profile';
import { getPhotoVerification } from '../../api/verification';
import { formatDate } from '../../utils/dateUtils';
import { queryKeys } from '../../constants/queryKeys';
import { LIST_PERF } from '../../constants/listPerf';
import { useOnboarding } from '../onboarding/OnboardingContext';
import { useAuthStore } from '../../stores/authStore';
import { toProfileCode } from '../../utils/profileCode';
import type { MainStackParamList } from '../../navigation/types';
import type { Profile, ProfileSummary } from '../../types';
import VoiceIntroRecorder from '../../components/profile/VoiceIntroRecorder';
import VerificationBadges from '../../components/profile/VerificationBadges';

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** The sections EditProfile can open on (see EditProfileScreen's `Section`). */
type EditSection = 'photos' | 'basic' | 'community' | 'career' | 'location' | 'about' | 'lifestyle';

/** A decorative glyph: the screen reader skips it and reads the text beside it. */
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** Raw enum values ("never_married", "non-vegetarian") read as labels. */
const humanize = (v?: string | null): string | null =>
  v ? v.replace(/_/g, ' ').replace(/^./, (ch) => ch.toUpperCase()) : null;

/** Same two-branch reading as the website: under a lakh reads in thousands, never "0.5L". */
const formatIncome = (income?: number | null): string | null => {
  if (!income) return null;
  return income >= 100000 ? `₹${(income / 100000).toFixed(1)}L/yr` : `₹${Math.round(income / 1000)}K/yr`;
};

// ─── Activity Rail (Visitors / Recently Viewed) ──────────────────────────────

function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

interface ActivityRailProps {
  title: string;
  profiles: ProfileSummary[];
  onPressProfile: (userId: string) => void;
  /** Skeleton row while the first fetch is in flight. */
  loading?: boolean;
  /** The fetch failed and nothing is cached. */
  error?: boolean;
  onRetry?: () => void;
  /** One honest line for "loaded, and there is nothing". Omit to hide an empty rail. */
  emptyText?: string;
}

function ActivityRail({
  title,
  profiles,
  onPressProfile,
  loading = false,
  error = false,
  onRetry,
  emptyText,
}: ActivityRailProps) {
  const { c, elder } = useTheme();
  const ar = React.useMemo(() => makeAr(c), [c]);
  const heading = (
    <Text variant="headline" color="fgStrong" style={ar.heading} accessibilityRole="header">{title}</Text>
  );

  if (loading) {
    return (
      <View style={ar.section} testID={`activity-loading-${title}`}>
        {heading}
        <View style={ar.list}>
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} width={88} height={88} radius={borderRadius.md} />
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={ar.section}>
        {heading}
        <View style={ar.inlineRow}>
          <Ionicons name="cloud-offline-outline" size={18} color={c.textSecondary} {...HIDE_FROM_A11Y} />
          <Text variant="footnote" color="textSecondary" style={ar.inlineText}>Couldn't load this right now.</Text>
          {onRetry ? (
            <PressableScale
              style={[ar.retryBtn, { minHeight: tapSize(elder) }]}
              onPress={onRetry}
              testID={`activity-retry-${title}`}
              accessibilityRole="button"
              accessibilityLabel={`Try loading ${title} again`}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="subhead" color="primary">Try again</Text>
            </PressableScale>
          ) : null}
        </View>
      </View>
    );
  }

  if (profiles.length === 0) {
    if (!emptyText) return null;
    return (
      <View style={ar.section}>
        {heading}
        <View style={ar.inlineRow}>
          <Ionicons name="eye-outline" size={18} color={c.textSecondary} {...HIDE_FROM_A11Y} />
          <Text variant="footnote" color="textSecondary" style={ar.inlineText}>{emptyText}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={ar.section}>
      {heading}
      <FlatList
        horizontal
        data={profiles}
        keyExtractor={(p) => p.userId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ar.list}
        {...LIST_PERF}
        renderItem={({ item }) => {
          const age = ageFromDob(item.dateOfBirth);
          const name = `${item.firstName} ${item.lastName ?? ''}`.trim();
          return (
            <PressableScale
              style={ar.card}
              onPress={() => onPressProfile(item.userId)}
              testID={`activity-card-${item.userId}`}
              accessibilityLabel={`View ${name}`}
              accessibilityRole="button"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <SmartImage uri={item.profilePhoto} name={item.firstName} style={[ar.avatar, { backgroundColor: c.surface2 }]} initialSize={28} />
              <Text variant="caption" color="textPrimary" style={ar.name} numberOfLines={1}>{item.firstName}</Text>
              <Text variant="footnote" color="textSecondary" style={ar.meta} numberOfLines={1}>
                {[age ? `${age}` : null, item.city].filter(Boolean).join(' · ')}
              </Text>
            </PressableScale>
          );
        }}
      />
    </View>
  );
}

function ViewersUpsell({ onUpgrade }: { onUpgrade: () => void }) {
  const { c } = useTheme();
  const ar = React.useMemo(() => makeAr(c), [c]);
  return (
    <View style={ar.section}>
      <Text variant="headline" color="fgStrong" style={ar.heading} accessibilityRole="header">Profile visitors</Text>
      <PressableScale
        style={[ar.upsell, { backgroundColor: c.accentSoft, borderColor: c.primary + '40' }]}
        onPress={onUpgrade}
        testID="viewers-upsell"
        accessibilityLabel="Upgrade to see who viewed you"
        accessibilityRole="button"
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="eye-outline" size={20} color={c.primary} />
        <View style={ar.upsellText}>
          <Text variant="caption" color="textPrimary" style={ar.upsellTitle}>See who viewed your profile</Text>
          <Text variant="footnote" color="textSecondary" style={ar.upsellSub}>Upgrade to Premium to unlock visitors</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </PressableScale>
    </View>
  );
}

const makeAr = (c: ThemeColours) => StyleSheet.create({
  section: { marginBottom: spacing.lg },
  heading: {
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, flexDirection: 'row' },
  card: { width: 88, alignItems: 'center' },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.md,
    backgroundColor: c.surfaceCard,
    marginBottom: 6,
  },
  name: {},
  meta: {},
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  inlineText: { flex: 1 },
  retryBtn: { justifyContent: 'center', paddingHorizontal: spacing.sm },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    backgroundColor: c.primaryLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.primary + '40',
  },
  upsellText: { flex: 1 },
  upsellTitle: {},
  upsellSub: {},
});

// ─── Completion Card ──────────────────────────────────────────────────────────
// One card = ring + the specific fields still missing, each tappable to the
// place that can actually fill it in. Replaces the old three-part stack (ring +
// generic CTA + a fixed milestone strip whose 70% tip still told members to
// "Upload Kundli" — a feature that was removed). Shows exactly what to do next,
// Shaadi/Jeevansathi style, instead of an abstract percentage.

/**
 * Where a nudge sends the member. A section name opens EditProfile on that
 * section; 'journey' resumes the profile questions (`useOnboarding().start`),
 * which is where marital status is collected. Only fields one of those two
 * places can complete are nudged: EditProfile has no marital status, income or
 * interest-tag field, and the journey never revisits income or interests once
 * profession and bio are filled, so a nudge for either led nowhere.
 */
type MissingTarget = EditSection | 'journey';

interface MissingItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  target: MissingTarget;
}

/** High-value fields, in the order worth prompting. Only the unfilled ones show. */
function computeMissing(profile: Profile | undefined, hasPhotos: boolean): MissingItem[] {
  if (!profile) return [];
  const items: MissingItem[] = [];
  if (!hasPhotos) items.push({ key: 'photos', label: 'Add photos', icon: 'camera-outline', target: 'photos' });
  if (!profile.bio) items.push({ key: 'bio', label: 'Write a short bio', icon: 'create-outline', target: 'about' });
  // Community fields carry real weight in matrimony matching — surface them too.
  if (!profile.religion) items.push({ key: 'religion', label: 'Add religion & community', icon: 'people-outline', target: 'community' });
  // The journey resumes at the first unanswered question, which is not always
  // marital status, so the row names what it opens rather than one question.
  if (!profile.maritalStatus) items.push({ key: 'marital', label: 'Finish your profile questions', icon: 'list-outline', target: 'journey' });
  if (!profile.education) items.push({ key: 'education', label: 'Add education', icon: 'school-outline', target: 'career' });
  if (!profile.profession) items.push({ key: 'profession', label: 'Add profession', icon: 'briefcase-outline', target: 'career' });
  if (!profile.height) items.push({ key: 'height', label: 'Add height', icon: 'resize-outline', target: 'basic' });
  return items;
}

function CompletionCard({
  pct,
  profile,
  hasPhotos,
  onOpen,
}: {
  pct: number;
  profile: Profile | undefined;
  hasPhotos: boolean;
  /** `item` is undefined for the header when nothing specific is missing. */
  onOpen: (item?: MissingItem) => void;
}) {
  const { c, elder } = useTheme();
  const complete = pct >= 100;
  const missing = complete ? [] : computeMissing(profile, hasPhotos).slice(0, 4);

  return (
    <View style={[cc.card, { backgroundColor: c.surfaceCard, borderColor: c.border }]} testID="completion-ring">
      <PressableScale
        scaleTo={complete ? 1 : 0.99}
        style={cc.top}
        disabled={complete}
        onPress={() => onOpen(missing[0])}
        testID="completion-edit"
        accessibilityRole="button"
        accessibilityLabel={complete ? 'Profile complete' : `Complete your profile, ${Math.round(pct)} percent done`}
        accessibilityState={{ disabled: complete }}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <SharedCompletionRing value={pct} size={84} />
        <View style={cc.topText}>
          <Text variant="headline" color="fgStrong">
            {complete ? 'Your profile is complete' : 'Complete your profile'}
          </Text>
          <Text variant="footnote" color="textSecondary" style={cc.sub}>
            {complete
              ? 'Everything is filled in. Keep it up to date.'
              : missing.length > 0
                ? 'Add the details below so members can get to know you.'
                : 'A few details are still missing from your profile.'}
          </Text>
        </View>
        {!complete && <Ionicons name="chevron-forward" size={20} color={c.textMuted} />}
      </PressableScale>

      {missing.length > 0 && (
        <View style={[cc.list, { borderTopColor: c.hairline }]}>
          {missing.map((item, i) => (
            <PressableScale
              key={item.key}
              scaleTo={0.98}
              style={[
                cc.row,
                { minHeight: tapSize(elder) },
                i < missing.length - 1 && { borderBottomColor: c.hairline, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
              onPress={() => onOpen(item)}
              testID={`missing-${item.key}`}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityHint={item.target === 'journey' ? 'Continues where you left off' : undefined}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={[cc.rowIcon, { backgroundColor: c.accentSoft }]}>
                <Ionicons name={item.icon} size={16} color={c.primary} />
              </View>
              <Text variant="subhead" color="textPrimary" style={cc.rowLabel}>{item.label}</Text>
              <Ionicons name="add-circle" size={20} color={c.primary} />
            </PressableScale>
          ))}
        </View>
      )}
    </View>
  );
}

const cc = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg },
  topText: { flex: 1 },
  sub: { marginTop: 3 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: { width: 30, height: 30, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1 },
});

// ─── Section Row ─────────────────────────────────────────────────────────────

interface SectionRowProps {
  label: string;
  value: string | null | undefined;
  /**
   * Omit for a field EditProfile cannot change (date of birth, marital status,
   * gotra, income, smoking, drinking, family, horoscope). Such a row renders as
   * plain information: no pencil, no press, and no "Edit" announced for an edit
   * that cannot happen.
   */
  onEdit?: () => void;
  testID?: string;
}

function SectionRow({ label, value, onEdit, testID }: SectionRowProps) {
  const { c } = useTheme();
  const sr = React.useMemo(() => makeSr(c), [c]);
  const body = (
    <>
      <View style={sr.info}>
        <Text variant="footnote" color="textSecondary" style={sr.label}>{label}</Text>
        <Text
          variant="footnote"
          color={value ? 'textPrimary' : 'textSecondary'}
          style={!value ? sr.empty : undefined}
        >
          {value || 'Not added'}
        </Text>
      </View>
      {onEdit ? <Ionicons name="pencil-outline" size={16} color={c.textMuted} /> : null}
    </>
  );

  if (!onEdit) {
    return (
      <View
        style={[sr.row, { borderBottomColor: c.border }]}
        testID={testID ?? `row-${label}`}
        accessible
        accessibilityLabel={`${label}: ${value || 'not added'}`}
      >
        {body}
      </View>
    );
  }

  return (
    <PressableScale
      style={[sr.row, { borderBottomColor: c.border }]}
      onPress={onEdit}
      testID={testID ?? `edit-${label}`}
      accessibilityLabel={`Edit ${label}: ${value || 'not added'}`}
      accessibilityRole="button"
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {body}
    </PressableScale>
  );
}

const makeSr = (c: ThemeColours) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  info: { flex: 1 },
  label: {
    marginBottom: 2,
  },
  empty: { fontStyle: 'italic' },
});

// ─── Section Card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
}

function SectionCard({ title, children, onEdit }: SectionCardProps) {
  const { c, elder } = useTheme();
  const sc = React.useMemo(() => makeSc(c), [c]);
  const tap = tapSize(elder);
  return (
    <View style={[sc.card, { backgroundColor: c.surfaceCard, borderColor: c.border }]}>
      <View style={sc.header}>
        <Text variant="headline" color="fgStrong" style={sc.title} accessibilityRole="header">{title}</Text>
        {onEdit && (
          // The pencil is 18pt; the control around it is a real 44pt (60pt in
          // elder mode) box. The negative margins cancel the extra size so the
          // header keeps its height in the default scale.
          <PressableScale
            onPress={onEdit}
            testID={`edit-section-${title}`}
            accessibilityLabel={`Edit ${title}`}
            accessibilityRole="button"
            style={[sc.editBtn, { minWidth: tap, minHeight: tap, marginVertical: elder ? 0 : -11 }]}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="pencil-outline" size={18} color={c.primary} />
          </PressableScale>
        )}
      </View>
      {children}
    </View>
  );
}

const makeSc = (c: ThemeColours) => StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: { flex: 1 },
  editBtn: { alignItems: 'center', justifyContent: 'center', marginRight: -13 },
});

// Own gallery photo: resolves relative/seed paths and, when a photo fails to
// load (unresolved seed path, deleted Cloudinary asset), falls back to the same
// "Add photos" prompt instead of a blank white box.
function OwnGalleryPhoto({ uri, label, onManage }: { uri: string; label: string; onManage: () => void }) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  // One slide == one viewport, or pagingEnabled drifts and the dot index
  // (contentOffset.x / width) stops matching the photo on screen.
  const { width: slideWidth } = useWindowDimensions();
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageUri(uri);
  if (!resolved || failed) {
    // A photo that will not load offers the way to fix it, not an inert "Add photos".
    return (
      <PressableScale
        style={[styles.photo, styles.photoEmpty, { width: slideWidth, backgroundColor: c.surface2 }]}
        onPress={onManage}
        testID="photo-load-failed"
        accessibilityRole="button"
        accessibilityLabel={`${label}, could not be loaded. Manage photos`}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="image-outline" size={48} color={c.textSecondary} {...HIDE_FROM_A11Y} />
        <Text variant="subhead" color="textSecondary">Couldn't load this photo</Text>
        <Text variant="footnote" color="textSecondary">Manage photos</Text>
      </PressableScale>
    );
  }
  return (
    <Image
      source={{ uri: resolved }}
      // A neutral tile behind the photo: a remote image draws nothing until it decodes, which left a
      // blank 320pt hole at the top of the screen on a slow connection.
      style={[styles.photo, { width: slideWidth, backgroundColor: c.surface2 }]}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    />
  );
}

// ─── Loading ─────────────────────────────────────────────────────────────────
// Shaped like the loaded screen: full-width photo, name block, ID chip,
// completion card, a section card. (The shared OwnProfileSkeleton draws an
// avatar circle, which is not what this screen shows.)

function OwnProfileLoading() {
  return (
    // One busy element for a screen reader: without it the header is followed by
    // silence until the profile appears.
    <View
      testID="OwnProfileLoading-body"
      accessible
      accessibilityLabel="Loading your profile"
      accessibilityState={{ busy: true }}
    >
      <SkeletonBlock width="100%" height={320} radius={0} />
      <View style={sk.pad}>
        <SkeletonBlock width="55%" height={26} />
        <SkeletonBlock width="35%" height={14} />
        <SkeletonBlock width="100%" height={44} radius={borderRadius.md} style={sk.gap} />
        <SkeletonBlock width="100%" height={96} radius={borderRadius.lg} style={sk.gap} />
        <SkeletonBlock width="100%" height={150} radius={borderRadius.md} />
      </View>
    </View>
  );
}

// Layout only, no colour.
const sk = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.sm },
  gap: { marginTop: spacing.md },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OwnProfileScreen() {
  const tabClearance = useTabBarClearance();
  const { share: shareBiodata, busy: biodataBusy } = useBiodataShare();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const { c, isDark, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const tap = tapSize(elder);
  const { width: windowWidth } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { start: startJourney } = useOnboarding();
  const reduceMotion = useReduceMotion();
  const galleryRef = useRef<ScrollView>(null);

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  });

  const isPremium = !!user?.subscriptionPlan && user.subscriptionPlan !== 'free';

  const recentlyViewedQuery = useQuery({
    queryKey: ['profile', 'recently-viewed'],
    queryFn: getRecentlyViewed,
    staleTime: 60 * 1000,
  });
  const recentlyViewed = recentlyViewedQuery.data ?? [];

  const viewersQuery = useQuery({
    queryKey: ['profile', 'viewers'],
    queryFn: getProfileViewers,
    enabled: isPremium,
    staleTime: 60 * 1000,
  });
  const viewers = viewersQuery.data ?? [];

  // Real photo-verification state, so the badge row and the "Get Verified" CTA
  // reflect what this member has actually done rather than a hardcoded false.
  // While it is loading or has failed the badge row says so instead of claiming
  // "not verified" about a member who may be.
  const { data: photoVerification } = useQuery({
    queryKey: queryKeys.verification,
    queryFn: getPhotoVerification,
    staleTime: 2 * 60 * 1000,
  });

  const handleVoiceIntroSaved = (url: string | null) => {
    queryClient.setQueryData<Profile>(queryKeys.me, (old) =>
      old ? { ...old, voiceIntroUrl: url } : old,
    );
    // Home's "add a voice intro" card reads the same profile under `myProfile`.
    queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
  };

  const [photoIdx, setPhotoIdx] = useState(0);

  const photos: string[] =
    profile?.profilePhoto
      ? [profile.profilePhoto, ...(profile.photos || []).filter((p) => p !== profile.profilePhoto)]
      : profile?.photos || [];

  // A photo removed while a later one was showing must not leave the index past the end.
  const activePhoto = Math.min(photoIdx, Math.max(photos.length - 1, 0));

  // The tap alternative to swiping the gallery: same destination, no gesture.
  const goToPhoto = (idx: number) => {
    const next = Math.max(0, Math.min(photos.length - 1, idx));
    if (next === activePhoto) return;
    setPhotoIdx(next);
    galleryRef.current?.scrollTo({ x: next * windowWidth, animated: !reduceMotion });
    AccessibilityInfo.announceForAccessibility(`Photo ${next + 1} of ${photos.length}`);
  };

  // EditProfile opens on the section whose pencil was tapped. `EditProfile` is
  // declared `undefined` in MainStackParamList (navigation/types.ts), so the
  // params are cast: they reach the route at runtime regardless. Only fields the
  // editor really has are wired to it; the rest of this screen is read-only.
  const goToEdit = (section?: EditSection) =>
    navigation.navigate('EditProfile', (section ? { section } : undefined) as never);

  // A completion nudge goes to the place that can fill the field in.
  const openMissing = (item?: MissingItem) => {
    if (item?.target === 'journey') {
      startJourney().catch(() => showToast.error("Couldn't open your profile questions", 'Please try again.'));
      return;
    }
    goToEdit(item?.target);
  };

  const goToVerification = () => navigation.navigate('Verification');
  const goToSubscription = () => navigation.navigate('Subscription');
  const goToSettings = () => navigation.navigate('Settings');

  const plan = user?.subscriptionPlan;
  const planLabel = isPremium && plan ? PLANS[plan]?.label ?? humanize(plan) ?? 'Premium' : 'Free plan';

  const header = (
    <View style={[styles.header, { paddingTop: spacing.sm }]}>
      <Text variant="title2" color="fgStrong" accessibilityRole="header">My profile</Text>
      <PressableScale
        onPress={goToSettings}
        testID="settings-btn"
        accessibilityLabel="Settings"
        accessibilityRole="button"
        style={[styles.headerBtn, { minWidth: tap, minHeight: tap }]}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="settings-outline" size={24} color={c.textPrimary} />
      </PressableScale>
    </View>
  );

  if (isLoading) {
    return (
      <Screen edges={['top']} testID="OwnProfileLoading">
        {header}
        <OwnProfileLoading />
      </Screen>
    );
  }

  // No profile and not loading (the request failed, or is paused offline) must
  // not fall through to the body below: with `profile` undefined it would render
  // the member's email as their name, a 0% completion ring and "Not added" on
  // every row, which reads as an empty profile rather than a failed request. A
  // failed background refetch that still has cached data keeps rendering that
  // data.
  if (!profile) {
    return (
      <Screen edges={['top']} testID="OwnProfileErrorScreen">
        {header}
        <View style={styles.errorBody}>
          <EmptyState
            variant="error"
            icon="cloud-offline-outline"
            title="Couldn't load your profile"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => refetch()}
            testID="OwnProfile-error"
          />
        </View>
      </Screen>
    );
  }

  // Either half of the name can be empty (signup collects none), so join what exists
  // rather than templating "undefined" or "null" into the heading.
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');

  const profileCode = toProfileCode(profile?.userId ?? user?.id);
  const age = ageFromDob(profile?.dateOfBirth);

  const shareProfileCode = () => {
    if (!profileCode) return;
    Share.share({
      message: `Find me on TricityMatch. My profile ID is ${profileCode}. Search it in the app.`,
    }).catch(() => {
      // Dismissing the sheet resolves; a rejection is a real failure to open it.
      showToast.error("Couldn't open sharing", 'Please try again.');
    });
  };

  return (
    <Screen
      edges={['top']}
      scroll
      contentContainerStyle={{ paddingBottom: tabClearance }}
      testID="OwnProfileScreen"
    >
      {/* Header */}
      {header}

      {/* Photo gallery */}
      <ScrollView
        ref={galleryRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
          setPhotoIdx(idx);
        }}
        style={styles.photoScroll}
        testID="photo-gallery"
      >
        {photos.length > 0 ? (
          photos.map((uri, i) => (
            <OwnGalleryPhoto
              key={`${i}-${uri}`}
              uri={uri}
              label={`Your photo ${i + 1} of ${photos.length}`}
              onManage={() => goToEdit('photos')}
            />
          ))
        ) : (
          <PressableScale
            style={[styles.photo, styles.photoEmpty, { width: windowWidth, backgroundColor: c.surface2 }]}
            onPress={() => goToEdit('photos')}
            testID="add-photos-empty"
            accessibilityLabel="Add photos"
            accessibilityRole="button"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="camera-outline" size={44} color={c.textSecondary} />
            <View style={[styles.addPhotosBtn, { backgroundColor: c.p500 }]}>
              <Ionicons name="add" size={16} color={c.onPrimary} />
              <Text variant="caption" color="onPrimary">Add photos</Text>
            </View>
          </PressableScale>
        )}
      </ScrollView>

      {/* Previous / next around the dots: the tap alternative to swiping. The dots
          themselves are decorative, the photos announce their own position. */}
      {photos.length > 1 && (
        <View style={styles.galleryNavRow}>
          <PressableScale
            style={[styles.galleryNavBtn, { minWidth: tap, minHeight: tap }]}
            onPress={() => goToPhoto(activePhoto - 1)}
            disabled={activePhoto === 0}
            testID="photo-prev"
            accessibilityRole="button"
            accessibilityLabel="Previous photo"
            accessibilityState={{ disabled: activePhoto === 0 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={activePhoto === 0 ? c.textMuted : c.textPrimary} {...HIDE_FROM_A11Y} />
          </PressableScale>
          <View style={styles.dotsRow} {...HIDE_FROM_A11Y}>
            {photos.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: c.border }, i === activePhoto && { backgroundColor: c.primary, width: 16 }]}
              />
            ))}
          </View>
          <PressableScale
            style={[styles.galleryNavBtn, { minWidth: tap, minHeight: tap }]}
            onPress={() => goToPhoto(activePhoto + 1)}
            disabled={activePhoto === photos.length - 1}
            testID="photo-next"
            accessibilityRole="button"
            accessibilityLabel="Next photo"
            accessibilityState={{ disabled: activePhoto === photos.length - 1 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={20} color={activePhoto === photos.length - 1 ? c.textMuted : c.textPrimary} {...HIDE_FROM_A11Y} />
          </PressableScale>
        </View>
      )}

      {/* Once a photo exists the gallery is the only place a member looks at it, so
          it carries its own way in to add, remove or reorder. */}
      {photos.length > 0 && (
        <PressableScale
          style={[styles.managePhotos, { minHeight: tap }]}
          onPress={() => goToEdit('photos')}
          testID="manage-photos"
          accessibilityRole="button"
          accessibilityLabel="Manage photos"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="images-outline" size={16} color={c.primary} {...HIDE_FROM_A11Y} />
          <Text variant="subhead" color="primary">Manage photos</Text>
        </PressableScale>
      )}

      {/* Name, age, location */}
      <View style={styles.nameRow}>
        <View style={styles.nameCol}>
          <Text variant="title2" color="fgStrong" style={styles.name}>{name || 'Your profile'}</Text>
          {age !== null && (
            <Text variant="footnote" color="textSecondary" style={styles.subText}>
              {age} yrs
              {profile?.city ? ` · ${profile.city}` : ''}
            </Text>
          )}
          {profile?.profession && (
            <Text variant="footnote" color="textSecondary" style={styles.subText}>{profile.profession}</Text>
          )}
        </View>
        {/* Plan badge — gold for paid tiers (premium/VIP), burgundy for free.
            Gold is the fill; the label is `goldText` on light and the lighter
            gold on dark, because plain gold text is ~2.4:1 on its own tint. */}
        <PressableScale
          style={[styles.planBadge, { backgroundColor: isPremium ? c.goldSoft : c.accentSoft, minHeight: tap }]}
          onPress={goToSubscription}
          testID="plan-badge"
          accessibilityLabel={isPremium ? `Subscription plan: ${planLabel}` : 'Subscription plan: free. Upgrade'}
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            variant="caption"
            style={{ color: isPremium ? (isDark ? c.secondary : c.goldText) : c.primary }}
          >
            {planLabel}
          </Text>
          {!isPremium && (
            <Text variant="footnote" color="primary" style={styles.upgradeText}>Upgrade</Text>
          )}
        </PressableScale>
      </View>

      {/* Shareable profile ID — the other half of Search's ID lookup. Without a
          way to read your own code, looking one up is a one-way door. */}
      {profileCode ? (
        <PressableScale
          style={[styles.codeChip, { borderColor: c.border, backgroundColor: c.surfaceCard, minHeight: tap }]}
          onPress={shareProfileCode}
          testID="profile-code-chip"
          accessibilityLabel={`Share my profile ID ${profileCode}`}
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="id-card-outline" size={16} color={c.textSecondary} />
          <Text variant="footnote" color="textSecondary" style={styles.codeLabel}>My profile ID</Text>
          <Text variant="caption" color="fgStrong" style={styles.codeValue}>{profileCode}</Text>
          <Ionicons name="share-outline" size={16} color={c.primary} />
        </PressableScale>
      ) : null}

      {/* D5 flagship: shareable marriage-biodata PDF */}
      <PressableScale
        style={[styles.codeChip, { borderColor: c.border, backgroundColor: c.surfaceCard, minHeight: tap }]}
        onPress={shareBiodata}
        disabled={biodataBusy}
        testID="biodata-chip"
        accessibilityLabel="Share my marriage biodata PDF"
        accessibilityRole="button"
        accessibilityState={{ disabled: biodataBusy, busy: biodataBusy }}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="document-text-outline" size={16} color={c.textSecondary} />
        <Text variant="footnote" color="textSecondary" style={styles.codeLabel}>Marriage biodata</Text>
        <Text variant="caption" color="fgStrong" style={styles.codeValue}>{biodataBusy ? 'Preparing…' : 'Share PDF'}</Text>
        <Ionicons name="share-outline" size={16} color={c.primary} />
      </PressableScale>

      {/* Full story-scroll preview: the real profile screen, so it shows what
          others actually see (photo blur, contact gates and all). A blur toggle
          here used to fake it and was wrong whenever blur-until-match was off. */}
      {user?.id ? (
        <PressableScale
          style={[styles.previewRow, { minHeight: tap }]}
          onPress={() => navigation.navigate('ProfileDetail', { userId: user.id })}
          testID="open-full-preview"
          accessibilityRole="button"
          accessibilityLabel="Open full profile preview"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="albums-outline" size={16} color={c.textSecondary} />
          <Text variant="subhead" color="textSecondary" style={styles.previewLabel}>Open my full profile preview</Text>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </PressableScale>
      ) : null}

      {/* Completion — one card: ring + the specific fields still missing */}
      <StaggeredEntrance index={0}>
        <CompletionCard
          pct={profile?.completionPercentage ?? 0}
          profile={profile}
          hasPhotos={photos.length > 0}
          onOpen={openMissing}
        />
      </StaggeredEntrance>

      {/* Profile activity (mirrors web Dashboard) */}
      <StaggeredEntrance index={1}>
        {isPremium ? (
          <ActivityRail
            title="Profile visitors"
            profiles={viewers}
            loading={viewersQuery.isLoading}
            error={viewersQuery.isError && !viewersQuery.data}
            onRetry={() => viewersQuery.refetch()}
            emptyText="No visitors yet. Members who view your profile will show up here."
            onPressProfile={(userId) => navigation.navigate('ProfileDetail', { userId })}
          />
        ) : (
          <ViewersUpsell onUpgrade={goToSubscription} />
        )}
      </StaggeredEntrance>
      <StaggeredEntrance index={2}>
        <ActivityRail
          title="Recently viewed"
          profiles={recentlyViewed}
          loading={recentlyViewedQuery.isLoading}
          error={recentlyViewedQuery.isError && !recentlyViewedQuery.data}
          onRetry={() => recentlyViewedQuery.refetch()}
          onPressProfile={(userId) => navigation.navigate('ProfileDetail', { userId })}
        />
      </StaggeredEntrance>

      {/* Verification badges */}
      <VerificationBadges
        phoneVerified={user?.phoneVerified ?? false}
        photoStatus={photoVerification?.status ?? 'unknown'}
        onGetVerified={goToVerification}
      />

      {/* Basic details. Date of birth and marital status have no field in
          EditProfile, so those two rows are plain information. */}
      <SectionCard title="Basic details" onEdit={() => goToEdit('basic')}>
        <SectionRow
          label="Full name"
          value={name || null}
          onEdit={() => goToEdit('basic')}
        />
        <SectionRow
          label="Date of birth"
          value={profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : null}
        />
        <SectionRow
          label="Height"
          value={profile?.height ? `${profile.height} cm` : null}
          onEdit={() => goToEdit('basic')}
        />
        <SectionRow
          label="Marital status"
          value={humanize(profile?.maritalStatus)}
        />
      </SectionCard>

      {/* Community (gotra is not editable on mobile) */}
      <SectionCard title="Community" onEdit={() => goToEdit('community')}>
        <SectionRow label="Religion" value={profile?.religion} onEdit={() => goToEdit('community')} />
        <SectionRow label="Caste" value={profile?.caste} onEdit={() => goToEdit('community')} />
        <SectionRow label="Mother tongue" value={profile?.motherTongue} onEdit={() => goToEdit('community')} />
        <SectionRow label="Gotra" value={profile?.gotra} />
      </SectionCard>

      {/* Education & career (income is not editable on mobile) */}
      <SectionCard title="Education & career" onEdit={() => goToEdit('career')}>
        <SectionRow label="Education" value={profile?.education} onEdit={() => goToEdit('career')} />
        <SectionRow label="Profession" value={profile?.profession} onEdit={() => goToEdit('career')} />
        <SectionRow
          label="Income"
          value={formatIncome(profile?.income)}
        />
      </SectionCard>

      {/* Location */}
      <SectionCard title="Location" onEdit={() => goToEdit('location')}>
        <SectionRow label="City" value={profile?.city} onEdit={() => goToEdit('location')} />
        <SectionRow label="State" value={profile?.state} onEdit={() => goToEdit('location')} />
      </SectionCard>

      {/* Voice intro */}
      <VoiceIntroRecorder
        existingUrl={profile?.voiceIntroUrl ?? null}
        onSaved={handleVoiceIntroSaved}
      />

      {/* Compatibility quiz entry */}
      <PressableScale
        style={[styles.quizBanner, { backgroundColor: c.accentSoft, borderColor: c.primary + '40' }]}
        onPress={() => navigation.navigate('Quiz')}
        testID="quiz-cta"
        accessibilityLabel="Take compatibility quiz"
        accessibilityRole="button"
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="help-circle-outline" size={22} color={c.primary} />
        <View style={styles.quizText}>
          <Text variant="caption" color="textPrimary">Compatibility quiz</Text>
          <Text variant="footnote" color="textSecondary">10 short questions</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </PressableScale>

      {/* About (interest tags are shown here but not editable on mobile) */}
      <SectionCard title="About me" onEdit={() => goToEdit('about')}>
        {profile?.bio ? (
          <Text variant="footnote" color="textPrimary">{profile.bio}</Text>
        ) : (
          <PressableScale
            style={[styles.addBio, { minHeight: tap }]}
            onPress={() => goToEdit('about')}
            testID="add-bio"
            accessibilityRole="button"
            accessibilityLabel="Add bio"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add" size={18} color={c.primary} />
            <Text variant="subhead" color="primary">Add bio</Text>
          </PressableScale>
        )}
        {(profile?.interestTags?.length ?? 0) > 0 && (
          <View style={styles.tagsRow}>
            {profile!.interestTags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: c.accentSoft }]}>
                <Text variant="footnote" color="primary">{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {/* Lifestyle (diet is the only lifestyle field EditProfile has) */}
      <SectionCard title="Lifestyle" onEdit={() => goToEdit('lifestyle')}>
        <SectionRow label="Diet" value={humanize(profile?.diet)} onEdit={() => goToEdit('lifestyle')} />
        <SectionRow label="Smoking" value={humanize(profile?.smoking)} />
        <SectionRow label="Drinking" value={humanize(profile?.drinking)} />
      </SectionCard>

      {/* Family: shown, not editable on mobile. No pencil, because the editor has
          no family section to open. */}
      <SectionCard title="Family">
        <SectionRow label="Family type" value={humanize(profile?.familyType)} />
        <SectionRow label="Father's occupation" value={profile?.fatherOccupation} />
        <SectionRow label="Mother's occupation" value={profile?.motherOccupation} />
      </SectionCard>

      {/* Horoscope: shown, not editable on mobile (same reason as Family). */}
      <SectionCard title="Horoscope">
        <SectionRow label="Manglik status" value={humanize(profile?.manglikStatus)} />
        <SectionRow label="Birth place" value={profile?.placeOfBirth} />
        <SectionRow
          label="Zodiac / rashi"
          value={[profile?.zodiacSign, profile?.rashi].filter(Boolean).join(' / ') || null}
        />
      </SectionCard>

      <View style={{ height: 40 }} />
    </Screen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  errorBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  // Glyph is 24pt; the control is the 44pt+ box, nudged so the glyph stays on
  // the gutter.
  headerBtn: { alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  photoScroll: { height: 320 },
  // Width comes from useWindowDimensions at the call site — a fixed 375 letterboxed
  // the hero and desynced the paging dots on every device that is not a 375pt iPhone.
  photo: { height: 320 },
  photoEmpty: {
    backgroundColor: c.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addPhotosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    marginTop: spacing.xs,
  },

  galleryNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  galleryNavBtn: { alignItems: 'center', justifyContent: 'center' },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: c.border,
  },
  managePhotos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  nameCol: { flex: 1 },
  name: {
    marginBottom: 4,
  },
  subText: {
    marginBottom: 2,
  },

  planBadge: {
    backgroundColor: c.primaryLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  upgradeText: {
    marginTop: 2,
  },

  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  codeLabel: {},
  // Tracking is data formatting, not decoration: it keeps the characters of an ID
  // that people read out to each other apart.
  codeValue: { flex: 1, letterSpacing: 0.5 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  previewLabel: {
    flex: 1,
  },

  addBio: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    backgroundColor: c.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  quizBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: c.primaryLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.primary + '40',
  },
  quizText: { flex: 1 },
});
