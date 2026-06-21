import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { bookAstrologer } from '../../api/profile';
import type { MainStackParamList } from '../../navigation/types';

type Route = RouteProp<MainStackParamList, 'AstrologerDetail'>;

// Duration options in minutes
const DURATIONS = [15, 30, 45, 60];

const STUB_REVIEWS = [
  { id: '1', author: 'Priya S.', rating: 5, text: 'Excellent guidance on kundli matching. Very accurate predictions.' },
  { id: '2', author: 'Rahul M.', rating: 5, text: 'Helped us understand Manglik dosha remedies clearly. Highly recommend!' },
  { id: '3', author: 'Anita K.', rating: 4, text: 'Very knowledgeable. Gave detailed analysis of our horoscopes.' },
];

const STUB_SLOTS = [
  { time: 'Today 4:00 PM', available: true },
  { time: 'Today 6:00 PM', available: true },
  { time: 'Today 8:00 PM', available: false },
  { time: 'Tomorrow 10:00 AM', available: true },
  { time: 'Tomorrow 12:00 PM', available: true },
  { time: 'Tomorrow 4:00 PM', available: false },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < rating ? 'star' : 'star-outline'}
          size={14}
          color={colours.secondary}
        />
      ))}
    </View>
  );
}

export default function AstrologerDetailScreen() {
  const nav = useNavigation();
  const route = useRoute<Route>();
  const { astrologerName } = route.params;

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [booking, setBooking] = useState(false);

  const pricePerMin = 25;
  const totalAmount = pricePerMin * selectedDuration;

  const handleBook = async () => {
    if (!selectedSlot) {
      Alert.alert('Select a time slot', 'Please choose when you want to consult.');
      return;
    }
    setBooking(true);
    try {
      // Stub — backend 404s until implemented
      await bookAstrologer({
        astrologerId: route.params.astrologerId,
        scheduledAt: selectedSlot,
        durationMin: selectedDuration,
      });
      Alert.alert(
        'Booking Confirmed',
        `Your consultation with ${astrologerName} has been booked for ${selectedSlot}.\n\nYou'll receive a confirmation on your registered email.`,
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    } catch {
      // Show stub success in dev since backend doesn't exist yet
      if (__DEV__) {
        Alert.alert(
          'Booking Stub',
          `[DEV] Backend astrologer routes not yet implemented.\nWould book ${astrologerName} at ${selectedSlot} for ${selectedDuration} mins.`,
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert('Booking failed', 'Unable to complete booking. Please try again.');
      }
    } finally {
      setBooking(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{astrologerName}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={s.profileCard}>
          <View style={s.avatarWrap}>
            <Text style={s.avatarText}>{astrologerName.charAt(0)}</Text>
          </View>
          <Text style={s.name}>{astrologerName}</Text>
          <Text style={s.meta}>Vedic Astrologer · 18 yrs experience</Text>
          <View style={s.ratingRow}>
            <StarRow rating={5} />
            <Text style={s.ratingText}>4.8 (342 reviews)</Text>
          </View>
          <View style={s.languageRow}>
            {['Hindi', 'Punjabi', 'English'].map(lang => (
              <View key={lang} style={s.langChip}>
                <Text style={s.langText}>{lang}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* About */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>About</Text>
          <Text style={s.about}>
            Specializes in Vedic Kundli analysis, marriage compatibility (Ashtakoot Guna Milan), Manglik dosha remedies, and auspicious muhurat selection. Certified by Bharatiya Vidya Bhavan, New Delhi. Available for in-person consultations in Chandigarh and online worldwide.
          </Text>
        </View>

        {/* Specialities */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Specialities</Text>
          <View style={s.chips}>
            {['Kundli Matching', 'Marriage Timing', 'Manglik Remedies', 'Numerology'].map(sp => (
              <View key={sp} style={s.chip}>
                <Text style={s.chipText}>{sp}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Duration Picker */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Consultation Duration</Text>
          <View style={s.durationRow}>
            {DURATIONS.map(d => (
              <TouchableOpacity
                key={d}
                style={[s.durationBtn, selectedDuration === d && s.durationBtnActive]}
                onPress={() => setSelectedDuration(d)}
              >
                <Text style={[s.durationLabel, selectedDuration === d && s.durationLabelActive]}>
                  {d} min
                </Text>
                <Text style={[s.durationPrice, selectedDuration === d && s.durationLabelActive]}>
                  ₹{pricePerMin * d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Time Slot Picker */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Choose Time Slot</Text>
          <View style={s.slots}>
            {STUB_SLOTS.map(slot => (
              <TouchableOpacity
                key={slot.time}
                style={[
                  s.slot,
                  !slot.available && s.slotDisabled,
                  selectedSlot === slot.time && s.slotSelected,
                ]}
                onPress={() => slot.available && setSelectedSlot(slot.time)}
                disabled={!slot.available}
              >
                <Text style={[
                  s.slotText,
                  !slot.available && s.slotTextDisabled,
                  selectedSlot === slot.time && s.slotTextSelected,
                ]}>
                  {slot.time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reviews */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Reviews</Text>
          {STUB_REVIEWS.map(r => (
            <View key={r.id} style={s.reviewCard}>
              <View style={s.reviewHeader}>
                <Text style={s.reviewAuthor}>{r.author}</Text>
                <StarRow rating={r.rating} />
              </View>
              <Text style={s.reviewText}>{r.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Book CTA */}
      <View style={s.bookBar}>
        <View>
          <Text style={s.bookPrice}>₹{totalAmount}</Text>
          <Text style={s.bookDuration}>for {selectedDuration} min</Text>
        </View>
        <TouchableOpacity
          style={[s.bookBtn, (!selectedSlot || booking) && s.bookBtnDisabled]}
          onPress={handleBook}
          disabled={!selectedSlot || booking}
        >
          <Text style={s.bookBtnText}>{booking ? 'Booking…' : 'Book Consultation'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colours.background },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colours.border },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  scroll:       { padding: spacing.md, paddingBottom: 120 },

  profileCard:  { alignItems: 'center', paddingVertical: spacing.lg, marginBottom: spacing.lg },
  avatarWrap:   { width: 80, height: 80, borderRadius: 40, backgroundColor: colours.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarText:   { fontSize: typography.fontSize['3xl'], fontFamily: typography.fontFamily.bold, color: colours.primary },
  name:         { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  meta:         { fontSize: typography.fontSize.sm, color: colours.textSecondary, marginTop: 2 },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  ratingText:   { fontSize: typography.fontSize.sm, color: colours.textSecondary },
  languageRow:  { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  langChip:     { backgroundColor: colours.surfaceCard, borderRadius: borderRadius.sm, paddingHorizontal: spacing.xs, paddingVertical: 3 },
  langText:     { fontSize: typography.fontSize.xs, color: colours.textSecondary },

  section:      { marginBottom: spacing.lg },
  sectionTitle: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary, marginBottom: spacing.sm },
  about:        { fontSize: typography.fontSize.sm, color: colours.textSecondary, lineHeight: 20 },

  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip:         { backgroundColor: colours.primaryLight, borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipText:     { fontSize: typography.fontSize.xs, color: colours.primary, fontFamily: typography.fontFamily.medium },

  durationRow:      { flexDirection: 'row', gap: spacing.sm },
  durationBtn:      { flex: 1, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colours.border, padding: spacing.sm, alignItems: 'center' },
  durationBtnActive: { borderColor: colours.primary, backgroundColor: colours.primaryLight },
  durationLabel:    { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: colours.textSecondary },
  durationLabelActive: { color: colours.primary },
  durationPrice:    { fontSize: typography.fontSize.xs, color: colours.textMuted, marginTop: 2 },

  slots:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot:         { borderRadius: borderRadius.md, borderWidth: 1, borderColor: colours.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  slotDisabled: { backgroundColor: colours.surfaceCard, borderColor: colours.surfaceCard },
  slotSelected: { backgroundColor: colours.primary, borderColor: colours.primary },
  slotText:     { fontSize: typography.fontSize.sm, color: colours.textPrimary },
  slotTextDisabled: { color: colours.textMuted },
  slotTextSelected: { color: '#fff', fontFamily: typography.fontFamily.medium },

  reviewCard:   { backgroundColor: colours.surfaceCard, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewAuthor: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  reviewText:   { fontSize: typography.fontSize.sm, color: colours.textSecondary, lineHeight: 18 },

  bookBar:      { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colours.background, borderTopWidth: 1, borderTopColor: colours.border, paddingBottom: Platform.OS === 'ios' ? 32 : spacing.md },
  bookPrice:    { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  bookDuration: { fontSize: typography.fontSize.xs, color: colours.textMuted },
  bookBtn:      { backgroundColor: colours.primary, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  bookBtnDisabled: { backgroundColor: colours.textMuted },
  bookBtnText:  { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: '#fff' },
});
