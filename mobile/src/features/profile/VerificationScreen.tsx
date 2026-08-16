import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colours, spacing, borderRadius, type } from '@shared/constants/theme';
import { Button, Card, EmptyState, ScreenHeader, SkeletonBlock, TickRing } from '../../components/ui';
import { getPhotoVerification, submitVerification } from '../../api/verification';
import { useAuthStore } from '../../stores/authStore';
import { queryKeys } from '../../constants/queryKeys';
import type { PhotoVerification } from '../../types';

/**
 * Photo verification — the member-facing half of the same flow the website runs
 * (`frontend/src/pages/Verification.jsx`).
 *
 * One verification exists: a LIVE selfie an admin matches against the profile
 * photos. This screen previously rendered a four-tier ladder — mobile / ID /
 * education / income — of which two tiers have never had a backend and one
 * described government-ID collection the product removed in 2026-07. It also
 * linked to a "Video Verified Badge" liveness screen whose endpoint could not
 * accept a file and whose result no badge anywhere read. Both are gone; what is
 * left is what the server actually does.
 *
 * Capture is camera-only, never the gallery: an uploaded photo can be anyone's,
 * which defeats the point of matching a face to a profile.
 */

type PickedFile = { uri: string; name: string; type: string };

async function captureSelfie(): Promise<PickedFile | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Camera required',
      'Photo verification needs your camera to take a live selfie. Enable camera access in Settings.',
    );
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    cameraType: ImagePicker.CameraType.front,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const a = result.assets[0];
  return { uri: a.uri, name: 'selfie.jpg', type: a.mimeType ?? 'image/jpeg' };
}

/** Same scoring as the web page: approved 100, pending 50, otherwise 0. */
const trustScoreOf = (status: PhotoVerification['status']) =>
  status === 'approved' ? 100 : status === 'pending' ? 50 : 0;

const STATUS_META: Record<string, { label: string; tint: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  approved: { label: 'Verified',     tint: colours.success, bg: colours.successBg, icon: 'checkmark-circle' },
  pending:  { label: 'Under review', tint: colours.warning, bg: colours.warningBg, icon: 'time-outline' },
  rejected: { label: 'Rejected',     tint: colours.error,   bg: colours.errorBg,   icon: 'close-circle' },
  flagged:  { label: 'Flagged',      tint: colours.error,   bg: colours.errorBg,   icon: 'flag' },
};

function StatusPill({ status }: { status: PhotoVerification['status'] }) {
  const meta = STATUS_META[status];
  if (!meta) {
    return (
      <View style={[s.pill, { backgroundColor: colours.n100 }]}>
        <Text style={[s.pillText, { color: colours.textSecondary }]}>Not started</Text>
      </View>
    );
  }
  return (
    <View style={[s.pill, { backgroundColor: meta.bg }]} testID={`status-pill-${status}`}>
      <Ionicons name={meta.icon} size={13} color={meta.tint} />
      <Text style={[s.pillText, { color: meta.tint }]}>{meta.label}</Text>
    </View>
  );
}

const HOW_IT_WORKS = [
  { step: '1', title: 'Take a selfie', desc: 'Good light, face clearly visible' },
  { step: '2', title: 'Team review',   desc: 'Matched to your profile photos' },
  { step: '3', title: 'Get the badge', desc: 'Verified tick on your profile' },
];

const PERKS = [
  'A verified badge on your profile that families trust',
  'Higher ranking in search results',
  'You appear in “Verified only” searches',
];

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const phoneVerified = useAuthStore((st) => st.user?.phoneVerified ?? false);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.verification,
    queryFn: getPhotoVerification,
    staleTime: 2 * 60 * 1000,
  });

  const submitMutation = useMutation({
    mutationFn: submitVerification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
      Alert.alert('Selfie submitted', "Our team reviews it within 24–48 hours. We'll notify you.");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
          ?.response?.data?.error?.message ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Submission failed. Please try again.';
      Alert.alert('Could not submit', message);
    },
    onSettled: () => setSubmitting(false),
  });

  const handleCapture = async () => {
    const file = await captureSelfie();
    if (!file) return;
    setSubmitting(true);
    const form = new FormData();
    form.append('selfiePhoto', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    submitMutation.mutate(form);
  };

  const status = data?.status ?? 'not_submitted';
  const trust = trustScoreOf(status);
  const canSubmit = status === 'not_submitted' || status === 'rejected' || status === 'flagged';

  return (
    <View style={[s.wrapper, { paddingTop: insets.top }]} testID="VerificationScreen">
      <ScreenHeader title="Verification" />

      {isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load your verification"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
          testID="verification-error"
        />
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Trust score */}
          <Card style={s.trustCard}>
            <TickRing value={isLoading ? 0 : trust} size={78} ticks={10} color={colours.g500}>
              <Text style={s.trustPct}>{isLoading ? '—' : `${trust}%`}</Text>
            </TickRing>
            <View style={s.trustCopy}>
              <Text style={s.trustTitle}>Trust Score</Text>
              <Text style={s.trustSub}>
                Verified members get noticeably more responses — families look for the badge.
              </Text>
            </View>
          </Card>

          {/* Status overview */}
          <Card style={s.card}>
            <Text style={s.cardLabel}>STATUS</Text>
            <View style={s.statusRow}>
              <View style={s.statusLeft}>
                <Ionicons name="phone-portrait-outline" size={18} color={colours.badgeMobile} />
                <Text style={s.statusName}>Mobile number</Text>
              </View>
              <StatusPill status={phoneVerified ? 'approved' : 'not_submitted'} />
            </View>
            <View style={[s.statusRow, s.statusRowLast]}>
              <View style={s.statusLeft}>
                <Ionicons name="camera-outline" size={18} color={colours.p500} />
                <Text style={s.statusName}>Photo verification</Text>
              </View>
              {isLoading ? <SkeletonBlock width={96} height={22} radius={borderRadius.full} /> : <StatusPill status={status} />}
            </View>
          </Card>

          {/* Photo verification */}
          <Card style={s.card}>
            <Text style={s.sectionTitle}>Photo verification</Text>
            <Text style={s.sectionBody}>
              Take a live selfie with your camera. Our team matches it against your profile photos —
              no documents needed, and the selfie is never shown to other members.
            </Text>

            <View style={s.perks}>
              <Text style={s.perksLabel}>WHY GET VERIFIED</Text>
              {PERKS.map((perk) => (
                <View key={perk} style={s.perkRow}>
                  <Ionicons name="checkmark-circle" size={15} color={colours.success} />
                  <Text style={s.perkText}>{perk}</Text>
                </View>
              ))}
            </View>

            {data?.adminNotes ? (
              <View style={s.notesBanner} testID="admin-notes">
                <Ionicons name="alert-circle" size={15} color={colours.error} />
                <Text style={s.notesText}>{data.adminNotes}</Text>
              </View>
            ) : null}

            {isLoading ? (
              <SkeletonBlock height={48} radius={borderRadius.md} />
            ) : status === 'approved' ? (
              <View style={[s.resultBanner, { backgroundColor: colours.successBg }]}>
                <Ionicons name="checkmark-circle" size={18} color={colours.success} />
                <Text style={[s.resultText, { color: colours.success }]}>
                  Your profile is verified. The badge is live for other members.
                </Text>
              </View>
            ) : status === 'pending' ? (
              <View style={[s.resultBanner, { backgroundColor: colours.warningBg }]}>
                <Ionicons name="time-outline" size={18} color={colours.warning} />
                <Text style={[s.resultText, { color: colours.warning }]}>
                  Your selfie is with our team. Reviews usually finish within 24–48 hours.
                </Text>
              </View>
            ) : (
              <>
                <View style={s.steps}>
                  {HOW_IT_WORKS.map(({ step, title, desc }) => (
                    <View key={step} style={s.step}>
                      <View style={s.stepNum}>
                        <Text style={s.stepNumText}>{step}</Text>
                      </View>
                      <Text style={s.stepTitle}>{title}</Text>
                      <Text style={s.stepDesc}>{desc}</Text>
                    </View>
                  ))}
                </View>
                <Button
                  title={status === 'not_submitted' ? 'Take selfie' : 'Retake selfie'}
                  icon="camera"
                  onPress={handleCapture}
                  loading={submitting}
                  disabled={submitting || !canSubmit}
                  testID="capture-selfie-btn"
                  accessibilityLabel="Take a live selfie for photo verification"
                />
              </>
            )}
          </Card>

          <View style={s.note}>
            <Ionicons name="lock-closed-outline" size={14} color={colours.textMuted} />
            <Text style={s.noteText}>
              Your selfie is only used to confirm it matches your profile photos. We never show it to
              other members.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:     { flex: 1, backgroundColor: colours.background },
  content:     { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },

  trustCard:   { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg },
  trustPct:    { ...type.title3, color: colours.g600 },
  trustCopy:   { flex: 1, gap: 4 },
  trustTitle:  { ...type.title3, color: colours.textPrimary },
  trustSub:    { ...type.footnote, color: colours.textSecondary },

  card:        { padding: spacing.lg, gap: spacing.md },
  cardLabel:   { ...type.micro, color: colours.textMuted, letterSpacing: 0.6 },

  statusRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colours.border },
  statusRowLast:  { paddingBottom: 0, borderBottomWidth: 0 },
  statusLeft:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusName:     { ...type.callout, color: colours.textPrimary },

  pill:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: borderRadius.full },
  pillText:    { ...type.caption },

  sectionTitle:{ ...type.headline, color: colours.textPrimary },
  sectionBody: { ...type.footnote, color: colours.textSecondary },

  perks:       { backgroundColor: colours.goldSoft, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm },
  perksLabel:  { ...type.micro, color: colours.g700, letterSpacing: 0.6 },
  perkRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  perkText:    { flex: 1, ...type.footnote, color: colours.textPrimary },

  notesBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colours.errorBg, borderRadius: borderRadius.md, padding: spacing.md },
  notesText:   { flex: 1, ...type.footnote, color: colours.error },

  resultBanner:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md },
  resultText:  { flex: 1, ...type.footnote },

  steps:       { flexDirection: 'row', gap: spacing.sm },
  step:        { flex: 1, alignItems: 'center', backgroundColor: colours.surfaceCard, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colours.border, padding: spacing.md, gap: 4 },
  stepNum:     { width: 22, height: 22, borderRadius: 11, backgroundColor: colours.p100, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { ...type.micro, color: colours.p500 },
  stepTitle:   { ...type.caption, color: colours.textPrimary, textAlign: 'center' },
  stepDesc:    { ...type.micro, fontFamily: 'Inter-Regular', color: colours.textMuted, textAlign: 'center' },

  note:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.xs },
  noteText:    { flex: 1, ...type.footnote, color: colours.textMuted },
});
