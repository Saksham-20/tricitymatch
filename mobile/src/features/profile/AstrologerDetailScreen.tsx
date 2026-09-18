import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { getAstrologer, bookAstrologer } from '../../api/profile';
import type { MainStackParamList } from '../../navigation/types';

type Route = RouteProp<MainStackParamList, 'AstrologerDetail'>;

const DURATIONS = [15, 30, 45, 60];

/**
 * Everything here comes from `GET /astrologers/:id`.
 *
 * This screen used to invent its subject: a fixed ₹25/min, "18 yrs experience",
 * a 4.8 rating over 342 reviews, three named reviewers with quoted
 * testimonials, six bookable slots, and a certification claim — none of it
 * fetched, all of it rendered as though it described the practitioner whose
 * name was in the header.
 *
 * It also never called the API, and a stale in-code comment claimed the
 * astrologer routes "are not yet implemented". They are: this screen now reads
 * the real record and books against `POST /astrologers/book`.
 *
 * Booking returns a Razorpay order, so completing payment needs Razorpay
 * configured; until then the booking is created and left pending, and we say so
 * rather than reporting a confirmation that has not happened.
 */
export default function AstrologerDetailScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const route = useRoute<Route>();
  const { astrologerId, astrologerName } = route.params;

  const [selectedDuration, setSelectedDuration] = useState(30);
  const [booking, setBooking] = useState(false);

  const { data: astrologer, isLoading, isError, refetch } = useQuery({
    queryKey: ['astrologer', astrologerId],
    queryFn: () => getAstrologer(astrologerId),
    staleTime: 5 * 60 * 1000,
  });

  const pricePerMin = astrologer?.pricePerMin ?? 0;
  const totalAmount = pricePerMin * selectedDuration;

  const handleBook = async () => {
    setBooking(true);
    try {
      // Earliest sensible slot: the next hour. There is no availability endpoint,
      // so we do not present invented time slots.
      const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const result = await bookAstrologer({ astrologerId, scheduledAt, durationMin: selectedDuration });
      Alert.alert(
        'Booking requested',
        result.status === 'pending_payment'
          ? `Your ${selectedDuration}-minute consultation with ${result.astrologerName} is reserved and awaiting payment. We'll email you the payment link and confirmation.`
          : `Your consultation with ${result.astrologerName} is confirmed.`,
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    } catch {
      Alert.alert('Booking failed', 'We could not create that booking. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <Screen edges={['top']} style={s.container}>
      <View style={s.header}>
        <PressableScale
          onPress={() => nav.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </PressableScale>
        <Text variant="headline" color="textPrimary" style={s.headerTitle} numberOfLines={1}>{astrologer?.name ?? astrologerName}</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError || !astrologer ? (
        <View style={s.state}>
          <Ionicons name="cloud-offline-outline" size={44} color={c.textMuted} />
          <Text variant="callout" color="textMuted">Could not load this astrologer.</Text>
          <PressableScale
            onPress={() => refetch()}
            style={s.retryBtn}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="caption" color="primary">Try again</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.profileCard}>
              <View style={s.avatarWrap}>
                <Text variant="title1" color="onPrimary">{astrologer.name.charAt(0)}</Text>
              </View>
              <Text variant="title3" color="textPrimary">{astrologer.name}</Text>
              <Text variant="footnote" color="textSecondary">
                Vedic Astrologer{astrologer.experience ? ` · ${astrologer.experience} yrs experience` : ''}
              </Text>
              {astrologer.reviewCount > 0 && (
                <View style={s.ratingRow}>
                  <Ionicons name="star" size={14} color={c.secondary} />
                  <Text variant="footnote" color="textSecondary">
                    {astrologer.rating} ({astrologer.reviewCount} reviews)
                  </Text>
                </View>
              )}
              {astrologer.languages?.length > 0 && (
                <View style={s.chips}>
                  {astrologer.languages.map((lang) => (
                    <View key={lang} style={s.chip}>
                      <Text variant="caption" color="textSecondary">{lang}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {astrologer.speciality?.length > 0 && (
              <View style={s.section}>
                <Text variant="headline" color="textPrimary">Specialities</Text>
                <View style={s.chips}>
                  {astrologer.speciality.map((sp) => (
                    <View key={sp} style={s.chip}>
                      <Text variant="caption" color="textSecondary">{sp}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={s.section}>
              <Text variant="headline" color="textPrimary">Consultation Duration</Text>
              <View style={s.durationRow}>
                {DURATIONS.map((d) => (
                  <PressableScale
                    key={d}
                    style={[s.durationBtn, selectedDuration === d && s.durationBtnActive]}
                    onPress={() => setSelectedDuration(d)}
                    accessibilityRole="radio"
                    accessibilityLabel={`${d} minutes, ₹${pricePerMin * d}`}
                    accessibilityState={{ selected: selectedDuration === d }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text variant="caption" color={selectedDuration === d ? 'primary' : 'textPrimary'}>
                      {d} min
                    </Text>
                    <Text variant="caption" color={selectedDuration === d ? 'primary' : 'textMuted'}>
                      ₹{pricePerMin * d}
                    </Text>
                  </PressableScale>
                ))}
              </View>
              <Text variant="caption" color="textMuted">
                We’ll confirm an exact time with you by email after booking.
              </Text>
            </View>
          </ScrollView>

          <View style={[s.bookBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View>
              <Text variant="title3" color="textPrimary">₹{totalAmount}</Text>
              <Text variant="caption" color="textMuted">for {selectedDuration} min</Text>
            </View>
            <PressableScale
              style={[s.bookBtn, booking && s.bookBtnDisabled]}
              onPress={handleBook}
              disabled={booking}
              accessibilityRole="button"
              accessibilityState={{ disabled: booking }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="headline" color="onPrimary">{booking ? 'Booking…' : 'Book Consultation'}</Text>
            </PressableScale>
          </View>
        </>
      )}
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  scroll: { padding: spacing.md, paddingBottom: 120 },

  state: { alignItems: 'center', paddingTop: 64, gap: spacing.sm },
  retryBtn: { marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: c.primary },

  profileCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  avatarWrap: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: c.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },

  section: { marginTop: spacing.lg, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  chip: { backgroundColor: c.surfaceCard, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: c.border },

  durationRow: { flexDirection: 'row', gap: spacing.xs },
  durationBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.border },
  durationBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },

  bookBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, backgroundColor: c.background,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  bookBtn: { backgroundColor: c.primary, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  bookBtnDisabled: { backgroundColor: c.textMuted },
});
