import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, type, spacing, borderRadius } from '@shared/constants/theme';
import { CompatRing } from '../../components/ui';
import { getProfile, logProfileView, getCompatibilityBreakdown } from '../../api/profile';
import VoiceIntroRecorder from '../../components/profile/VoiceIntroRecorder';
import { resolveImageUri } from '../../components/common/SmartImage';
import { performMatchAction } from '../../api/matches';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import BlockReportSheet from './BlockReportSheet';
import CompatibilityBreakdownSheet from './CompatibilityBreakdownSheet';
import type { MainStackParamList } from '../../navigation/types';
import type { Profile, MatchAction } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'ProfileDetail'>;

// ─── Compatibility Bar ───────────────────────────────────────────────────────

const compatScoreColour = (p: number) => (p >= 90 ? colours.success : p >= 75 ? colours.g500 : colours.p500);

function CompatibilityBar({ score, onWhyPress }: { score: number; onWhyPress: () => void }) {
  const colour = compatScoreColour(score);
  return (
    <TouchableOpacity
      style={cb.container}
      onPress={onWhyPress}
      testID="compatibility-bar"
      accessibilityLabel="See compatibility breakdown"
      accessibilityRole="button"
    >
      <CompatRing value={score} size={64} />
      <View style={cb.info}>
        <Text style={cb.label}>Compatibility</Text>
        <Text style={cb.hint}>Tap to see the full breakdown</Text>
      </View>
      <View style={cb.whyRow}>
        <Text style={[cb.why, { color: colour }]}>Why</Text>
        <Ionicons name="chevron-forward" size={16} color={colours.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Hero photo (resolves relative/seed paths, graceful fallback) ─────────────
// Mirrors SmartImage's resolve + onError fallback but keeps the gallery's blur +
// "Upgrade to view" lock overlay for non-premium viewers' secondary photos.
function HeroPhoto({ uri, locked }: { uri: string; locked: boolean }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageUri(uri);
  if (!resolved || failed) {
    return (
      <View style={[styles.photoContainer, styles.photoFallback]}>
        <Ionicons name="person" size={64} color={colours.textMuted} />
      </View>
    );
  }
  return (
    <View style={styles.photoContainer}>
      <Image
        source={{ uri: resolved }}
        style={styles.photo}
        resizeMode="cover"
        blurRadius={locked ? 40 : 0}
        onError={() => setFailed(true)}
      />
      {locked && (
        <View style={styles.blurOverlay}>
          <Ionicons name="lock-closed" size={28} color="#fff" />
          <Text style={styles.blurText}>Upgrade to view</Text>
        </View>
      )}
    </View>
  );
}

const cb = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colours.hairline,
  },
  info: { flex: 1 },
  label: { ...type.headline, color: colours.fgStrong },
  hint: { ...type.footnote, color: colours.textMuted, marginTop: 2 },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  why: { ...type.subhead, color: colours.accent, fontFamily: 'Inter-SemiBold' },
});

// ─── Verification Badges ─────────────────────────────────────────────────────

const BADGES = [
  { key: 'mobile', label: 'Mobile', color: colours.badgeMobile },
  { key: 'id', label: 'ID', color: colours.badgeID },
  { key: 'education', label: 'Education', color: colours.badgeEducation },
  { key: 'income', label: 'Income', color: colours.badgeIncome },
] as const;

function VerificationRow({ phoneVerified }: { phoneVerified?: boolean }) {
  if (!phoneVerified) return null;
  return (
    <View style={vr.row}>
      <View style={[vr.badge, { borderColor: colours.badgeMobile }]}>
        <Ionicons name="checkmark-circle" size={12} color={colours.badgeMobile} />
        <Text style={[vr.text, { color: colours.badgeMobile }]}>Mobile</Text>
      </View>
    </View>
  );
}

const vr = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium },
});

// ─── Accordion Section ───────────────────────────────────────────────────────

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={acc.container}>
      <TouchableOpacity
        style={acc.header}
        onPress={() => setOpen((v) => !v)}
        testID={`accordion-${title}`}
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={acc.title}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colours.textMuted}
        />
      </TouchableOpacity>
      {open && <View style={acc.body}>{children}</View>}
    </View>
  );
}

const acc = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});

// ─── Detail Row ──────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={dr.row}>
      <Text style={dr.label}>{label}</Text>
      <Text style={dr.value}>{value}</Text>
    </View>
  );
}

const dr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colours.border + '60',
  },
  label: {
    width: 130,
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  value: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colours.textPrimary,
    fontFamily: typography.fontFamily.regular,
  },
});

// ─── Mutual Match Overlay ────────────────────────────────────────────────────

function MutualMatchOverlay({ name, onDismiss }: { name: string; onDismiss: () => void }) {
  return (
    <View style={mm.overlay}>
      <View style={mm.card}>
        <Ionicons name="heart" size={56} color={colours.primary} />
        <Text style={mm.title}>It's a Match</Text>
        <Text style={mm.sub}>You and {name} liked each other.</Text>
        <TouchableOpacity style={mm.btn} onPress={onDismiss} testID="mutual-match-dismiss">
          <Text style={mm.btnText}>Continue Browsing</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const mm = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.xl,
    padding: spacing['3xl'],
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing['2xl'],
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.primary,
  },
  sub: { fontSize: typography.fontSize.base, color: colours.textSecondary, textAlign: 'center' },
  btn: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  btnText: { color: '#fff', fontFamily: typography.fontFamily.semiBold, fontSize: typography.fontSize.base },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProfileDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = route.params;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [photoIdx, setPhotoIdx] = useState(0);
  const [mutualMatch, setMutualMatch] = useState(false);
  const [actionDone, setActionDone] = useState<MatchAction | null>(null);
  const [blockReportVisible, setBlockReportVisible] = useState(false);
  const [breakdownVisible, setBreakdownVisible] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => getProfile(userId),
    staleTime: 5 * 60 * 1000,
  });

  // Real compatibility (was previously faked from completionPercentage). Shares
  // the breakdown sheet's query key so it's fetched once and stays consistent
  // with the score shown on the Home/Search cards.
  const { data: compat } = useQuery({
    queryKey: ['compatibility', userId],
    queryFn: () => getCompatibilityBreakdown(userId),
    staleTime: 5 * 60 * 1000,
  });

  // Log profile view
  useEffect(() => {
    logProfileView(userId).catch(() => {});
  }, [userId]);

  const actionMutation = useMutation({
    mutationFn: (action: MatchAction) => performMatchAction(userId, action),
    onSuccess: (data) => {
      setActionDone(data.match.action);
      if (data.isMutualMatch) setMutualMatch(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyMatches });
      queryClient.invalidateQueries({ queryKey: queryKeys.mutualMatches });
    },
    onError: () => {
      Alert.alert('Error', 'Could not perform action. Please try again.');
    },
  });

  const handleAction = (action: MatchAction) => {
    if (actionDone) return;
    actionMutation.mutate(action);
  };

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colours.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: colours.textSecondary }}>Profile not found.</Text>
      </View>
    );
  }

  const photos: string[] = profile.profilePhoto
    ? [profile.profilePhoto, ...(profile.photos || []).filter((p) => p !== profile.profilePhoto)]
    : profile.photos || [];

  const isMutualOrPremium =
    actionDone === 'like' || user?.subscriptionPlan !== 'free';

  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} testID="ProfileDetailScreen">
        {/* Back + Menu header */}
        <View style={styles.absHeader}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconBtn}
            testID="back-btn"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setBlockReportVisible(true)}
            testID="menu-btn"
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
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
              <HeroPhoto key={i} uri={uri} locked={!isMutualOrPremium && i > 0} />
            ))
          ) : (
            <View style={[styles.photoContainer, styles.photoFallback]}>
              <Ionicons name="person" size={64} color={colours.textMuted} />
            </View>
          )}
        </ScrollView>

        {/* Photo dots */}
        {photos.length > 1 && (
          <View style={styles.dotsRow}>
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === photoIdx && styles.dotActive]} />
            ))}
          </View>
        )}

        {/* Name, age, location */}
        <View style={styles.infoSection}>
          <Text style={styles.name}>{name}{age ? `, ${age}` : ''}</Text>
          <Text style={styles.location}>{profile.city}{profile.state ? `, ${profile.state}` : ''}</Text>
          {profile.profession && <Text style={styles.profession}>{profile.profession}</Text>}
        </View>

        {/* Verification row */}
        <VerificationRow />

        {/* Compatibility */}
        {typeof compat?.overallScore === 'number' && (
          <CompatibilityBar
            score={compat.overallScore}
            onWhyPress={() => setBreakdownVisible(true)}
          />
        )}

        {/* Voice Intro — Premium+ gate applied inside component */}
        {profile.voiceIntroUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voice Intro</Text>
            <VoiceIntroRecorder
              existingUrl={profile.voiceIntroUrl}
              onSaved={() => null}
              isPremiumViewer={isMutualOrPremium}
              readOnly
            />
          </View>
        )}

        {/* About */}
        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Interest tags */}
        {(profile.interestTags?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <View style={styles.tagsRow}>
              {profile.interestTags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Accordion sections */}
        <Accordion title="Basic Details" defaultOpen>
          <DetailRow label="Age" value={age ? `${age} years` : undefined} />
          <DetailRow label="Height" value={profile.height ? `${profile.height} cm` : undefined} />
          <DetailRow label="Marital Status" value={profile.maritalStatus?.replace(/_/g, ' ')} />
        </Accordion>

        <Accordion title="Community">
          <DetailRow label="Religion" value={profile.religion ?? undefined} />
          <DetailRow label="Caste" value={profile.caste ?? undefined} />
          <DetailRow label="Sub-caste" value={profile.subCaste ?? undefined} />
          <DetailRow label="Mother Tongue" value={profile.motherTongue ?? undefined} />
        </Accordion>

        <Accordion title="Education & Career">
          <DetailRow label="Education" value={profile.education ?? undefined} />
          <DetailRow label="Degree" value={profile.degree ?? undefined} />
          <DetailRow label="Profession" value={profile.profession ?? undefined} />
        </Accordion>

        <Accordion title="Location">
          <DetailRow label="City" value={profile.city} />
          <DetailRow label="State" value={profile.state} />
        </Accordion>

        <Accordion title="Family">
          <DetailRow label="Family Type" value={profile.familyType ?? undefined} />
          <DetailRow label="Father's Occupation" value={profile.fatherOccupation ?? undefined} />
          <DetailRow label="Mother's Occupation" value={profile.motherOccupation ?? undefined} />
          <DetailRow
            label="Siblings"
            value={profile.numberOfSiblings ? `${profile.numberOfSiblings}` : undefined}
          />
        </Accordion>

        <Accordion title="Lifestyle">
          <DetailRow label="Diet" value={profile.diet ?? undefined} />
          <DetailRow label="Smoking" value={profile.smoking ?? undefined} />
          <DetailRow label="Drinking" value={profile.drinking ?? undefined} />
        </Accordion>

        <Accordion title="Horoscope">
          <DetailRow label="Manglik" value={profile.manglikStatus?.replace(/_/g, ' ')} />
          <DetailRow label="Rashi" value={profile.rashi ?? undefined} />
          <DetailRow label="Nakshatra" value={profile.nakshatra ?? undefined} />
          <DetailRow label="Birth Place" value={profile.placeOfBirth ?? undefined} />
          <DetailRow label="Birth Time" value={profile.birthTime ?? undefined} />
          <TouchableOpacity
            style={styles.kundliBtn}
            onPress={() => navigation.navigate('HoroscopeMatch', {
              userId: profile.userId,
              name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
            })}
          >
            <Ionicons name="moon-outline" size={16} color={colours.primary} />
            <Text style={styles.kundliBtnText}>View Ashtakoot Guna Milan →</Text>
          </TouchableOpacity>
        </Accordion>

        {/* Spacer for sticky action bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky bottom action bar */}
      <View style={styles.actionBar}>
        {actionDone === 'like' ? (
          <View style={styles.mutualHint}>
            <Ionicons name="heart" size={20} color={colours.primary} />
            <Text style={styles.mutualHintText}>
              {mutualMatch ? "It's a match! Start chatting." : 'Interest sent!'}
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.passBtn]}
              onPress={() => handleAction('pass')}
              disabled={actionMutation.isPending}
              testID="action-pass"
              accessibilityLabel="Pass"
            >
              <Ionicons name="close" size={24} color={colours.textSecondary} />
              <Text style={styles.passBtnText}>Pass</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.shortlistBtn]}
              onPress={() => handleAction('shortlist')}
              disabled={actionMutation.isPending}
              testID="action-shortlist"
              accessibilityLabel="Shortlist"
            >
              <Ionicons name="bookmark" size={24} color={colours.secondary} />
              <Text style={styles.shortlistBtnText}>Shortlist</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.likeBtn]}
              onPress={() => handleAction('like')}
              disabled={actionMutation.isPending}
              testID="action-like"
              accessibilityLabel="Interested"
            >
              {actionMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="heart" size={24} color="#fff" />
                  <Text style={styles.likeBtnText}>Interested</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Mutual match overlay */}
      {mutualMatch && (
        <MutualMatchOverlay name={profile.firstName} onDismiss={() => setMutualMatch(false)} />
      )}

      {/* Block / Report sheet */}
      <BlockReportSheet
        visible={blockReportVisible}
        userId={userId}
        userName={name}
        onClose={() => setBlockReportVisible(false)}
        onBlocked={() => navigation.goBack()}
      />

      {/* Compatibility breakdown sheet */}
      <CompatibilityBreakdownSheet
        visible={breakdownVisible}
        userId={userId}
        onClose={() => setBreakdownVisible(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colours.background },
  container: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  absHeader: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoScroll: { height: 380 },
  photoContainer: { width: 375, height: 380 },
  photo: { width: '100%', height: '100%' },
  photoFallback: {
    backgroundColor: colours.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  blurText: {
    color: '#fff',
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colours.border },
  dotActive: { backgroundColor: colours.primary, width: 16 },

  infoSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  name: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    marginBottom: 4,
  },
  location: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    marginBottom: 2,
  },
  profession: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
  },

  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  bioText: {
    fontSize: typography.fontSize.sm,
    color: colours.textPrimary,
    lineHeight: 22,
  },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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

  // Sticky action bar
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colours.border,
    backgroundColor: colours.background,
    gap: spacing.sm,
    alignItems: 'center',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 48,
  },
  passBtn: {
    backgroundColor: colours.surfaceCard,
    borderWidth: 1,
    borderColor: colours.border,
  },
  passBtnText: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  shortlistBtn: {
    backgroundColor: colours.secondaryLight,
    borderWidth: 1,
    borderColor: colours.secondary + '40',
  },
  shortlistBtnText: {
    fontSize: typography.fontSize.sm,
    color: colours.secondary,
    fontFamily: typography.fontFamily.medium,
  },
  likeBtn: { backgroundColor: colours.primary },
  likeBtnText: {
    fontSize: typography.fontSize.sm,
    color: '#fff',
    fontFamily: typography.fontFamily.semiBold,
  },
  mutualHint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  mutualHintText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.primary,
  },
  kundliBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  kundliBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.primary,
  },
});
