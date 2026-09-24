/**
 * Dashboard fill for the empty stretch below the match rails — two rotating
 * cards chosen by profile stage, never a stacked wall of upsells:
 *   - early profile (<60% or unverified): verification + invite + voice intro
 *   - established: membership (gold) + success story
 * Everything here reads data that already exists, no new backend.
 *
 * The membership card never advertises the founding offer: the mobile app has
 * no way to claim it (no claim screen; the web Subscription page owns
 * `claimFounding`), so a "Founding member offer" card led to a screen that
 * could not honour it. Restore the variant, gated on the server-decided
 * `features.canClaimFounding`, once the claim exists here.
 */
import React, { useState } from 'react';
import { View, StyleSheet, Share, ActivityIndicator } from 'react-native';
import Text from '../../components/ui/Text';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type ThemeColours, spacing, borderRadius } from '@shared/constants/theme';
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

  const isFree = (user?.subscriptionPlan ?? 'free') === 'free';

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
  // The auth user carries the percentage from sign-in time (0 for a fresh signup);
  // the profile query is recomputed by the server on every save.
  const completionPct = myProfile?.completionPercentage ?? user?.Profile?.completionPercentage ?? 0;
  const established = completionPct >= 60;
  const { data: stories } = useQuery({
    queryKey: ['success-stories', 'public'],
    queryFn: getSuccessStories,
    staleTime: 60 * 60 * 1000,
    enabled: established, // story card only renders for established profiles
  });

  // `verification` is undefined while loading or after a failed request. Treating
  // that as "not verified" flashed the verify card at verified members and then
  // pulled it away, so the card waits for an answer.
  const verified = verification?.status === 'approved' || verification?.status === 'pending';
  const hasVoice = !!myProfile?.voiceIntroUrl;
  const story = stories?.find((s) => s.quote) ?? null;

  const shareInvite = async () => {
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      const { url } = await getMyInvite();
      await Share.share({
        message: `Looking for a match in the Tricity? Join me on TricityMatch: ${url}`,
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
    if (k === 'verify') return !!verification && !verified;
    if (k === 'voice') return !!myProfile && !hasVoice;
    if (k === 'membership') return isFree;
    if (k === 'story') return !!story;
    return true; // invite
  }).slice(0, 2);

  if (eligible.length === 0) return null;

  // Copy is resolved once per card so the accessibility label can say exactly
  // what the eye reads (title, then the line under it).
  const inviteSub =
    inviteReward > 0
      ? t('discover.inviteSubReward', 'You both get {{n}} contact unlocks when they join.', { n: inviteReward })
      : t('discover.inviteSub', 'Every good match starts with someone you trust. Share your invite.');
  const copy: Record<CardKey, { title: string; sub: string }> = {
    verify: {
      title: t('discover.verifyTitle', 'Get the verified badge'),
      // New key on purpose: the locale files carry the old `discover.verifySub` value and a
      // resource always beats the code default, so re-wording under that key changes nothing.
      // The old line's second sentence ("earn far more trust") was an unquantified comparative
      // with no data behind it; this states what the flow actually does.
      sub: t('discover.verifyBody', 'A live selfie, reviewed by our team, adds a verified badge to your profile.'),
    },
    invite: { title: t('discover.inviteTitle', 'Know someone searching?'), sub: inviteSub },
    voice: {
      title: t('discover.voiceTitle', 'Add a voice intro'),
      sub: t('discover.voiceSub', 'Families remember a voice. Say hello in 30 seconds.'),
    },
    membership: {
      title: t('discover.premiumTitle', 'See who liked you'),
      sub: t('discover.premiumSub', 'Premium opens chat, likes and contact details.'),
    },
    story: { title: story?.coupleNames ?? '', sub: story?.quote ? `“${story.quote}”` : '' },
  };
  const label = (key: CardKey) => `${copy[key].title}. ${copy[key].sub}`;
  const rowPress = { pressRetentionOffset: { top: 10, bottom: 10, left: 10, right: 10 } } as const;

  return (
    <View style={styles.wrap} testID="discover-cards">
      {eligible.map((key) => {
        // None of these taps commits anything (they open a screen or the share
        // sheet), so none fires a haptic: a light tick on a navigation tap is noise.
        switch (key) {
          case 'verify':
            return (
              <PressableScale key={key} style={styles.card} onPress={() => navigation.navigate('Verification')} testID="card-verify" accessibilityRole="button" accessibilityLabel={label(key)} {...rowPress}>
                <View style={[styles.iconWrap, { backgroundColor: c.successBg }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={c.successAccent} />
                </View>
                <View style={styles.body}>
                  <Text variant="headline" color="textPrimary" style={styles.title}>{copy.verify.title}</Text>
                  <Text variant="footnote" color="textMuted" style={styles.sub}>{copy.verify.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </PressableScale>
            );
          case 'invite':
            return (
              <PressableScale
                key={key}
                style={styles.card}
                onPress={shareInvite}
                disabled={inviteBusy}
                testID="card-invite"
                accessibilityRole="button"
                accessibilityLabel={label(key)}
                accessibilityState={{ disabled: inviteBusy, busy: inviteBusy }}
                {...rowPress}
              >
                <View style={[styles.iconWrap, { backgroundColor: c.accentSoft }]}>
                  <Ionicons name="people-outline" size={20} color={c.accent} />
                </View>
                <View style={styles.body}>
                  <Text variant="headline" color="textPrimary" style={styles.title}>{copy.invite.title}</Text>
                  <Text variant="footnote" color="textMuted" style={styles.sub}>{copy.invite.sub}</Text>
                </View>
                {inviteBusy ? (
                  <ActivityIndicator size="small" color={c.textMuted} />
                ) : (
                  <Ionicons name="share-social-outline" size={18} color={c.textMuted} />
                )}
              </PressableScale>
            );
          case 'voice':
            return (
              <PressableScale key={key} style={styles.card} onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' } as never)} testID="card-voice" accessibilityRole="button" accessibilityLabel={label(key)} {...rowPress}>
                <View style={[styles.iconWrap, { backgroundColor: c.infoBg }]}>
                  <Ionicons name="mic-outline" size={20} color={c.info} />
                </View>
                <View style={styles.body}>
                  <Text variant="headline" color="textPrimary" style={styles.title}>{copy.voice.title}</Text>
                  <Text variant="footnote" color="textMuted" style={styles.sub}>{copy.voice.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </PressableScale>
            );
          case 'membership':
            return (
              <PressableScale key={key} onPress={() => navigation.navigate('Subscription')} testID="card-membership" accessibilityRole="button" accessibilityLabel={label(key)} {...rowPress}>
                <LinearGradient colors={[c.g400, c.g600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.goldCard}>
                  <View style={styles.body}>
                    <Text variant="headline" style={[styles.title, { color: c.goldText }]}>{copy.membership.title}</Text>
                    {/* Full-strength goldText: at 0.85 opacity the sub line dipped under
                        4.5:1 on the darker end of the gradient. */}
                    <Text variant="footnote" style={[styles.sub, { color: c.goldText }]}>{copy.membership.sub}</Text>
                  </View>
                  <Ionicons name="sparkles" size={20} color={c.goldText} />
                </LinearGradient>
              </PressableScale>
            );
          case 'story':
            return story ? (
              <PressableScale key={key} style={styles.card} onPress={() => navigation.navigate('SuccessStoriesBrowse')} testID="card-story" accessibilityRole="button" accessibilityLabel={label(key)} {...rowPress}>
                {story.photoUrl ? (
                  <SmartImage uri={story.photoUrl} name={story.coupleNames} style={styles.storyPhoto} />
                ) : (
                  <View style={[styles.iconWrap, { backgroundColor: c.accentSoft }]}>
                    <Ionicons name="heart" size={20} color={c.accent} />
                  </View>
                )}
                <View style={styles.body}>
                  <Text variant="headline" color="textPrimary" style={styles.title} numberOfLines={1}>{story.coupleNames}</Text>
                  <Text variant="footnote" color="textMuted" style={styles.sub} numberOfLines={2}>{copy.story.sub}</Text>
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
  title: {},
  sub: { marginTop: 2 },
});
