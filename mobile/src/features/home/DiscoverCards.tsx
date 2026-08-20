/**
 * Dashboard fill for the empty stretch below the match rails — two rotating
 * cards chosen by profile stage, never a stacked wall of upsells:
 *   - early profile (<60% or unverified): verification + invite + voice intro
 *   - established: membership (gold, founding-aware) + success story
 * Everything here reads data that already exists — no new backend.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type ThemeColours, spacing, borderRadius, type as t9 } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import SmartImage from '../../components/common/SmartImage';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { getPhotoVerification } from '../../api/verification';
import { getSuccessStories } from '../../api/profile';
import { getMyInvite } from '../../api/invite';
import { getMyProfile } from '../../api/profile';
import { queryKeys } from '../../constants/queryKeys';
import { showToast } from '../../utils/toast';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type CardKey = 'verify' | 'invite' | 'voice' | 'membership' | 'story';

export default function DiscoverCards() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const [inviteBusy, setInviteBusy] = useState(false);
  // Server-owned and env-tunable; 0 means the reward is off and the card makes
  // no claim. Read off the auth user so the card never mints an invite token
  // just to render.
  const inviteReward = useAuthStore((s) => s.user?.features?.inviteRewardUnlocks) ?? 0;

  const completionPct = user?.Profile?.completionPercentage ?? 0;
  const isFree = (user?.subscriptionPlan ?? 'free') === 'free';
  const foundingOpen = user?.features?.foundingOpen ?? false;

  const { data: verification } = useQuery({
    queryKey: queryKeys.verification,
    queryFn: getPhotoVerification,
    staleTime: 5 * 60 * 1000,
  });
  const { data: myProfile } = useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  });
  const established = completionPct >= 60;
  const { data: stories } = useQuery({
    queryKey: ['success-stories', 'public'],
    queryFn: getSuccessStories,
    staleTime: 60 * 60 * 1000,
    enabled: established, // story card only renders for established profiles
  });

  const verified = verification?.status === 'approved' || verification?.status === 'pending';
  const hasVoice = !!myProfile?.voiceIntroUrl;
  const story = stories?.find((s) => s.quote) ?? null;

  const shareInvite = async () => {
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      const { url } = await getMyInvite();
      await Share.share({
        message: `Looking for a match in the Tricity? Join me on TricityMatch — ${url}`,
      });
    } catch {
      showToast.error('Could not fetch your invite link', 'Try again in a moment.');
    } finally {
      setInviteBusy(false);
    }
  };

  // Priority by stage; render the first two eligible.
  const order: CardKey[] = established
    ? ['membership', 'story', 'verify', 'invite', 'voice']
    : ['verify', 'invite', 'voice'];
  const eligible = order.filter((k) => {
    if (k === 'verify') return !verified;
    if (k === 'voice') return !!myProfile && !hasVoice;
    if (k === 'membership') return isFree;
    if (k === 'story') return !!story;
    return true; // invite
  }).slice(0, 2);

  if (eligible.length === 0) return null;

  return (
    <View style={styles.wrap} testID="discover-cards">
      {eligible.map((key) => {
        switch (key) {
          case 'verify':
            return (
              <PressableScale key={key} haptic style={styles.card} onPress={() => navigation.navigate('Verification')} testID="card-verify">
                <View style={[styles.iconWrap, { backgroundColor: c.successBg }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={c.success} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{t('discover.verifyTitle', 'Get the verified badge')}</Text>
                  <Text style={styles.sub}>{t('discover.verifySub', 'A 30-second selfie — verified profiles earn far more trust.')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </PressableScale>
            );
          case 'invite':
            return (
              <PressableScale key={key} haptic style={styles.card} onPress={shareInvite} testID="card-invite">
                <View style={[styles.iconWrap, { backgroundColor: c.accentSoft }]}>
                  <Ionicons name="people-outline" size={20} color={c.accent} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{t('discover.inviteTitle', 'Know someone searching?')}</Text>
                  <Text style={styles.sub}>
                    {inviteReward > 0
                      ? t('discover.inviteSubReward', `You both get ${inviteReward} contact unlocks when they join.`)
                      : t('discover.inviteSub', 'Every good match starts with someone you trust. Share your invite.')}
                  </Text>
                </View>
                <Ionicons name={inviteBusy ? 'hourglass-outline' : 'share-social-outline'} size={18} color={c.textMuted} />
              </PressableScale>
            );
          case 'voice':
            return (
              <PressableScale key={key} haptic style={styles.card} onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' } as never)} testID="card-voice">
                <View style={[styles.iconWrap, { backgroundColor: c.infoBg }]}>
                  <Ionicons name="mic-outline" size={20} color={c.info} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{t('discover.voiceTitle', 'Add a voice intro')}</Text>
                  <Text style={styles.sub}>{t('discover.voiceSub', 'Families remember a voice — say hello in 30 seconds.')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </PressableScale>
            );
          case 'membership':
            return (
              <PressableScale key={key} haptic onPress={() => navigation.navigate('Subscription')} testID="card-membership">
                <LinearGradient colors={[c.g400, c.g600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.goldCard}>
                  <View style={styles.body}>
                    <Text style={[styles.title, { color: c.goldText }]}>
                      {foundingOpen ? t('discover.foundingTitle', 'Founding member offer') : t('discover.premiumTitle', 'See who liked you')}
                    </Text>
                    <Text style={[styles.sub, { color: c.goldText, opacity: 0.85 }]}>
                      {foundingOpen
                        ? t('discover.foundingSub', 'Early members get premium at the founding price — limited window.')
                        : t('discover.premiumSub', 'Premium opens chat, likes and contact details.')}
                    </Text>
                  </View>
                  <Ionicons name="sparkles" size={20} color={c.goldText} />
                </LinearGradient>
              </PressableScale>
            );
          case 'story':
            return story ? (
              <PressableScale key={key} haptic style={styles.card} onPress={() => navigation.navigate('SuccessStoriesBrowse')} testID="card-story">
                {story.photoUrl ? (
                  <SmartImage uri={story.photoUrl} name={story.coupleNames} style={styles.storyPhoto} />
                ) : (
                  <View style={[styles.iconWrap, { backgroundColor: c.accentSoft }]}>
                    <Ionicons name="heart" size={20} color={c.accent} />
                  </View>
                )}
                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={1}>{story.coupleNames}</Text>
                  <Text style={styles.sub} numberOfLines={2}>“{story.quote}”</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </PressableScale>
            ) : null;
          default:
            return null;
        }
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.lg, marginHorizontal: spacing.gutter },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surfaceCard,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  goldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  storyPhoto: { width: 44, height: 44, borderRadius: 12 },
  body: { flex: 1 },
  title: { ...t9.headline, color: c.textPrimary },
  sub: { ...t9.footnote, color: c.textMuted, marginTop: 2 },
});
