import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import type { MainStackParamList } from '../../navigation/types';

type Route = RouteProp<MainStackParamList, 'AstrologerDetail'>;

/**
 * Astrologer detail.
 *
 * This screen previously rendered an entirely invented practitioner: a fixed
 * ₹25/min price, "18 yrs experience", a 4.8 rating over 342 reviews, three
 * named reviewers with quoted testimonials, six bookable time slots, and a
 * certification claim ("Certified by Bharatiya Vidya Bhavan, New Delhi") — none
 * of it backed by any API. The "Book Consultation" CTA it presented could only
 * ever fail, because the booking route does not exist server-side.
 *
 * Fabricated credentials attached to a named professional are not placeholder
 * copy, so all of it is gone. Until the astrologer backend ships, this shows the
 * one fact it genuinely has (the name it was navigated with) and says plainly
 * that booking is not open.
 */
export default function AstrologerDetailScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const route = useRoute<Route>();
  const { astrologerName } = route.params;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{astrologerName}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.profileCard}>
          <View style={s.avatarWrap}>
            <Text style={s.avatarText}>{astrologerName.charAt(0)}</Text>
          </View>
          <Text style={s.name}>{astrologerName}</Text>
          <Text style={s.meta}>Vedic Astrologer</Text>
        </View>

        <View style={s.notice}>
          <Ionicons name="time-outline" size={22} color={colours.primary} />
          <View style={s.noticeText}>
            <Text style={s.noticeTitle}>Booking is not open yet</Text>
            <Text style={s.noticeBody}>
              Consultations with our astrologers will be bookable from the app shortly. We will
              notify you when scheduling goes live.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  scroll: { padding: spacing.md, gap: spacing.md },

  profileCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colours.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: typography.fontSize['3xl'], fontFamily: typography.fontFamily.bold, color: '#fff' },
  name: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  meta: { fontSize: typography.fontSize.sm, color: colours.textSecondary },

  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colours.border,
  },
  noticeText: { flex: 1, gap: 4 },
  noticeTitle: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  noticeBody: { fontSize: typography.fontSize.sm, color: colours.textSecondary, lineHeight: 19 },
});
