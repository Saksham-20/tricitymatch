import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
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

const makeStatusMeta = (c: ThemeColours): Record<string, { label: string; tint: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> => ({
  approved: { label: 'Verified',     tint: c.success, bg: c.successBg, icon: 'checkmark-circle' },
  pending:  { label: 'Under review', tint: c.warning, bg: c.warningBg, icon: 'time-outline' },
  rejected: { label: 'Rejected',     tint: c.error,   bg: c.errorBg,   icon: 'close-circle' },
  flagged:  { label: 'Flagged',      tint: c.error,   bg: c.errorBg,   icon: 'flag' },
});

function StatusPill({ status }: { status: PhotoVerification['status'] }) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const meta = React.useMemo(() => makeStatusMeta(c), [c])[status];
  if (!meta) {
    return (
      <View style={[s.pill, { backgroundColor: c.n100 }]}>
        <Text variant="caption" color="textSecondary">Not started</Text>
      </View>
    );
  }
  return (
    <View style={[s.pill, { backgroundColor: meta.bg }]} testID={`status-pill-${status}`}>
      <Ionicons name={meta.icon} size={13} color={meta.tint} />
      {/* meta.tint is a resolved colour value (success/warning/error), not a
          TextColor key — left as an explicit style override. */}
      <Text variant="caption" style={{ color: meta.tint }}>{meta.label}</Text>
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
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
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
    <Screen edges={['top']} style={s.wrapper} testID="VerificationScreen">
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
            <TickRing value={isLoading ? 0 : trust} size={78} ticks={10} color={c.g500}>
              <Text variant="title3" style={s.trustPct}>{isLoading ? '—' : `${trust}%`}</Text>
            </TickRing>
            <View style={s.trustCopy}>
              <Text variant="title3" color="textPrimary">Trust Score</Text>
              <Text variant="footnote" color="textSecondary">
                Verified members get noticeably more responses — families look for the badge.
              </Text>
            </View>
          </Card>

          {/* Status overview */}
          <Card style={s.card}>
            <Text variant="micro" color="textMuted" style={s.cardLabel}>STATUS</Text>
            <View style={s.statusRow}>
              <View style={s.statusLeft}>
                <Ionicons name="phone-portrait-outline" size={18} color={c.badgeMobile} />
                <Text variant="callout" color="textPrimary">Mobile number</Text>
              </View>
              <StatusPill status={phoneVerified ? 'approved' : 'not_submitted'} />
            </View>
            <View style={[s.statusRow, s.statusRowLast]}>
              <View style={s.statusLeft}>
                <Ionicons name="camera-outline" size={18} color={c.p500} />
                <Text variant="callout" color="textPrimary">Photo verification</Text>
              </View>
              {isLoading ? <SkeletonBlock width={96} height={22} radius={borderRadius.full} /> : <StatusPill status={status} />}
            </View>
          </Card>

          {/* Photo verification */}
          <Card style={s.card}>
            <Text variant="headline" color="textPrimary">Photo verification</Text>
            <Text variant="footnote" color="textSecondary">
              Take a live selfie with your camera. Our team matches it against your profile photos —
              no documents needed, and the selfie is never shown to other members.
            </Text>

            <View style={s.perks}>
              <Text variant="micro" style={s.perksLabel}>WHY GET VERIFIED</Text>
              {PERKS.map((perk) => (
                <View key={perk} style={s.perkRow}>
                  <Ionicons name="checkmark-circle" size={15} color={c.success} />
                  <Text variant="footnote" color="textPrimary" style={s.perkText}>{perk}</Text>
                </View>
              ))}
            </View>

            {data?.adminNotes ? (
              <View style={s.notesBanner} testID="admin-notes">
                <Ionicons name="alert-circle" size={15} color={c.error} />
                <Text variant="footnote" color="error" style={s.notesText}>{data.adminNotes}</Text>
              </View>
            ) : null}

            {isLoading ? (
              <SkeletonBlock height={48} radius={borderRadius.md} />
            ) : status === 'approved' ? (
              <View style={[s.resultBanner, { backgroundColor: c.successBg }]}>
                <Ionicons name="checkmark-circle" size={18} color={c.success} />
                <Text variant="footnote" color="success" style={s.resultText}>
                  Your profile is verified. The badge is live for other members.
                </Text>
              </View>
            ) : status === 'pending' ? (
              <View style={[s.resultBanner, { backgroundColor: c.warningBg }]}>
                <Ionicons name="time-outline" size={18} color={c.warning} />
                <Text variant="footnote" color="warning" style={s.resultText}>
                  Your selfie is with our team. Reviews usually finish within 24–48 hours.
                </Text>
              </View>
            ) : (
              <>
                <View style={s.steps}>
                  {HOW_IT_WORKS.map(({ step, title, desc }) => (
                    <View key={step} style={s.step}>
                      <View style={s.stepNum}>
                        {/* c.p500 is a burgundy-ramp value, not the curated `primary` colour — left as a style override. */}
                        <Text variant="micro" style={{ color: c.p500 }}>{step}</Text>
                      </View>
                      <Text variant="caption" color="textPrimary" style={s.stepTitle}>{title}</Text>
                      <Text variant="micro" color="textMuted" style={s.stepDesc}>{desc}</Text>
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
            <Ionicons name="lock-closed-outline" size={14} color={c.textMuted} />
            <Text variant="footnote" color="textMuted" style={s.noteText}>
              Your selfie is only used to confirm it matches your profile photos. We never show it to
              other members.
            </Text>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:     { flex: 1, backgroundColor: c.background },
  content:     { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },

  trustCard:   { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg },
  trustPct:    { color: c.g600 },
  trustCopy:   { flex: 1, gap: 4 },

  card:        { padding: spacing.lg, gap: spacing.md },
  cardLabel:   { letterSpacing: 0.6 },

  statusRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  statusRowLast:  { paddingBottom: 0, borderBottomWidth: 0 },
  statusLeft:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  pill:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: borderRadius.full },

  perks:       { backgroundColor: c.goldSoft, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm },
  perksLabel:  { color: c.g700, letterSpacing: 0.6 },
  perkRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  perkText:    { flex: 1 },

  notesBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: c.errorBg, borderRadius: borderRadius.md, padding: spacing.md },
  notesText:   { flex: 1 },

  resultBanner:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md },
  resultText:  { flex: 1 },

  steps:       { flexDirection: 'row', gap: spacing.sm },
  step:        { flex: 1, alignItems: 'center', backgroundColor: c.surfaceCard, borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: 4 },
  stepNum:     { width: 22, height: 22, borderRadius: 11, backgroundColor: c.p100, alignItems: 'center', justifyContent: 'center' },
  stepTitle:   { textAlign: 'center' },
  stepDesc:    { textAlign: 'center' },

  note:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.xs },
  noteText:    { flex: 1 },
});
