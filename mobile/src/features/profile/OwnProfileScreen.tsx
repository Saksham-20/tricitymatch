import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  Switch,
  ActivityIndicator, 
  useWindowDimensions,
  Share,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import SmartImage, { resolveImageUri } from '../../components/common/SmartImage';
import { OwnProfileSkeleton } from '../../components/ui/skeletons';
import { colours, typography, type, spacing, borderRadius } from '@shared/constants/theme';
import { CompletionRing as SharedCompletionRing } from '../../components/ui';
import { PressableScale, StaggeredEntrance } from '../../components/motion';
import { haptics } from '../../utils/haptics';
import { useTheme } from '../../hooks/useTheme';
import { getMyProfile, getProfileViewers, getRecentlyViewed } from '../../api/profile';
import { getPhotoVerification } from '../../api/verification';
import { formatDate } from '../../utils/dateUtils';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { showToast } from '../../utils/toast';
import { CONFIG } from '../../constants/config';
import { toProfileCode } from '../../utils/profileCode';
import type { MainStackParamList } from '../../navigation/types';
import type { Profile, ProfileSummary } from '../../types';
import VoiceIntroRecorder from '../../components/profile/VoiceIntroRecorder';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Activity Rail (Visitors / Recently Viewed) ──────────────────────────────

function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function ActivityRail({
  title,
  profiles,
  onPressProfile,
}: {
  title: string;
  profiles: ProfileSummary[];
  onPressProfile: (userId: string) => void;
}) {
  const { c } = useTheme();
  if (profiles.length === 0) return null;
  return (
    <View style={ar.section}>
      <Text style={[ar.heading, { color: c.textSecondary }]}>{title}</Text>
      <FlatList
        horizontal
        data={profiles}
        keyExtractor={(p) => p.userId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ar.list}
        renderItem={({ item }) => {
          const age = ageFromDob(item.dateOfBirth);
          const name = `${item.firstName} ${item.lastName ?? ''}`.trim();
          return (
            <TouchableOpacity
              style={ar.card}
              onPress={() => onPressProfile(item.userId)}
              testID={`activity-card-${item.userId}`}
              accessibilityLabel={`View ${name}`}
            >
              <SmartImage uri={item.profilePhoto} name={item.firstName} style={[ar.avatar, { backgroundColor: c.surface2 }]} initialSize={28} />
              <Text style={[ar.name, { color: c.textPrimary }]} numberOfLines={1}>{item.firstName}</Text>
              <Text style={[ar.meta, { color: c.textMuted }]} numberOfLines={1}>
                {[age ? `${age}` : null, item.city].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function ViewersUpsell({ onUpgrade }: { onUpgrade: () => void }) {
  const { c } = useTheme();
  return (
    <View style={ar.section}>
      <Text style={[ar.heading, { color: c.textSecondary }]}>Profile Visitors</Text>
      <TouchableOpacity
        style={[ar.upsell, { backgroundColor: c.accentSoft, borderColor: c.primary + '40' }]}
        onPress={onUpgrade}
        testID="viewers-upsell"
        accessibilityLabel="Upgrade to see who viewed you"
      >
        <Ionicons name="eye-outline" size={20} color={c.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[ar.upsellTitle, { color: c.textPrimary }]}>See who viewed your profile</Text>
          <Text style={[ar.upsellSub, { color: c.textMuted }]}>Upgrade to Premium to unlock visitors</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const ar = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  heading: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textSecondary,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: 88, alignItems: 'center' },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.md,
    backgroundColor: colours.surfaceCard,
    marginBottom: 6,
  },
  name: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  meta: { fontSize: typography.fontSize.xs, color: colours.textMuted },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    backgroundColor: colours.primaryLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colours.primary + '40',
  },
  upsellTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  upsellSub: { fontSize: typography.fontSize.xs, color: colours.textMuted },
});

// ─── Completion Card ──────────────────────────────────────────────────────────
// One card = ring + the specific fields still missing, each tappable to the
// editor. Replaces the old three-part stack (ring + generic CTA + a fixed
// milestone strip whose 70% tip still told members to "Upload Kundli" — a
// feature that was removed). Shows exactly what to do next, Shaadi/Jeevansathi
// style, instead of an abstract percentage.

interface MissingItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** High-value fields, in the order worth prompting. Only the unfilled ones show. */
function computeMissing(profile: Profile | undefined, hasPhotos: boolean): MissingItem[] {
  if (!profile) return [];
  const items: MissingItem[] = [];
  if (!hasPhotos) items.push({ key: 'photos', label: 'Add your photos', icon: 'camera-outline' });
  if (!profile.bio) items.push({ key: 'bio', label: 'Write a short bio', icon: 'create-outline' });
  // Community fields carry real weight in matrimony matching — surface them too.
  if (!profile.religion) items.push({ key: 'religion', label: 'Add religion & community', icon: 'people-outline' });
  if (!profile.maritalStatus) items.push({ key: 'marital', label: 'Add marital status', icon: 'heart-outline' });
  if (!profile.education) items.push({ key: 'education', label: 'Add education', icon: 'school-outline' });
  if (!profile.profession) items.push({ key: 'profession', label: 'Add profession', icon: 'briefcase-outline' });
  if ((profile.interestTags?.length ?? 0) === 0) items.push({ key: 'interests', label: 'Add your interests', icon: 'pricetags-outline' });
  if (!profile.income) items.push({ key: 'income', label: 'Add annual income', icon: 'cash-outline' });
  if (!profile.height) items.push({ key: 'height', label: 'Add height', icon: 'resize-outline' });
  return items;
}

function CompletionCard({
  pct,
  profile,
  hasPhotos,
  onEdit,
}: {
  pct: number;
  profile: Profile | undefined;
  hasPhotos: boolean;
  onEdit: () => void;
}) {
  const { c } = useTheme();
  const complete = pct >= 100;
  const missing = complete ? [] : computeMissing(profile, hasPhotos).slice(0, 4);

  return (
    <View style={[cc.card, { backgroundColor: c.surfaceCard, borderColor: c.border }]} testID="completion-ring">
      <PressableScale
        scaleTo={complete ? 1 : 0.99}
        style={cc.top}
        disabled={complete}
        onPress={() => { haptics.light(); onEdit(); }}
        testID="completion-edit"
        accessibilityLabel="Complete your profile"
      >
        <SharedCompletionRing value={pct} size={84} />
        <View style={cc.topText}>
          <Text style={[cc.title, { color: c.fgStrong }]}>
            {complete ? 'Your profile is complete' : 'Complete your profile'}
          </Text>
          <Text style={[cc.sub, { color: c.textMuted }]}>
            {complete
              ? "You're all set — you'll show up in more searches."
              : 'A complete profile gets up to 5× more interest.'}
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
              style={[cc.row, i < missing.length - 1 && { borderBottomColor: c.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}
              onPress={() => { haptics.light(); onEdit(); }}
              testID={`missing-${item.key}`}
              accessibilityLabel={item.label}
            >
              <View style={[cc.rowIcon, { backgroundColor: c.accentSoft }]}>
                <Ionicons name={item.icon} size={16} color={c.primary} />
              </View>
              <Text style={[cc.rowLabel, { color: c.textPrimary }]}>{item.label}</Text>
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
  title: { ...type.headline },
  sub: { ...type.footnote, marginTop: 3 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: { width: 30, height: 30, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...type.subhead, flex: 1 },
});

// ─── Verification Badges ─────────────────────────────────────────────────────

/**
 * Two tiers, because two tiers is what the product has.
 *
 * This row used to show a four-rung ladder — Mobile / ID / Education / Income —
 * left over from a verification model that was removed: govt-ID collection went
 * in 2026-07-02 and the app is selfie-only now, while education and income
 * verification never had a backend at all. The call site passed
 * `idVerified={false}` as a literal and the last two rungs were hardcoded
 * `false`, so three of the four badges could never be earned by anyone, and the
 * "Get Verified" CTA below them was shown unconditionally — including to members
 * who were already verified.
 */
const VERIFICATION_TIERS = [
  { key: 'mobile', label: 'Mobile', color: colours.badgeMobile },
  { key: 'photo', label: 'Photo', color: colours.badgeID },
] as const;

interface VerifBadgesProps {
  phoneVerified: boolean;
  photoVerified: boolean;
  onGetVerified: () => void;
}

function VerificationBadges({ phoneVerified, photoVerified, onGetVerified }: VerifBadgesProps) {
  const { c } = useTheme();
  const earned = [phoneVerified, photoVerified];
  return (
    <View style={vb.container}>
      <View style={vb.row}>
        {VERIFICATION_TIERS.map((tier, i) => (
          <View key={tier.key} style={[vb.badge, { borderColor: c.border }, earned[i] && { borderColor: tier.color }]}>
            <Ionicons
              name={earned[i] ? 'checkmark-circle' : 'ellipse-outline'}
              size={14}
              color={earned[i] ? tier.color : c.textMuted}
            />
            <Text style={[vb.badgeText, { color: c.textMuted }, earned[i] && { color: tier.color }]}>{tier.label}</Text>
          </View>
        ))}
      </View>
      {!photoVerified && (
        <TouchableOpacity
          style={[vb.ctaBtn, { backgroundColor: c.accentSoft }]}
          onPress={onGetVerified}
          testID="get-verified-cta"
          accessibilityLabel="Get Verified"
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={c.primary} />
          <Text style={[vb.ctaText, { color: c.primary }]}>Get Verified → Add trust badge</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const vb = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.medium,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colours.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  ctaText: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
  },
});

// ─── Section Row ─────────────────────────────────────────────────────────────

interface SectionRowProps {
  label: string;
  value: string | null | undefined;
  onEdit: () => void;
  testID?: string;
}

function SectionRow({ label, value, onEdit, testID }: SectionRowProps) {
  const { c } = useTheme();
  return (
    <TouchableOpacity
      style={[sr.row, { borderBottomColor: c.border }]}
      onPress={onEdit}
      testID={testID ?? `edit-${label}`}
      accessibilityLabel={`Edit ${label}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={[sr.label, { color: c.textSecondary }]}>{label}</Text>
        <Text style={[sr.value, { color: c.textPrimary }, !value && [sr.empty, { color: c.textMuted }]]}>{value || 'Not added'}</Text>
      </View>
      <Ionicons name="pencil-outline" size={16} color={c.textMuted} />
    </TouchableOpacity>
  );
}

const sr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  label: {
    fontSize: typography.fontSize.xs,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 2,
  },
  value: {
    fontSize: typography.fontSize.sm,
    color: colours.textPrimary,
    fontFamily: typography.fontFamily.regular,
  },
  empty: { color: colours.textMuted, fontStyle: 'italic' },
});

// ─── Section Card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
}

function SectionCard({ title, children, onEdit }: SectionCardProps) {
  const { c } = useTheme();
  return (
    <View style={[sc.card, { backgroundColor: c.surfaceCard, borderColor: c.border }]}>
      <View style={sc.header}>
        <Text style={[sc.title, { color: c.fgStrong }]}>{title}</Text>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} testID={`edit-section-${title}`} accessibilityLabel={`Edit ${title}`}>
            <Ionicons name="pencil-outline" size={18} color={c.primary} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colours.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
});

// Own gallery photo: resolves relative/seed paths and, when a photo fails to
// load (unresolved seed path, deleted Cloudinary asset), falls back to the same
// "Add photos" prompt instead of a blank white box.
function OwnGalleryPhoto({ uri, previewMode }: { uri: string; previewMode: boolean }) {
  const { c } = useTheme();
  // One slide == one viewport, or pagingEnabled drifts and the dot index
  // (contentOffset.x / width) stops matching the photo on screen.
  const { width: slideWidth } = useWindowDimensions();
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageUri(previewMode ? uri + '?blur=20' : uri);
  if (!resolved || failed) {
    return (
      <View style={[styles.photo, styles.photoEmpty, { width: slideWidth, backgroundColor: c.surface2 }]}>
        <Ionicons name="camera-outline" size={48} color={c.textMuted} />
        <Text style={[styles.photoEmptyText, { color: c.textMuted }]}>Add photos</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: resolved }}
      style={[styles.photo, { width: slideWidth }]}
      resizeMode="cover"
      blurRadius={previewMode ? 20 : 0}
      onError={() => setFailed(true)}
    />
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OwnProfileScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [previewMode, setPreviewMode] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  });

  const isPremium = !!user?.subscriptionPlan && user.subscriptionPlan !== 'free';

  const { data: recentlyViewed = [] } = useQuery({
    queryKey: ['profile', 'recently-viewed'],
    queryFn: getRecentlyViewed,
    staleTime: 60 * 1000,
  });

  const { data: viewers = [] } = useQuery({
    queryKey: ['profile', 'viewers'],
    queryFn: getProfileViewers,
    enabled: isPremium,
    staleTime: 60 * 1000,
  });

  // Real photo-verification state, so the badge row and the "Get Verified" CTA
  // reflect what this member has actually done rather than a hardcoded false.
  const { data: photoVerification } = useQuery({
    queryKey: queryKeys.verification,
    queryFn: getPhotoVerification,
    staleTime: 2 * 60 * 1000,
  });

  const handleVoiceIntroSaved = (url: string | null) => {
    queryClient.setQueryData<Profile>(queryKeys.me, (old) =>
      old ? { ...old, voiceIntroUrl: url } : old,
    );
  };

  const [photoIdx, setPhotoIdx] = useState(0);

  const photos: string[] =
    profile?.profilePhoto
      ? [profile.profilePhoto, ...(profile.photos || []).filter((p) => p !== profile.profilePhoto)]
      : profile?.photos || [];

  const goToEdit = (_section?: string) =>
    navigation.navigate('EditProfile');

  const goToVerification = () => navigation.navigate('Verification');
  const goToSubscription = () => navigation.navigate('Subscription');
  const goToSettings = () => navigation.navigate('Settings');

  const planLabel =
    user?.subscriptionPlan && user.subscriptionPlan !== 'free'
      ? user.subscriptionPlan.replace(/_/g, ' ').toUpperCase()
      : 'Free Plan';

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }} testID="OwnProfileLoading">
        <OwnProfileSkeleton />
      </View>
    );
  }

  const name = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : user?.email ?? '';

  const profileCode = toProfileCode(profile?.userId ?? user?.id);

  // D5 biodata flagship: download the PDF with the auth header, then hand the
  // FILE to the share sheet (WhatsApp-first). expo-file-system ships with the
  // expo package; lazy-required so Expo Go without it degrades to a toast.
  const [biodataBusy, setBiodataBusy] = useState(false);
  const shareBiodata = async () => {
    if (biodataBusy) return;
    setBiodataBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let FileSystem: any = null;
      try { FileSystem = require('expo-file-system/legacy'); } catch { /* fall through */ }
      if (!FileSystem?.downloadAsync) {
        try { FileSystem = require('expo-file-system'); } catch { FileSystem = null; }
      }
      if (!FileSystem?.downloadAsync) {
        showToast.error('Not available', 'Biodata download needs a native build.');
        return;
      }
      const token = useAuthStore.getState().accessToken;
      const dest = `${FileSystem.cacheDirectory}biodata-tricitymatch.pdf`;
      const res = await FileSystem.downloadAsync(
        `${CONFIG.API_URL}/profile/me/biodata?template=classic`,
        dest,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      await Share.share(
        Platform.OS === 'ios'
          ? { url: res.uri, title: 'Marriage Biodata' }
          : { message: 'My marriage biodata (PDF) — made with TricityMatch, tricitymatch.com', url: res.uri, title: 'Marriage Biodata' }
      );
    } catch {
      showToast.error('Error', 'Could not prepare your biodata. Please try again.');
    } finally {
      setBiodataBusy(false);
    }
  };
  const shareProfileCode = () => {
    if (!profileCode) return;
    Share.share({
      message: `Find me on TricityMatch — my profile ID is ${profileCode}. Search it in the app.`,
    }).catch(() => { /* the member dismissed the sheet */ });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.background }]}
      showsVerticalScrollIndicator={false}
      testID="OwnProfileScreen"
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={[styles.headerTitle, { color: c.fgStrong }]}>My Profile</Text>
        <TouchableOpacity
          onPress={goToSettings}
          testID="settings-btn"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={24} color={c.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Photo gallery */}
      <ScrollView
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
            <OwnGalleryPhoto key={i} uri={uri} previewMode={previewMode} />
          ))
        ) : (
          <TouchableOpacity
            style={[styles.photo, styles.photoEmpty, { width: windowWidth, backgroundColor: c.surface2 }]}
            onPress={() => goToEdit('photos')}
            testID="add-photos-empty"
            accessibilityLabel="Add photos"
          >
            <Ionicons name="camera-outline" size={44} color={c.textMuted} />
            <View style={[styles.addPhotosBtn, { backgroundColor: c.primary }]}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addPhotosBtnText}>Add photos</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Photo dots */}
      {photos.length > 1 && (
        <View style={styles.dotsRow}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: c.border }, i === photoIdx && { backgroundColor: c.primary, width: 16 }]}
            />
          ))}
        </View>
      )}

      {/* Name, age, location */}
      <View style={styles.nameRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.fgStrong }]}>{name}</Text>
          {profile?.dateOfBirth && (
            <Text style={[styles.subText, { color: c.textSecondary }]}>
              {Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))} yrs
              {profile.city ? ` · ${profile.city}` : ''}
            </Text>
          )}
          {profile?.profession && (
            <Text style={[styles.subText, { color: c.textSecondary }]}>{profile.profession}</Text>
          )}
        </View>
        {/* Plan badge — gold for paid tiers (premium/VIP), burgundy for free */}
        <TouchableOpacity
          style={[styles.planBadge, { backgroundColor: isPremium ? c.goldSoft : c.accentSoft }]}
          onPress={goToSubscription}
          testID="plan-badge"
          accessibilityLabel="Subscription plan"
        >
          <Text style={[styles.planText, { color: isPremium ? c.secondary : c.primary }]}>{planLabel}</Text>
          {user?.subscriptionPlan === 'free' && (
            <Text style={[styles.upgradeText, { color: c.primary }]}>Upgrade ↑</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Shareable profile ID — the other half of Search's ID lookup. Without a
          way to read your own code, looking one up is a one-way door. */}
      {profileCode ? (
        <TouchableOpacity
          style={[styles.codeChip, { borderColor: c.border, backgroundColor: c.surfaceCard }]}
          onPress={shareProfileCode}
          testID="profile-code-chip"
          accessibilityLabel={`Share my profile ID ${profileCode}`}
        >
          <Ionicons name="id-card-outline" size={16} color={c.textSecondary} />
          <Text style={[styles.codeLabel, { color: c.textMuted }]}>My profile ID</Text>
          <Text style={[styles.codeValue, { color: c.fgStrong }]}>{profileCode}</Text>
          <Ionicons name="share-outline" size={16} color={c.primary} />
        </TouchableOpacity>
      ) : null}

      {/* D5 flagship: shareable marriage-biodata PDF */}
      <TouchableOpacity
        style={[styles.codeChip, { borderColor: c.border, backgroundColor: c.surfaceCard }]}
        onPress={shareBiodata}
        disabled={biodataBusy}
        testID="biodata-chip"
        accessibilityLabel="Share my marriage biodata PDF"
      >
        <Ionicons name="document-text-outline" size={16} color={c.textSecondary} />
        <Text style={[styles.codeLabel, { color: c.textMuted }]}>Marriage biodata</Text>
        <Text style={[styles.codeValue, { color: c.fgStrong }]}>{biodataBusy ? 'Preparing…' : 'Share PDF'}</Text>
        <Ionicons name="share-outline" size={16} color={c.primary} />
      </TouchableOpacity>

      {/* Preview toggle */}
      <View style={styles.previewRow}>
        <Ionicons name="eye-outline" size={16} color={c.textSecondary} />
        <Text style={[styles.previewLabel, { color: c.textSecondary }]}>Preview as others see me</Text>
        <Switch
          value={previewMode}
          onValueChange={setPreviewMode}
          trackColor={{ true: c.primary, false: c.border }}
          thumbColor="#fff"
          testID="preview-toggle"
          accessibilityLabel="Preview as others see me"
        />
      </View>

      {/* Full story-scroll preview — exactly what a match sees */}
      {user?.id ? (
        <TouchableOpacity
          style={styles.previewRow}
          onPress={() => navigation.navigate('ProfileDetail', { userId: user.id })}
          testID="open-full-preview"
          accessibilityRole="button"
          accessibilityLabel="Open full profile preview"
        >
          <Ionicons name="albums-outline" size={16} color={c.textSecondary} />
          <Text style={[styles.previewLabel, { color: c.textSecondary }]}>Open my full profile preview</Text>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </TouchableOpacity>
      ) : null}

      {/* Completion — one card: ring + the specific fields still missing */}
      <StaggeredEntrance index={0}>
        <CompletionCard
          pct={profile?.completionPercentage ?? 0}
          profile={profile}
          hasPhotos={photos.length > 0}
          onEdit={() => goToEdit()}
        />
      </StaggeredEntrance>

      {/* Profile activity (mirrors web Dashboard) */}
      {!previewMode && (
        <>
          <StaggeredEntrance index={1}>
            {isPremium ? (
              <ActivityRail
                title="Profile Visitors"
                profiles={viewers}
                onPressProfile={(userId) => navigation.navigate('ProfileDetail', { userId })}
              />
            ) : (
              <ViewersUpsell onUpgrade={goToSubscription} />
            )}
          </StaggeredEntrance>
          <StaggeredEntrance index={2}>
            <ActivityRail
              title="Recently Viewed"
              profiles={recentlyViewed}
              onPressProfile={(userId) => navigation.navigate('ProfileDetail', { userId })}
            />
          </StaggeredEntrance>
        </>
      )}

      {/* Verification badges */}
      <VerificationBadges
        phoneVerified={user?.phoneVerified ?? false}
        photoVerified={photoVerification?.status === 'approved'}
        onGetVerified={goToVerification}
      />

      {/* Basic details section */}
      <SectionCard title="Basic Details" onEdit={() => goToEdit('basic')}>
        <SectionRow
          label="Full Name"
          value={name}
          onEdit={() => goToEdit('basic')}
        />
        <SectionRow
          label="Date of Birth"
          value={profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : null}
          onEdit={() => goToEdit('basic')}
        />
        <SectionRow
          label="Height"
          value={profile?.height ? `${profile.height} cm` : null}
          onEdit={() => goToEdit('basic')}
        />
        <SectionRow
          label="Marital Status"
          value={profile?.maritalStatus?.replace(/_/g, ' ') ?? null}
          onEdit={() => goToEdit('basic')}
        />
      </SectionCard>

      {/* Community */}
      <SectionCard title="Community" onEdit={() => goToEdit('community')}>
        <SectionRow label="Religion" value={profile?.religion} onEdit={() => goToEdit('community')} />
        <SectionRow label="Caste" value={profile?.caste} onEdit={() => goToEdit('community')} />
        <SectionRow label="Mother Tongue" value={profile?.motherTongue} onEdit={() => goToEdit('community')} />
        <SectionRow label="Gotra" value={profile?.gotra} onEdit={() => goToEdit('community')} />
      </SectionCard>

      {/* Education & Career */}
      <SectionCard title="Education & Career" onEdit={() => goToEdit('career')}>
        <SectionRow label="Education" value={profile?.education} onEdit={() => goToEdit('career')} />
        <SectionRow label="Profession" value={profile?.profession} onEdit={() => goToEdit('career')} />
        <SectionRow
          label="Income"
          value={profile?.income ? `₹${(profile.income / 100000).toFixed(1)}L/yr` : null}
          onEdit={() => goToEdit('career')}
        />
      </SectionCard>

      {/* Location */}
      <SectionCard title="Location" onEdit={() => goToEdit('location')}>
        <SectionRow label="City" value={profile?.city} onEdit={() => goToEdit('location')} />
        <SectionRow label="State" value={profile?.state} onEdit={() => goToEdit('location')} />
      </SectionCard>

      {/* Voice Intro */}
      {!previewMode && (
        <VoiceIntroRecorder
          existingUrl={profile?.voiceIntroUrl ?? null}
          onSaved={handleVoiceIntroSaved}
        />
      )}

      {/* Compatibility Quiz entry */}
      <TouchableOpacity
        style={[styles.quizBanner, { backgroundColor: c.accentSoft, borderColor: c.primary + '40' }]}
        onPress={() => navigation.navigate('Quiz')}
        testID="quiz-cta"
        accessibilityLabel="Take compatibility quiz"
      >
        <Ionicons name="help-circle-outline" size={22} color={c.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.quizBannerTitle, { color: c.textPrimary }]}>Compatibility Quiz</Text>
          <Text style={[styles.quizBannerSub, { color: c.textMuted }]}>10 questions · Better match suggestions</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </TouchableOpacity>

      {/* About */}
      <SectionCard title="About Me" onEdit={() => goToEdit('about')}>
        {profile?.bio ? (
          <Text style={[styles.bioText, { color: c.textPrimary }]}>{profile.bio}</Text>
        ) : (
          <TouchableOpacity onPress={() => goToEdit('about')} testID="add-bio">
            <Text style={[styles.addText, { color: c.primary }]}>+ Add bio</Text>
          </TouchableOpacity>
        )}
        {(profile?.interestTags?.length ?? 0) > 0 && (
          <View style={styles.tagsRow}>
            {profile!.interestTags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: c.accentSoft }]}>
                <Text style={[styles.tagText, { color: c.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {/* Lifestyle */}
      <SectionCard title="Lifestyle" onEdit={() => goToEdit('lifestyle')}>
        <SectionRow label="Diet" value={profile?.diet} onEdit={() => goToEdit('lifestyle')} />
        <SectionRow label="Smoking" value={profile?.smoking} onEdit={() => goToEdit('lifestyle')} />
        <SectionRow label="Drinking" value={profile?.drinking} onEdit={() => goToEdit('lifestyle')} />
      </SectionCard>

      {/* Family */}
      <SectionCard title="Family" onEdit={() => goToEdit('family')}>
        <SectionRow label="Family Type" value={profile?.familyType} onEdit={() => goToEdit('family')} />
        <SectionRow
          label="Father's Occupation"
          value={profile?.fatherOccupation}
          onEdit={() => goToEdit('family')}
        />
        <SectionRow
          label="Mother's Occupation"
          value={profile?.motherOccupation}
          onEdit={() => goToEdit('family')}
        />
      </SectionCard>

      {/* Horoscope */}
      <SectionCard title="Horoscope" onEdit={() => goToEdit('horoscope')}>
        <SectionRow
          label="Manglik Status"
          value={profile?.manglikStatus?.replace(/_/g, ' ') ?? null}
          onEdit={() => goToEdit('horoscope')}
        />
        <SectionRow
          label="Birth Place"
          value={profile?.placeOfBirth}
          onEdit={() => goToEdit('horoscope')}
        />
        <SectionRow
          label="Zodiac / Rashi"
          value={[profile?.zodiacSign, profile?.rashi].filter(Boolean).join(' / ') || null}
          onEdit={() => goToEdit('horoscope')}
        />
      </SectionCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },

  photoScroll: { height: 320 },
  // Width comes from useWindowDimensions at the call site — a fixed 375 letterboxed
  // the hero and desynced the paging dots on every device that is not a 375pt iPhone.
  photo: { height: 320 },
  photoEmpty: {
    backgroundColor: colours.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoEmptyText: {
    fontSize: typography.fontSize.sm,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.medium,
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
  addPhotosBtnText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colours.border,
  },
  dotActive: { backgroundColor: colours.primary, width: 16 },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  name: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.display, // Playfair — the member's name is the identity
    color: colours.textPrimary,
    marginBottom: 4,
  },
  subText: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.regular,
    marginBottom: 2,
  },

  planBadge: {
    backgroundColor: colours.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    minWidth: 80,
  },
  planText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.primary,
  },
  upgradeText: {
    fontSize: typography.fontSize.xs,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
    marginTop: 2,
  },

  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    minHeight: 44,
  },
  codeLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium },
  codeValue: { flex: 1, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold, letterSpacing: 0.5 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  previewLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },

  completeBtn: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colours.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  completeBtnText: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
  },

  bioText: {
    fontSize: typography.fontSize.sm,
    color: colours.textPrimary,
    lineHeight: 22,
  },
  addText: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    backgroundColor: colours.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
  },
  quizBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colours.primaryLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colours.primary + '40',
  },
  quizBannerTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  quizBannerSub: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
  },
});
