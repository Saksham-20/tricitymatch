import React, { useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { AccessibilityInfo, Linking, View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonBlock } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionHeader from '../../components/ui/SectionHeader';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { showToast } from '../../utils/toast';
import { tapSize } from '../../utils/elderTheme';
import { getAstrologer } from '../../api/profile';
import type { MainStackParamList } from '../../navigation/types';

type Route = RouteProp<MainStackParamList, 'AstrologerDetail'>;

/**
 * Booking and payment live on the website. The app can create a booking, but a
 * booking comes back as an UNPAID Razorpay order and this build has no checkout
 * for it, so booking here could only ever end in "not confirmed" and leave an
 * abandoned order behind (the endpoint is also rate-limited to 10 an hour). The
 * website page takes a date and time, opens Razorpay and confirms the payment, so
 * that is where the member is sent.
 */
const WEB_ASTROLOGERS_URL = 'https://tricitymatch.com/astrologers';

/** Mirrors the loaded layout: centered profile card, specialities, price rows. */
function AstrologerDetailSkeleton() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <View style={s.scroll} testID="AstrologerDetailScreen-skeleton">
      <View style={s.profileCard}>
        <SkeletonBlock width={76} height={76} radius={38} style={{ marginBottom: spacing.sm }} />
        <SkeletonBlock width={160} height={20} />
        <SkeletonBlock width={200} height={14} />
        <SkeletonBlock width={120} height={14} />
        <View style={s.chips}>
          {[64, 72, 56].map((w) => <SkeletonBlock key={w} width={w} height={24} radius={borderRadius.full} />)}
        </View>
      </View>
      <View style={s.section}>
        <SkeletonBlock width={110} height={18} />
        <View style={s.chips}>
          {[88, 76, 96].map((w) => <SkeletonBlock key={w} width={w} height={24} radius={borderRadius.full} />)}
        </View>
      </View>
      <View style={s.section}>
        <SkeletonBlock width={170} height={18} />
        <View style={s.priceList}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} width="100%" height={20} />
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Everything here comes from `GET /astrologers/:id`.
 *
 * This screen used to invent its subject: a fixed ₹25/min, "18 yrs experience",
 * a 4.8 rating over 342 reviews, three named reviewers with quoted
 * testimonials, six bookable slots, and a certification claim — none of it
 * fetched, all of it rendered as though it described the practitioner whose
 * name was in the header.
 *
 * It then read the real record and booked against `POST /astrologers/book`, but
 * that call returns an unpaid Razorpay order the app cannot pay, so every booking
 * ended in an error toast and an orphaned order. It now shows the practitioner
 * and their prices and sends the member to the website to book (see
 * WEB_ASTROLOGERS_URL). When the app can take the payment itself, booking comes
 * back here with a checkout step.
 */
export default function AstrologerDetailScreen() {
  const { c, elder } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const nav = useNavigation();
  const route = useRoute<Route>();
  const { astrologerId, astrologerName } = route.params;

  const { data: astrologer, isLoading, error, refetch } = useQuery({
    queryKey: ['astrologer', astrologerId],
    queryFn: () => getAstrologer(astrologerId),
    staleTime: 5 * 60 * 1000,
    // A 404 is "no longer listed" and retrying never changes it: skip the
    // default two backoff retries so the answer shows at once instead of after
    // ~3s of skeleton. Anything else keeps the normal retry.
    retry: (failureCount, err) =>
      (err as { response?: { status?: number } } | null)?.response?.status !== 404 && failureCount < 2,
  });
  // A 404 is "no longer listed", which retrying will never fix.
  const notFound = (error as { response?: { status?: number } } | null)?.response?.status === 404;

  const pricePerMin = astrologer?.pricePerMin ?? 0;
  const hasRating = (astrologer?.reviewCount ?? 0) > 0;

  // The load failing appears without a tap (the skeleton is replaced), so it is
  // announced; a screen-reader member would otherwise wait on a spinner that has
  // already given up.
  const loadProblem = isLoading || astrologer
    ? null
    : notFound
    ? "This astrologer isn't available."
    : "Couldn't load astrologer details. Check your connection and try again.";
  useEffect(() => {
    if (loadProblem) AccessibilityInfo.announceForAccessibility(loadProblem);
  }, [loadProblem]);

  const openWebsite = () => {
    Linking.openURL(`${WEB_ASTROLOGERS_URL}/${encodeURIComponent(astrologerId)}`).catch(() => {
      const title = 'Could not open browser';
      const body = 'Visit tricitymatch.com/astrologers to book.';
      showToast.error(title, body);
      // a toast is not announced to screen readers (toastConfig has no live region)
      AccessibilityInfo.announceForAccessibility(`${title}. ${body}`);
    });
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={astrologer?.name ?? astrologerName} testID="AstrologerDetailScreen-header" />

      {isLoading ? (
        <AstrologerDetailSkeleton />
      ) : !astrologer ? (
        // Nothing to show (failed fetch, or a fetch paused offline): retryable error.
        // A failed background refetch with cached data falls through to the content.
        <View style={s.errorBody}>
          {notFound ? (
            <EmptyState
              icon="moon-outline"
              title="This astrologer isn't available"
              description="They may no longer be listed."
              actionLabel="Go back"
              onAction={() => nav.goBack()}
              testID="AstrologerDetailScreen-notfound"
            />
          ) : (
            <EmptyState
              variant="error"
              icon="cloud-offline-outline"
              title="Couldn't load astrologer details"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => refetch()}
              testID="AstrologerDetailScreen-error"
            />
          )}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.profileCard}>
              <Avatar uri={astrologer.avatarUrl} name={astrologer.name} size={76} online={astrologer.isOnline} style={s.avatar} />
              <Text variant="title3" color="textPrimary">{astrologer.name}</Text>
              <Text variant="footnote" color="textSecondary">
                Astrologer{astrologer.experience ? ` · ${astrologer.experience} yrs experience` : ''}
              </Text>
              {hasRating && (
                <View style={s.ratingRow}>
                  {/* neutral: a rating is a score, and gold is the premium signal */}
                  <Ionicons
                    name="star"
                    size={14}
                    color={c.textSecondary}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                  <Text variant="footnote" color="textSecondary">
                    {Number(astrologer.rating).toFixed(1)} ({astrologer.reviewCount} {astrologer.reviewCount === 1 ? 'review' : 'reviews'})
                  </Text>
                </View>
              )}
              {/* Availability in words: the dot on the photo is colour-only. */}
              {astrologer.isOnline ? (
                <Badge label="Online now" tone="success" style={s.statusBadge} />
              ) : astrologer.nextAvailable ? (
                <Text variant="footnote" color="textSecondary">Next available: {astrologer.nextAvailable}</Text>
              ) : null}
              {astrologer.languages?.length > 0 && (
                <View style={s.chips}>
                  {astrologer.languages.map((lang) => (
                    <Badge key={lang} label={lang} tone="neutral" />
                  ))}
                </View>
              )}
            </View>

            {astrologer.speciality?.length > 0 && (
              <View style={s.section}>
                <SectionHeader title="Specialities" />
                <View style={s.chips}>
                  {astrologer.speciality.map((sp) => (
                    <Badge key={sp} label={sp} tone="neutral" />
                  ))}
                </View>
              </View>
            )}

            {pricePerMin > 0 ? (
              <View style={s.section}>
                <SectionHeader title="Consultation rate" />
                {/* One stated rate, not a list of lengths: the website decides which
                    durations it sells, and a second copy of that list here drifts. */}
                <Text variant="subhead" color="textPrimary">
                  ₹{pricePerMin.toLocaleString('en-IN')} per minute. You choose the length when you book on the website.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* A sibling of the scroller rather than an overlay: an absolutely
              positioned bar needs a guessed clearance constant on the content,
              and the guess is wrong the moment the OS text size changes. The
              bottom safe area is Screen's. */}
          <View style={s.bookBar}>
            <Text variant="footnote" color="textSecondary" style={s.bookNote}>
              You choose a date and time, and pay, on tricitymatch.com.
            </Text>
            <Button
              title="Book on our website"
              icon="open-outline"
              onPress={openWebsite}
              // Button's own floor is 50pt; elder mode owes 60 (the gradient is centred in the taller box).
              style={elder ? { minHeight: tapSize(true), justifyContent: 'center' } : undefined}
              testID="book-btn"
              accessibilityLabel="Book a consultation on our website"
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },

  errorBody: { flex: 1, justifyContent: 'center' },

  profileCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  avatar: { marginBottom: spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusBadge: { alignSelf: 'center' },

  section: { marginTop: spacing.lg, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },

  priceList: { gap: spacing.xs },

  bookBar: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: c.background,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  bookNote: { textAlign: 'center' },
});
