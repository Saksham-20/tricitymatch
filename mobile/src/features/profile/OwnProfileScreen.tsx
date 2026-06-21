import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { resolveImageUri } from '../../components/common/SmartImage';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getMyProfile } from '../../api/profile';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import type { MainStackParamList } from '../../navigation/types';
import type { Profile } from '../../types';
import VoiceIntroRecorder from '../../components/profile/VoiceIntroRecorder';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Milestone Strip ─────────────────────────────────────────────────────────

const MILESTONES = [
  { pct: 50,  label: '50%',  tip: 'Add education & profession' },
  { pct: 70,  label: '70%',  tip: 'Upload Kundli' },
  { pct: 80,  label: '80%',  tip: 'Add bio & interests' },
  { pct: 100, label: '100%', tip: 'Profile complete!' },
];

function MilestoneStrip({ currentPct }: { currentPct: number }) {
  return (
    <View style={ms.container}>
      <Text style={ms.heading}>Completion Milestones</Text>
      <View style={ms.row}>
        {MILESTONES.map((m) => {
          const achieved = currentPct >= m.pct;
          return (
            <View key={m.pct} style={ms.item}>
              <View style={[ms.dot, achieved && ms.dotDone]}>
                {achieved ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : (
                  <Text style={ms.dotLabel}>{m.label}</Text>
                )}
              </View>
              {!achieved && <Text style={ms.tip}>{m.tip}</Text>}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  heading: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colours.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  dotDone: { backgroundColor: colours.success || colours.primary, borderColor: colours.success || colours.primary },
  dotLabel: { fontSize: 7, color: colours.textMuted, fontFamily: typography.fontFamily.bold },
  tip: {
    fontSize: typography.fontSize.xs - 1 || 10,
    color: colours.textMuted,
    textAlign: 'center',
    lineHeight: 14,
  },
});

// ─── Completion Ring ─────────────────────────────────────────────────────────

function CompletionRing({ pct }: { pct: number }) {
  const filled = Math.round(pct / 10);
  return (
    <View style={ring.container} testID="completion-ring">
      <View style={ring.ring}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View
            key={i}
            style={[
              ring.segment,
              { transform: [{ translateY: 37 }, { rotate: `${i * 36}deg` }, { translateY: -37 }] },
              i < filled ? ring.segmentFilled : ring.segmentEmpty,
            ]}
          />
        ))}
        <View style={ring.inner}>
          <Text style={ring.pct}>{pct}%</Text>
          <Text style={ring.label}>Complete</Text>
        </View>
      </View>
    </View>
  );
}

const ring = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.md },
  ring: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: colours.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  segment: {
    position: 'absolute',
    width: 4,
    height: 14,
    top: 6,
    left: '50%',
    marginLeft: -2,
    borderRadius: 2,
  },
  segmentFilled: { backgroundColor: colours.primary },
  segmentEmpty: { backgroundColor: colours.border },
  inner: { alignItems: 'center' },
  pct: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colours.primary,
  },
  label: {
    fontSize: typography.fontSize.xs,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
});

// ─── Verification Badges ─────────────────────────────────────────────────────

const VERIFICATION_TIERS = [
  { key: 'mobile', label: 'Mobile', color: colours.badgeMobile, icon: 'phone-portrait' },
  { key: 'id', label: 'ID', color: colours.badgeID, icon: 'card' },
  { key: 'education', label: 'Education', color: colours.badgeEducation, icon: 'school' },
  { key: 'income', label: 'Income', color: colours.badgeIncome, icon: 'cash' },
] as const;

interface VerifBadgesProps {
  phoneVerified: boolean;
  idVerified: boolean;
  onGetVerified: () => void;
}

function VerificationBadges({ phoneVerified, idVerified, onGetVerified }: VerifBadgesProps) {
  const earned = [phoneVerified, idVerified, false, false];
  return (
    <View style={vb.container}>
      <View style={vb.row}>
        {VERIFICATION_TIERS.map((tier, i) => (
          <View key={tier.key} style={[vb.badge, earned[i] && { borderColor: tier.color }]}>
            <Ionicons
              name={earned[i] ? 'checkmark-circle' : 'ellipse-outline'}
              size={14}
              color={earned[i] ? tier.color : colours.textMuted}
            />
            <Text style={[vb.badgeText, earned[i] && { color: tier.color }]}>{tier.label}</Text>
          </View>
        ))}
      </View>
      {!idVerified && (
        <TouchableOpacity
          style={vb.ctaBtn}
          onPress={onGetVerified}
          testID="get-verified-cta"
          accessibilityLabel="Get Verified"
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={colours.primary} />
          <Text style={vb.ctaText}>Get Verified → Add trust badge</Text>
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
  return (
    <TouchableOpacity
      style={sr.row}
      onPress={onEdit}
      testID={testID ?? `edit-${label}`}
      accessibilityLabel={`Edit ${label}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={sr.label}>{label}</Text>
        <Text style={[sr.value, !value && sr.empty]}>{value || 'Not added'}</Text>
      </View>
      <Ionicons name="pencil-outline" size={16} color={colours.textMuted} />
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
  return (
    <View style={sc.card}>
      <View style={sc.header}>
        <Text style={sc.title}>{title}</Text>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} testID={`edit-section-${title}`} accessibilityLabel={`Edit ${title}`}>
            <Ionicons name="pencil-outline" size={18} color={colours.primary} />
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

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OwnProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const [previewMode, setPreviewMode] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
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
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colours.primary} />
      </View>
    );
  }

  const name = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : user?.email ?? '';

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      testID="OwnProfileScreen"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          onPress={goToSettings}
          testID="settings-btn"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={24} color={colours.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Photo gallery */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / 375);
          setPhotoIdx(idx);
        }}
        style={styles.photoScroll}
        testID="photo-gallery"
      >
        {photos.length > 0 ? (
          photos.map((uri, i) => (
            <Image
              key={i}
              source={{ uri: resolveImageUri(previewMode ? uri + '?blur=20' : uri) ?? undefined }}
              style={styles.photo}
              resizeMode="cover"
              blurRadius={previewMode ? 20 : 0}
            />
          ))
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <Ionicons name="camera-outline" size={48} color={colours.textMuted} />
            <Text style={styles.photoEmptyText}>Add photos</Text>
          </View>
        )}
      </ScrollView>

      {/* Photo dots */}
      {photos.length > 1 && (
        <View style={styles.dotsRow}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === photoIdx && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Name, age, location */}
      <View style={styles.nameRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          {profile?.dateOfBirth && (
            <Text style={styles.subText}>
              {Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))} yrs
              {profile.city ? ` · ${profile.city}` : ''}
            </Text>
          )}
          {profile?.profession && (
            <Text style={styles.subText}>{profile.profession}</Text>
          )}
        </View>
        {/* Plan badge */}
        <TouchableOpacity
          style={styles.planBadge}
          onPress={goToSubscription}
          testID="plan-badge"
          accessibilityLabel="Subscription plan"
        >
          <Text style={styles.planText}>{planLabel}</Text>
          {user?.subscriptionPlan === 'free' && (
            <Text style={styles.upgradeText}>Upgrade ↑</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Preview toggle */}
      <View style={styles.previewRow}>
        <Ionicons name="eye-outline" size={16} color={colours.textSecondary} />
        <Text style={styles.previewLabel}>Preview as others see me</Text>
        <Switch
          value={previewMode}
          onValueChange={setPreviewMode}
          trackColor={{ true: colours.primary, false: colours.border }}
          thumbColor="#fff"
          testID="preview-toggle"
          accessibilityLabel="Preview as others see me"
        />
      </View>

      {/* Completion ring */}
      <CompletionRing pct={profile?.completionPercentage ?? 0} />
      {(profile?.completionPercentage ?? 0) < 100 && (
        <TouchableOpacity
          style={styles.completeBtn}
          onPress={() => goToEdit()}
          testID="complete-profile-btn"
          accessibilityLabel="Complete profile"
        >
          <Text style={styles.completeBtnText}>Complete your profile → Better matches</Text>
        </TouchableOpacity>
      )}

      {/* Milestone strip */}
      <MilestoneStrip currentPct={profile?.completionPercentage ?? 0} />

      {/* Verification badges */}
      <VerificationBadges
        phoneVerified={user?.phoneVerified ?? false}
        idVerified={false}
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
          value={profile?.dateOfBirth ?? null}
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
        style={styles.quizBanner}
        onPress={() => navigation.navigate('Quiz')}
        testID="quiz-cta"
        accessibilityLabel="Take compatibility quiz"
      >
        <Ionicons name="help-circle-outline" size={22} color={colours.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.quizBannerTitle}>Compatibility Quiz</Text>
          <Text style={styles.quizBannerSub}>10 questions · Better match suggestions</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colours.textMuted} />
      </TouchableOpacity>

      {/* About */}
      <SectionCard title="About Me" onEdit={() => goToEdit('about')}>
        {profile?.bio ? (
          <Text style={styles.bioText}>{profile.bio}</Text>
        ) : (
          <TouchableOpacity onPress={() => goToEdit('about')} testID="add-bio">
            <Text style={styles.addText}>+ Add bio</Text>
          </TouchableOpacity>
        )}
        {(profile?.interestTags?.length ?? 0) > 0 && (
          <View style={styles.tagsRow}>
            {profile!.interestTags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
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
    paddingTop: 52,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },

  photoScroll: { height: 320 },
  photo: { width: 375, height: 320 },
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
    fontFamily: typography.fontFamily.bold,
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
