import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getMyVerifications, submitVerification } from '../../api/verification';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import type { VerificationTier } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: {
  tier: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  badge: keyof typeof Ionicons.glyphMap;
  docHint: string;
  badgeColor: string;
}[] = [
  { tier: 1, name: 'Mobile Verified',  description: 'Verify your phone number',          badge: 'phone-portrait-outline', docHint: 'Phone OTP already verified', badgeColor: colours.badgeMobile },
  { tier: 2, name: 'Photo Verified',   description: 'Take a live selfie to confirm it\'s you', badge: 'camera-outline', docHint: 'A clear, well-lit selfie — our team matches it against your profile photos', badgeColor: colours.badgeID },
  { tier: 3, name: 'Education Verified', description: 'Upload your degree or offer letter', badge: 'school-outline', docHint: 'Degree certificate or employer offer letter', badgeColor: colours.badgeEducation },
  { tier: 4, name: 'Income Verified',  description: 'Upload ITR or salary slip',          badge: 'cash-outline', docHint: 'ITR acknowledgement or 3-month salary slip', badgeColor: colours.badgeIncome },
];

type PickedFile = { uri: string; name: string; type: string };

// ─── Live selfie capture ─────────────────────────────────────────────────────
// Photo verification is a LIVE camera selfie only — never a gallery/file pick
// (uploads can be doctored). This mirrors the web LiveSelfieCapture flow and the
// selfie-only backend (POST /verification/submit expects a `selfiePhoto` file).
// launchCameraAsync opens the device camera live; front camera by default.

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

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending:  { label: 'Under Review', bg: colours.warning + '20', color: colours.warning },
    approved: { label: 'Verified',     bg: colours.success + '20', color: colours.success },
    rejected: { label: 'Rejected',     bg: colours.error   + '20', color: colours.error },
    flagged:  { label: 'Flagged',      bg: colours.error   + '20', color: colours.error },
  };
  const cfg = map[status] ?? map['pending'];
  return (
    <View style={[sb.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[sb.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
  text:  { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold },
});

// ─── Tier Card ────────────────────────────────────────────────────────────────

interface TierCardProps {
  config: typeof TIER_CONFIG[0];
  tierData?: VerificationTier;
  onUpload: (tier: 1 | 2 | 3 | 4) => void;
  uploading: boolean;
}

function TierCard({ config, tierData, onUpload, uploading }: TierCardProps) {
  const isEarned  = tierData?.isEarned ?? config.tier === 1;
  const status    = tierData?.status;
  const isPending = status === 'pending';
  const isRejected= status === 'rejected';

  return (
    <View style={[tc.card, isEarned && tc.cardEarned]} testID={`tier-card-${config.tier}`}>
      <View style={tc.header}>
        <Ionicons name={config.badge} size={26} color={config.badgeColor} style={tc.badge} />
        <View style={tc.info}>
          <Text style={[tc.name, isEarned && { color: config.badgeColor }]}>{config.name}</Text>
          <Text style={tc.desc}>{config.description}</Text>
        </View>
        {isEarned ? (
          <Ionicons name="checkmark-circle" size={24} color={config.badgeColor} />
        ) : isPending ? (
          <StatusBadge status="pending" />
        ) : (
          <Ionicons name="ellipse-outline" size={24} color={colours.border} />
        )}
      </View>

      {isRejected && tierData && (
        <View style={tc.rejectedBanner}>
          <Ionicons name="alert-circle" size={14} color={colours.error} style={{ marginRight: 6 }} />
          <Text style={tc.rejectedText}>
            Rejected{tierData.status === 'rejected' ? '' : ''} — tap to resubmit
          </Text>
        </View>
      )}

      {/* Only ID verification (tier 2) is backed server-side; education/income are not yet. */}
      {config.tier === 2 && !isEarned && !isPending && (
        <View style={tc.footer}>
          <Text style={tc.hint}>{config.docHint}</Text>
          <TouchableOpacity
            style={tc.uploadBtn}
            onPress={() => onUpload(config.tier)}
            disabled={uploading}
            testID={`upload-btn-tier-${config.tier}`}
            accessibilityLabel={`Upload document for ${config.name}`}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={tc.uploadText}>{isRejected ? 'Retake Selfie' : 'Take Selfie'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {config.tier > 2 && !isEarned && (
        <View style={tc.footer}>
          <Text style={tc.hint}>Coming soon</Text>
        </View>
      )}

      {isPending && (
        <Text style={tc.reviewText}>Under review — typically 24–48 hours</Text>
      )}
    </View>
  );
}

const tc = StyleSheet.create({
  card:          { backgroundColor: colours.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colours.border, padding: spacing.lg, marginBottom: spacing.md },
  cardEarned:    { borderColor: colours.success + '60', backgroundColor: colours.success + '05' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge:         { fontSize: 28 },
  info:          { flex: 1 },
  name:          { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  desc:          { fontSize: typography.fontSize.xs, color: colours.textSecondary, marginTop: 2 },
  footer:        { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colours.border, paddingTop: spacing.md },
  hint:          { fontSize: typography.fontSize.xs, color: colours.textSecondary, marginBottom: spacing.sm },
  uploadBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.primary, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignSelf: 'flex-start' },
  uploadText:    { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
  rejectedBanner:{ flexDirection: 'row', alignItems: 'center', backgroundColor: colours.error + '10', borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
  rejectedText:  { fontSize: typography.fontSize.xs, color: colours.error, fontFamily: typography.fontFamily.medium },
  reviewText:    { fontSize: typography.fontSize.xs, color: colours.warning, fontFamily: typography.fontFamily.medium, marginTop: spacing.sm },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [uploadingTier, setUploadingTier] = useState<number | null>(null);

  const { data: tiers, isLoading } = useQuery({
    queryKey: queryKeys.verification,
    queryFn: getMyVerifications,
    staleTime: 2 * 60 * 1000,
  });

  const submitMutation = useMutation({
    mutationFn: submitVerification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification });
      Alert.alert('Submitted!', 'Your selfie is under review. We\'ll notify you within 24–48 hours.');
    },
    onError: () => Alert.alert('Error', 'Submission failed. Please try again.'),
    onSettled: () => setUploadingTier(null),
  });

  const handleUpload = async (tier: 1 | 2 | 3 | 4) => {
    const file = await captureSelfie();
    if (!file) return;
    setUploadingTier(tier);
    const form = new FormData();
    // Selfie-only backend: POST /verification/submit expects a `selfiePhoto` file.
    form.append('selfiePhoto', { uri: file.uri, name: file.name, type: file.type } as any);
    submitMutation.mutate(form);
  };

  return (
    <View style={[s.wrapper, { paddingTop: insets.top }]} testID="VerificationScreen">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} testID="back-btn" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.intro}>
          <Ionicons name="shield-checkmark" size={36} color={colours.primary} />
          <Text style={s.introTitle}>Build Trust with Verification</Text>
          <Text style={s.introSub}>Verified profiles get 3× more interest. Complete all 4 tiers to display the Elite badge.</Text>
        </View>

        {/* Selfie liveness CTA */}
        <TouchableOpacity
          style={sv.card}
          onPress={() => navigation.navigate('SelfieVerification')}
          testID="selfie-verification-btn"
          accessibilityLabel="Start video verification"
        >
          <View style={sv.left}>
            <Ionicons name="videocam" size={24} color={colours.primary} />
          </View>
          <View style={sv.info}>
            <Text style={sv.title}>Video Verified Badge</Text>
            <Text style={sv.sub}>3-second selfie liveness check → earn the Video Verified badge</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colours.textMuted} />
        </TouchableOpacity>

        {isLoading ? (
          <ActivityIndicator size="large" color={colours.primary} style={{ marginTop: spacing['3xl'] }} />
        ) : (
          TIER_CONFIG.map((cfg) => {
            const tierData = tiers?.find((t) => t.tier === cfg.tier);
            return (
              <TierCard
                key={cfg.tier}
                config={cfg}
                tierData={tierData}
                onUpload={handleUpload}
                uploading={uploadingTier === cfg.tier}
              />
            );
          })
        )}

        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={16} color={colours.textMuted} />
          <Text style={s.noteText}>
            Your selfie is reviewed by our team and only used to confirm it matches your profile photos. We never share it with other members.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const sv = StyleSheet.create({
  card:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colours.primary + '40', padding: spacing.md, marginBottom: spacing.md, gap: spacing.md },
  left:  { width: 40, height: 40, borderRadius: 20, backgroundColor: colours.primaryLight, alignItems: 'center', justifyContent: 'center' },
  info:  { flex: 1 },
  title: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.primary },
  sub:   { fontSize: typography.fontSize.xs, color: colours.textSecondary, marginTop: 2 },
});

const s = StyleSheet.create({
  wrapper:     { flex: 1, backgroundColor: colours.surfaceCard },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colours.background, borderBottomWidth: 1, borderBottomColor: colours.border },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  content:     { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  intro:       { alignItems: 'center', backgroundColor: colours.primaryLight, borderRadius: borderRadius.lg, padding: spacing.xl, marginBottom: spacing.xl, gap: spacing.sm },
  introTitle:  { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.primary, textAlign: 'center' },
  introSub:    { fontSize: typography.fontSize.sm, color: colours.textSecondary, textAlign: 'center', lineHeight: 20 },
  note:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md, backgroundColor: colours.surfaceCard, borderRadius: borderRadius.md },
  noteText:    { flex: 1, fontSize: typography.fontSize.xs, color: colours.textMuted, lineHeight: 18 },
});
