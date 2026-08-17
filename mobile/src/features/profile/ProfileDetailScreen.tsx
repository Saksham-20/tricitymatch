import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  Extrapolation,
} from 'react-native-reanimated';
import { showToast } from '../../utils/toast';
import { haptics } from '../../utils/haptics';
import { colours, typography, type, spacing, borderRadius } from '@shared/constants/theme';
import { CompatRing, MatchCelebration } from '../../components/ui';
import { ProfileDetailSkeleton } from '../../components/ui/skeletons';
import { PressableScale } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import { getProfile, getCompatibilityBreakdown, getMyProfile } from '../../api/profile';
import PreferenceMatch from '../../components/profile/PreferenceMatch';
import AudioIntroChip from '../../components/profile/AudioIntroChip';
import { fromProfilePrompts } from '../../constants/prompts';
import { performMatchAction } from '../../api/matches';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import BlockReportSheet from './BlockReportSheet';
import CompatibilityBreakdownSheet from './CompatibilityBreakdownSheet';
import HeroBlock from './detail/HeroBlock';
import PhotoBlock from './detail/PhotoBlock';
import SectionCard from './detail/SectionCard';
import RevealOnScroll from './detail/RevealOnScroll';
import PhotoGalleryViewer from './detail/PhotoGalleryViewer';
import type { MainStackParamList } from '../../navigation/types';
import type { MatchAction } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'ProfileDetail'>;

// ─── Small pieces ────────────────────────────────────────────────────────────

const compatScoreColour = (p: number) => (p >= 90 ? colours.success : p >= 75 ? colours.g500 : colours.p500);

/** Compact stat chip for the essence band (height · education · community…). */
function StatChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { c } = useTheme();
  return (
    <View style={[s.statChip, { backgroundColor: c.surface2 }]}>
      <Ionicons name={icon} size={13} color={c.primary} />
      <Text style={[s.statChipText, { color: c.textPrimary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const { c } = useTheme();
  if (!value) return null;
  return (
    <View style={[s.detailRow, { borderBottomColor: c.hairline }]}>
      <Text style={[s.detailLabel, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[s.detailValue, { color: c.textPrimary }]}>{value}</Text>
    </View>
  );
}


// Warm matrimonial caption bands for interleaved photos — rotated per photo.
// Family-forward voice, never dating-app prompts.
function photoCaption(idx: number, firstName: string, city?: string | null): { eyebrow: string; caption: string } {
  const bands = [
    { eyebrow: `${firstName}'s world`, caption: 'A little more of the person behind the profile.' },
    { eyebrow: 'Family & values', caption: 'The things that matter — captured in a moment.' },
    { eyebrow: city ? `Life in ${city}` : 'Everyday life', caption: 'Where the everyday happens.' },
  ];
  return bands[idx % bands.length];
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProfileDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = route.params;
  const queryClient = useQueryClient();
  const user = useAuthStore((st) => st.user);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  const [mutualMatch, setMutualMatch] = useState(false);
  const [actionDone, setActionDone] = useState<MatchAction | null>(null);
  const [blockReportVisible, setBlockReportVisible] = useState(false);
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [appreciateSubject, setAppreciateSubject] = useState<string | null>(null);

  const heroH = Math.max(380, Math.round(winH * 0.56));
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Floating header: transparent over the hero, solid + titled once past it.
  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [heroH - 160, heroH - 80], [0, 1], Extrapolation.CLAMP),
  }));
  const headerTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [heroH - 120, heroH - 60], [0, 1], Extrapolation.CLAMP),
  }));

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => getProfile(userId),
    staleTime: 5 * 60 * 1000,
  });

  // Real compatibility — shares the breakdown sheet's query key so it's fetched
  // once and stays consistent with the score on Home/Search cards.
  const { data: compat } = useQuery({
    queryKey: ['compatibility', userId],
    queryFn: () => getCompatibilityBreakdown(userId),
    staleTime: 5 * 60 * 1000,
  });

  // Viewer's own profile — feeds the reverse partner-preference checklist.
  const { data: myProfile } = useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  });

  const actionMutation = useMutation({
    mutationFn: (action: MatchAction) => performMatchAction(userId, action),
    onSuccess: (data) => {
      setActionDone(data.match.action);
      if (data.isMutualMatch) setMutualMatch(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyMatches });
      queryClient.invalidateQueries({ queryKey: queryKeys.mutualMatches });
    },
    onError: () => {
      showToast.error('Something went wrong', 'Could not perform action. Please try again.');
    },
  });

  const handleAction = (action: MatchAction) => {
    if (actionDone) return;
    actionMutation.mutate(action);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }} testID="ProfileDetailLoading">
        <ProfileDetailSkeleton />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[s.loader, { backgroundColor: c.background }]}>
        <Text style={{ color: c.textSecondary }}>Profile not found.</Text>
      </View>
    );
  }

  const photos: string[] = profile.profilePhoto
    ? [profile.profilePhoto, ...(profile.photos || []).filter((p) => p !== profile.profilePhoto)]
    : profile.photos || [];
  const heroPhoto: string | null = photos[0] ?? null;
  const restPhotos = photos.slice(1);

  // Viewing your own profile ("see it as others do") — no actions, no compat.
  const isSelf = user?.id === profile.userId;
  const isMutualOrPremium = isSelf || actionDone === 'like' || user?.subscriptionPlan !== 'free';
  // Free viewers only get the primary photo in the gallery; the rest stay locked.
  const viewablePhotos = isMutualOrPremium ? photos : photos.slice(0, 1);

  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const promptPairs = fromProfilePrompts(profile.profilePrompts as Record<string, string> | null);
  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  // Essence chips — the at-a-glance matrimonial facts.
  const essence: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [];
  if (profile.height) essence.push({ icon: 'resize-outline', label: `${profile.height} cm` });
  if (profile.education) essence.push({ icon: 'school-outline', label: profile.education });
  if (profile.religion) {
    essence.push({
      icon: 'people-outline',
      label: [profile.religion, profile.caste].filter(Boolean).join(' · '),
    });
  }
  if (profile.maritalStatus) essence.push({ icon: 'heart-outline', label: profile.maritalStatus.replace(/_/g, ' ') });
  if (profile.manglikStatus) essence.push({ icon: 'moon-outline', label: `Manglik: ${profile.manglikStatus.replace(/_/g, ' ')}` });

  // Interleave: photo after every other content stretch (max one per two blocks).
  const photoAt = (i: number) => {
    const uri = restPhotos[i];
    if (!uri) return null;
    const band = photoCaption(i, profile.firstName, profile.city);
    return (
      <RevealOnScroll scrollY={scrollY}>
        <PhotoBlock
          uri={uri}
          eyebrow={band.eyebrow}
          caption={band.caption}
          locked={!isMutualOrPremium}
          onPress={isMutualOrPremium ? () => setGalleryIndex(i + 1) : undefined}
          onLongPress={
            isMutualOrPremium && !isSelf
              ? () => {
                  haptics.medium();
                  setAppreciateSubject(band.eyebrow);
                }
              : undefined
          }
        />
      </RevealOnScroll>
    );
  };

  const hasFamily =
    profile.familyType || profile.fatherOccupation || profile.motherOccupation || profile.numberOfSiblings;
  const hasLifestyle = profile.diet || profile.smoking || profile.drinking;
  const hasAstro =
    profile.manglikStatus || profile.rashi || profile.nakshatra || profile.placeOfBirth || profile.birthTime;

  return (
    <View style={[s.wrapper, { backgroundColor: c.background }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        testID="ProfileDetailScreen"
      >
        <HeroBlock
          photoUri={heroPhoto}
          name={name}
          age={age}
          city={profile.city}
          profession={profile.profession}
          verified={profile.isVerified}
          compatScore={typeof compat?.overallScore === 'number' ? compat.overallScore : null}
          scrollY={scrollY}
          height={heroH}
          photoCount={viewablePhotos.length}
          onOpenGallery={() => setGalleryIndex(0)}
        />

        {/* Essence band — at-a-glance facts */}
        {essence.length > 0 && (
          <View style={s.essenceBand}>
            {essence.map((e) => (
              <StatChip key={e.label} icon={e.icon} label={e.label} />
            ))}
          </View>
        )}

        {/* Compatibility card */}
        {!isSelf && typeof compat?.overallScore === 'number' && (
          <RevealOnScroll scrollY={scrollY}>
            <PressableScale onPress={() => setBreakdownVisible(true)} haptic testID="compatibility-bar">
              <SectionCard style={s.compatCard}>
                <View style={s.compatRow}>
                  <CompatRing value={compat.overallScore} size={64} />
                  <View style={s.compatInfo}>
                    <Text style={[type.headline, { color: c.fgStrong }]}>Compatibility</Text>
                    <Text style={[type.footnote, { color: c.textMuted, marginTop: 2 }]}>
                      Tap to see the full breakdown
                    </Text>
                  </View>
                  <View style={s.compatWhy}>
                    <Text style={[type.subhead, { color: compatScoreColour(compat.overallScore), fontFamily: 'Inter-SemiBold' }]}>
                      Why
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                  </View>
                </View>
              </SectionCard>
            </PressableScale>
          </RevealOnScroll>
        )}

        {/* Voice intro — modern audio chip */}
        {profile.voiceIntroUrl && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title={`Hear from ${profile.firstName}`} icon="mic-outline">
              <AudioIntroChip url={profile.voiceIntroUrl} isPremiumViewer={isMutualOrPremium} />
            </SectionCard>
          </RevealOnScroll>
        )}

        {/* About — editorial pull-quote card */}
        {profile.bio && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title={`About ${profile.firstName}`} icon="book-outline">
              <Text style={[s.bioText, { color: c.textPrimary }]}>{profile.bio}</Text>
              {(profile.interestTags?.length ?? 0) > 0 && (
                <View style={s.tagsRow}>
                  {profile.interestTags.map((tag) => (
                    <View key={tag} style={[s.tag, { backgroundColor: c.accentSoft }]}>
                      <Text style={[s.tagText, { color: c.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </SectionCard>
          </RevealOnScroll>
        )}

        {photoAt(0)}

        {/* Family & values — the parent-friendly heart of the story */}
        {(hasFamily || hasLifestyle) && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title="Family & values" icon="home-outline" tinted>
              <DetailRow label="Family Type" value={profile.familyType ?? undefined} />
              <DetailRow label="Father's Occupation" value={profile.fatherOccupation ?? undefined} />
              <DetailRow label="Mother's Occupation" value={profile.motherOccupation ?? undefined} />
              <DetailRow label="Siblings" value={profile.numberOfSiblings ? `${profile.numberOfSiblings}` : undefined} />
              <DetailRow label="Diet" value={profile.diet ?? undefined} />
              <DetailRow label="Smoking" value={profile.smoking ?? undefined} />
              <DetailRow label="Drinking" value={profile.drinking ?? undefined} />
            </SectionCard>
          </RevealOnScroll>
        )}

        {photoAt(1)}

        {/* Prompts — "get to know them" Q&As */}
        {promptPairs.length > 0 && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title={`Get to know ${profile.firstName}`} icon="chatbubble-ellipses-outline">
              {promptPairs.map(({ prompt, answer }) => (
                <View key={prompt} style={s.promptItem}>
                  <Text style={[s.promptQ, { color: c.primary }]}>{prompt}</Text>
                  <Text style={[s.promptA, { color: c.textPrimary }]}>{answer}</Text>
                </View>
              ))}
            </SectionCard>
          </RevealOnScroll>
        )}

        {/* Reverse partner-preference checklist */}
        {!isSelf && (
          <RevealOnScroll scrollY={scrollY}>
            <PreferenceMatch target={profile} viewer={myProfile} targetName={profile.firstName} />
          </RevealOnScroll>
        )}

        {/* Education & career + community details */}
        <RevealOnScroll scrollY={scrollY}>
          <SectionCard title="Education & career" icon="school-outline">
            <DetailRow label="Education" value={profile.education ?? undefined} />
            <DetailRow label="Degree" value={profile.degree ?? undefined} />
            <DetailRow label="Profession" value={profile.profession ?? undefined} />
            <DetailRow label="City" value={profile.city} />
            <DetailRow label="State" value={profile.state} />
          </SectionCard>
        </RevealOnScroll>

        <RevealOnScroll scrollY={scrollY}>
          <SectionCard title="Community" icon="people-outline">
            <DetailRow label="Religion" value={profile.religion ?? undefined} />
            <DetailRow label="Caste" value={profile.caste ?? undefined} />
            <DetailRow label="Sub-caste" value={profile.subCaste ?? undefined} />
            <DetailRow label="Mother Tongue" value={profile.motherTongue ?? undefined} />
          </SectionCard>
        </RevealOnScroll>

        {photoAt(2)}

        {/* Horoscope */}
        {hasAstro && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title="Horoscope" icon="moon-outline">
              <DetailRow label="Manglik" value={profile.manglikStatus?.replace(/_/g, ' ')} />
              <DetailRow label="Rashi" value={profile.rashi ?? undefined} />
              <DetailRow label="Nakshatra" value={profile.nakshatra ?? undefined} />
              <DetailRow label="Birth Place" value={profile.placeOfBirth ?? undefined} />
              <DetailRow label="Birth Time" value={profile.birthTime ?? undefined} />
              <TouchableOpacity
                style={s.kundliBtn}
                onPress={() =>
                  navigation.navigate('HoroscopeMatch', {
                    userId: profile.userId,
                    name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
                  })
                }
              >
                <Ionicons name="moon-outline" size={16} color={c.primary} />
                <Text style={[s.kundliBtnText, { color: c.primary }]}>View Ashtakoot Guna Milan →</Text>
              </TouchableOpacity>
            </SectionCard>
          </RevealOnScroll>
        )}

        {/* Remaining photos flow out the story */}
        {restPhotos.slice(3).map((uri, i) => {
          const band = photoCaption(3 + i, profile.firstName, profile.city);
          return (
            <RevealOnScroll key={uri} scrollY={scrollY}>
              <PhotoBlock
                uri={uri}
                eyebrow={band.eyebrow}
                caption={band.caption}
                locked={!isMutualOrPremium}
                onPress={isMutualOrPremium ? () => setGalleryIndex(4 + i) : undefined}
              />
            </RevealOnScroll>
          );
        })}

        {/* Quiet safety footer */}
        {!isSelf && (
        <TouchableOpacity
          style={s.safetyFooter}
          onPress={() => setBlockReportVisible(true)}
          accessibilityLabel={`Report or block ${profile.firstName}`}
        >
          <Ionicons name="shield-outline" size={14} color={c.textMuted} />
          <Text style={[type.footnote, { color: c.textMuted }]}>Report or block {profile.firstName}</Text>
        </TouchableOpacity>
        )}

        <View style={{ height: 110 }} />
      </Animated.ScrollView>

      {/* Floating header — transparent over hero, solid + titled after */}
      <View style={[s.floatHeader, { paddingTop: insets.top + spacing.xs }]} pointerEvents="box-none">
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: c.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, headerBgStyle]}
          pointerEvents="none"
        />
        <PressableScale
          scaleTo={0.9}
          onPress={() => navigation.goBack()}
          style={s.iconBtn}
          testID="back-btn"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#fff" style={s.iconShadow} />
        </PressableScale>
        <Animated.Text style={[s.floatTitle, { color: c.fgStrong }, headerTitleStyle]} numberOfLines={1}>
          {name}
        </Animated.Text>
        <PressableScale
          scaleTo={0.9}
          style={s.iconBtn}
          onPress={() => setBlockReportVisible(true)}
          testID="menu-btn"
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" style={s.iconShadow} />
        </PressableScale>
      </View>

      {/* Sticky bottom action bar */}
      {!isSelf && (
      <View
        style={[
          s.actionBar,
          {
            backgroundColor: c.background,
            borderTopColor: c.border,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        {actionDone === 'like' ? (
          <View style={s.mutualHint}>
            <Ionicons name="heart" size={20} color={c.primary} />
            <Text style={[s.mutualHintText, { color: c.primary }]}>
              {mutualMatch ? "It's a match! Start chatting." : 'Interest sent!'}
            </Text>
          </View>
        ) : (
          <>
            <PressableScale
              style={[s.actionBtn, { backgroundColor: c.surfaceCard, borderWidth: 1, borderColor: c.border }]}
              onPress={() => handleAction('pass')}
              disabled={actionMutation.isPending}
              testID="action-pass"
              accessibilityRole="button"
              accessibilityLabel="Pass"
            >
              <Ionicons name="close" size={24} color={c.textSecondary} />
              <Text style={[s.actionText, { color: c.textSecondary }]}>Pass</Text>
            </PressableScale>

            <PressableScale
              style={[s.actionBtn, { backgroundColor: c.goldSoft, borderWidth: 1, borderColor: colours.g500 + '40' }]}
              onPress={() => handleAction('shortlist')}
              disabled={actionMutation.isPending}
              haptic
              testID="action-shortlist"
              accessibilityRole="button"
              accessibilityLabel="Shortlist"
            >
              <Ionicons name="bookmark" size={24} color={colours.g600} />
              <Text style={[s.actionText, { color: colours.g600 }]}>Shortlist</Text>
            </PressableScale>

            <PressableScale
              style={[s.actionBtn, { backgroundColor: c.primary }]}
              onPress={() => handleAction('like')}
              disabled={actionMutation.isPending}
              haptic
              testID="action-like"
              accessibilityRole="button"
              accessibilityLabel="Interested"
            >
              {actionMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="heart" size={24} color="#fff" />
                  <Text style={[s.actionText, s.likeText]}>Interested</Text>
                </>
              )}
            </PressableScale>
          </>
        )}
      </View>
      )}

      <MatchCelebration
        visible={mutualMatch}
        name={profile.firstName}
        onClose={() => setMutualMatch(false)}
        onMessage={() => {
          setMutualMatch(false);
          if (user?.subscriptionPlan !== 'free') {
            navigation.navigate('ChatThread', { userId, name, photo: heroPhoto ?? undefined });
          } else {
            navigation.navigate('Subscription');
          }
        }}
      />

      <BlockReportSheet
        visible={blockReportVisible}
        userId={userId}
        userName={name}
        onClose={() => setBlockReportVisible(false)}
        onBlocked={() => navigation.goBack()}
      />

      <CompatibilityBreakdownSheet
        visible={breakdownVisible}
        userId={userId}
        onClose={() => setBreakdownVisible(false)}
      />

      <PhotoGalleryViewer
        photos={viewablePhotos}
        initialIndex={galleryIndex ?? 0}
        visible={galleryIndex !== null}
        onClose={() => setGalleryIndex(null)}
      />

      {/* Appreciate sheet — long-press a photo, carry the warmth into the
          first message (client-side prefill; chat gating unchanged). */}
      <Modal
        visible={appreciateSubject !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAppreciateSubject(null)}
      >
        <TouchableOpacity style={s.appBackdrop} activeOpacity={1} onPress={() => setAppreciateSubject(null)} />
        <View style={[s.appSheet, { backgroundColor: c.background, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={[s.appGrabber, { backgroundColor: c.border }]} />
          <Ionicons name="heart-circle" size={40} color={c.primary} style={{ alignSelf: 'center' }} />
          <Text style={[s.appTitle, { color: c.fgStrong }]}>A lovely detail</Text>
          <Text style={[type.callout, { color: c.textSecondary, textAlign: 'center' }]}>
            Mention what caught your eye when you connect with {profile.firstName} — thoughtful first
            messages get warmer replies.
          </Text>
          <TouchableOpacity
            style={[s.appCta, { backgroundColor: c.primary }]}
            onPress={() => {
              const subject = appreciateSubject;
              setAppreciateSubject(null);
              if (user?.subscriptionPlan !== 'free') {
                navigation.navigate('ChatThread', {
                  userId,
                  name,
                  photo: heroPhoto ?? undefined,
                  draft: `Hello ${profile.firstName}, the photo under “${subject}” stood out to me. I would love to know the story behind it.`,
                });
              } else {
                navigation.navigate('Subscription');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Mention in a message"
            testID="appreciate-cta"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
            <Text style={s.appCtaText}>
              {user?.subscriptionPlan !== 'free' ? 'Mention in a message' : 'Upgrade to message'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  floatHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    zIndex: 10,
  },
  floatTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 18,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  essenceBand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 240,
  },
  statChipText: { ...type.caption, fontFamily: 'Inter-Medium' },

  compatCard: { marginTop: spacing.lg },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  compatInfo: { flex: 1 },
  compatWhy: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  bioText: { ...type.body, fontSize: 16, lineHeight: 24 },
  promptItem: { marginBottom: spacing.md },
  promptQ: {
    fontFamily: 'PlayfairDisplay-Italic',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  promptA: { ...type.callout, lineHeight: 22 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tag: { borderRadius: borderRadius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  tagText: { ...type.caption },

  detailRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: { width: 130, ...type.footnote, fontFamily: 'Inter-Medium' },
  detailValue: { flex: 1, ...type.footnote },

  kundliBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  kundliBtnText: { ...type.subhead },

  safetyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing['2xl'],
    paddingVertical: spacing.sm,
  },

  appBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  appSheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  appGrabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  appTitle: { fontFamily: 'PlayfairDisplay-Bold', fontSize: 22, textAlign: 'center' },
  appCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  appCtaText: { ...type.headline, color: '#fff' },

  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
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
  actionText: { ...type.subhead },
  likeText: { color: '#fff', fontFamily: 'Inter-SemiBold' },

  mutualHint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  mutualHintText: { ...type.headline },

});
