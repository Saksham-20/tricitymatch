import React, { useState } from 'react';
import { AccessibilityInfo, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { Button, Card, EmptyState, ScreenHeader, SkeletonBlock, TickRing } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';
import { showToast } from '../../utils/toast';
import { getPhotoVerification, submitVerification } from '../../api/verification';
import { getMyProfile } from '../../api/profile';
import { useAuthStore } from '../../stores/authStore';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import type { PhotoVerification } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

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

/** 'denied' = the member refused camera access; null = they backed out. */
async function captureSelfie(): Promise<PickedFile | 'denied' | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return 'denied';
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

/** A decorative glyph: the screen reader skips it and reads the text beside it. */
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

type StatusMeta = {
  label: string;
  /** Icon colour. */
  tint: string;
  /** Label colour: the tint where it clears 4.5:1 on `bg`, otherwise a text colour. */
  text: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// Warning orange is 2.5:1 as text on its own tint in light mode, and the success
// green is 3.1:1 on its tint in dark mode. The icon keeps the status hue; the
// label uses `successAccent` (the theme's readable green) or a plain text colour.
const makeStatusMeta = (c: ThemeColours): Record<string, StatusMeta> => ({
  approved: { label: 'Verified',     tint: c.successAccent, text: c.successAccent, bg: c.successBg, icon: 'checkmark-circle' },
  pending:  { label: 'Under review', tint: c.warning,       text: c.textPrimary,   bg: c.warningBg, icon: 'time-outline' },
  rejected: { label: 'Rejected',     tint: c.error,         text: c.error,         bg: c.errorBg,   icon: 'close-circle' },
});

/**
 * `flagged` is an internal admin state: the server sends no member notification
 * for it and no reason (`adminNotes` is only populated on reject), so a red
 * "Flagged" pill would be an accusation with nothing behind it. The member sees
 * it as what it is from their side, a review that is still with the team.
 */
const memberFacingStatus = (status: PhotoVerification['status']): PhotoVerification['status'] =>
  status === 'flagged' ? 'pending' : status;

const statusLabel = (
  meta: Record<string, StatusMeta>,
  status: PhotoVerification['status'],
  notStartedLabel: string,
) => meta[status]?.label ?? notStartedLabel;

function StatusPill({ status, notStartedLabel = 'Not started' }: { status: PhotoVerification['status']; notStartedLabel?: string }) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const meta = React.useMemo(() => makeStatusMeta(c), [c])[status];
  if (!meta) {
    return (
      <View style={[s.pill, { backgroundColor: c.n100 }]}>
        <Text variant="caption" color="textSecondary">{notStartedLabel}</Text>
      </View>
    );
  }
  return (
    <View style={[s.pill, { backgroundColor: meta.bg }]} testID={`status-pill-${status}`}>
      <Ionicons name={meta.icon} size={13} color={meta.tint} {...HIDE_FROM_A11Y} />
      {/* meta.text is a resolved colour value (a readable green, or a text colour),
          not a TextColor key, so it stays an explicit style override. */}
      <Text variant="caption" style={{ color: meta.text }}>{meta.label}</Text>
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
  const { c, elder } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const s = React.useMemo(() => makeS(c), [c]);
  const statusMeta = React.useMemo(() => makeStatusMeta(c), [c]);
  const queryClient = useQueryClient();
  const phoneVerified = useAuthStore((st) => st.user?.phoneVerified ?? false);
  const [cameraDenied, setCameraDenied] = useState(false);

  // `isPending` (no data yet), not `isLoading`: a first fetch paused offline must
  // read as unknown, never as "not submitted" (which would offer a second selfie).
  const { data, isPending: isLoading, isError, fetchStatus, refetch } = useQuery({
    queryKey: queryKeys.verification,
    queryFn: getPhotoVerification,
    staleTime: 2 * 60 * 1000,
  });
  // The selfie is matched against the profile photos, so a member with none has nothing for it to
  // be matched to. Shares OwnProfile's cache. While it is unknown (loading or failed) the flow is
  // NOT blocked: only a profile that loaded and holds no photo gets sent to add one first.
  // Photos are added on other screens that do not always refresh this cache, so it is re-read on
  // open, and the "no photo" claim is only made from a settled read, never from a stale one.
  const { data: myProfile, isFetching: profileFetching } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
  const needsProfilePhoto =
    !!myProfile && !profileFetching && !myProfile.profilePhoto && (myProfile.photos?.length ?? 0) === 0;

  // A first fetch that is paused offline never errors, it just waits, which would
  // leave the skeleton up forever. With nothing cached that reads as a failure the
  // member can retry.
  const loadFailed = !data && (isError || fetchStatus === 'paused');

  const submitMutation = useMutation({
    mutationFn: submitVerification,
    onSuccess: () => {
      // The status card below flips to "Under review" on its own; the toast is
      // the confirmation that the upload landed. (The verification key is the one
      // OwnProfile and Home read, so it is the only one to refresh.)
      queryClient.invalidateQueries({ queryKey: queryKeys.verification });
      showToast.success('Selfie submitted', "We'll notify you once it's done.");
      // The status banner is a live region, which only Android honours: say it
      // on iOS, and leave Android to the region so it is not read twice.
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility('Selfie submitted. Our team will review it.');
      }
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
          ?.response?.data?.error?.message ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Submission failed. Please try again.';
      showToast.error('Could not submit', message);
      AccessibilityInfo.announceForAccessibility(`Could not submit. ${message}`);
    },
  });

  const handleCapture = async () => {
    let file: PickedFile | 'denied' | null;
    try {
      file = await captureSelfie();
    } catch {
      // No camera (a simulator, or hardware that is missing or in use).
      showToast.error('Camera unavailable', 'Photo verification needs a device with a working camera.');
      return;
    }
    if (file === 'denied') {
      setCameraDenied(true);
      return;
    }
    if (!file) return;
    setCameraDenied(false);
    const form = new FormData();
    form.append('selfiePhoto', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    submitMutation.mutate(form);
  };

  const status = memberFacingStatus(data?.status ?? 'not_submitted');
  const canSubmit = status === 'not_submitted' || status === 'rejected';
  const captureTitle = status === 'not_submitted' ? 'Take selfie' : 'Retake selfie';
  const submitting = submitMutation.isPending;

  return (
    <Screen edges={['top', 'bottom']} style={s.wrapper} testID="VerificationScreen">
      <ScreenHeader title="Verification" />

      {loadFailed ? (
        <View style={s.errorBody}>
          <EmptyState
            variant="error"
            icon="shield-checkmark-outline"
            title="Couldn't load your verification"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => refetch()}
            testID="VerificationScreen-error"
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Summary: how many of the two checks below are done. While the status
              loads the block reads as one busy element, so a screen-reader user
              hears that something is loading instead of silence. */}
          <View
            accessible={isLoading}
            accessibilityLabel={isLoading ? 'Loading your verification status' : undefined}
            accessibilityState={{ busy: isLoading }}
          >
            <Card style={s.trustCard}>
              {/* One verification can be earned in the app (the mobile number is confirmed at signup
                  and nowhere else), so the ring reports the photo check alone: full when approved,
                  empty otherwise. It used to count "checks complete" out of 2, which left an email
                  signup at 1 of 2 forever with nothing to do about the other half. */}
              <TickRing value={isLoading ? 0 : status === 'approved' ? 100 : 0} size={78} ticks={10} color={c.accent}>
                {isLoading ? (
                  <SkeletonBlock width={28} height={28} radius={borderRadius.full} />
                ) : (
                  <Ionicons
                    name={status === 'approved' ? 'checkmark' : status === 'pending' ? 'time-outline' : 'camera-outline'}
                    size={30}
                    color={status === 'approved' ? c.successAccent : c.accent}
                    {...HIDE_FROM_A11Y}
                  />
                )}
              </TickRing>
              <View style={s.trustCopy}>
                <Text variant="title3" color="textPrimary" accessibilityRole="header">{t('verification.summaryTitle', 'Your verification')}</Text>
                <Text variant="footnote" color="textSecondary">
                  {isLoading
                    ? t('verification.summaryDefault', 'A verified badge tells families your photos are really you.')
                    : status === 'approved'
                      ? t('verification.summaryApproved', 'Your photo is verified. Families see the badge on your profile.')
                      : status === 'pending'
                        ? t('verification.summaryPending', 'Your selfie is with our team.')
                        : t('verification.summaryDefault', 'A verified badge tells families your photos are really you.')}
                </Text>
              </View>
            </Card>
          </View>

          {/* Status overview */}
          <Card style={s.card}>
            <Text variant="headline" color="fgStrong" accessibilityRole="header">Status</Text>
            {/* Shown only when true. The number is confirmed at signup and there is no way to do it
                here, so a permanent "Not verified" row was a label with nothing to press. */}
            {phoneVerified ? (
              <View
                style={s.statusRow}
                accessible
                accessibilityLabel="Mobile number: Verified"
              >
                <View style={s.statusLeft}>
                  <Ionicons name="phone-portrait-outline" size={18} color={c.successAccent} {...HIDE_FROM_A11Y} />
                  <Text variant="callout" color="textPrimary">Mobile number</Text>
                </View>
                <StatusPill status="approved" />
              </View>
            ) : null}
            <View
              style={[s.statusRow, s.statusRowLast]}
              accessible={!isLoading}
              accessibilityLabel={`Photo verification: ${statusLabel(statusMeta, status, 'Not started')}`}
            >
              <View style={s.statusLeft}>
                <Ionicons name="camera-outline" size={18} color={c.accent} {...HIDE_FROM_A11Y} />
                <Text variant="callout" color="textPrimary">Photo verification</Text>
              </View>
              {isLoading ? <SkeletonBlock width={96} height={22} radius={borderRadius.full} /> : <StatusPill status={status} />}
            </View>
          </Card>

          {/* Photo verification */}
          <Card style={s.card}>
            <Text variant="headline" color="textPrimary" accessibilityRole="header">Photo verification</Text>
            <Text variant="footnote" color="textSecondary">
              Take a live selfie with your camera. Our team matches it against your profile photos.
              No documents needed.
            </Text>

            <View style={s.perks}>
              <Text variant="subhead" color="textPrimary" accessibilityRole="header">Why get verified</Text>
              {PERKS.map((perk) => (
                <View key={perk} style={s.perkRow}>
                  <Ionicons name="checkmark-circle" size={15} color={c.successAccent} {...HIDE_FROM_A11Y} />
                  <Text variant="footnote" color="textPrimary" style={s.perkText}>{perk}</Text>
                </View>
              ))}
            </View>

            {data?.adminNotes ? (
              <View style={s.notesBanner} testID="admin-notes">
                <Ionicons name="alert-circle" size={15} color={c.error} {...HIDE_FROM_A11Y} />
                <Text variant="footnote" color="error" style={s.notesText}>{data.adminNotes}</Text>
              </View>
            ) : null}

            {isLoading ? (
              <SkeletonBlock height={48} radius={borderRadius.md} />
            ) : status === 'approved' ? (
              <View style={[s.resultBanner, { backgroundColor: c.successBg }]} accessibilityLiveRegion="polite">
                <Ionicons name="checkmark-circle" size={18} color={c.successAccent} {...HIDE_FROM_A11Y} />
                <Text variant="footnote" color="textPrimary" style={s.resultText}>
                  Your profile is verified. The badge is live for other members.
                </Text>
              </View>
            ) : status === 'pending' ? (
              <View style={[s.resultBanner, { backgroundColor: c.warningBg }]} accessibilityLiveRegion="polite">
                <Ionicons name="time-outline" size={18} color={c.warning} {...HIDE_FROM_A11Y} />
                <Text variant="footnote" color="textPrimary" style={s.resultText}>
                  Your selfie is with our team. We'll notify you once it's done.
                </Text>
              </View>
            ) : (
              <>
                {/* A plain numbered list, not three bordered tiles inside this card. */}
                <View style={s.steps}>
                  {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
                    <View
                      key={step}
                      style={[s.step, i < HOW_IT_WORKS.length - 1 && s.stepDivider]}
                      accessible
                      accessibilityLabel={`Step ${step}: ${title}. ${desc}`}
                    >
                      <View style={s.stepNum}>
                        {/* Fixed 22pt circle: cap OS text scaling so the digit cannot outgrow it. */}
                        <Text variant="micro" color="primary" maxScale={1.3}>{step}</Text>
                      </View>
                      <View style={s.stepText}>
                        <Text variant="subhead" color="textPrimary">{title}</Text>
                        <Text variant="footnote" color="textSecondary">{desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {cameraDenied ? (
                  <View style={s.notice} accessibilityLiveRegion="polite" testID="camera-denied">
                    <View style={s.noticeTop}>
                      <Ionicons name="camera-outline" size={18} color={c.textSecondary} {...HIDE_FROM_A11Y} />
                      <Text variant="footnote" color="textSecondary" style={s.noticeText}>
                        Camera access is off. Photo verification needs a live selfie, so turn the camera on in Settings.
                      </Text>
                    </View>
                    {/* Text colour, underlined: dark-mode accent is 3.56:1 on this
                        surface2 notice, and this is the way out of the dead end. */}
                    <PressableScale
                      style={[s.noticeAction, { minHeight: tapSize(elder) }]}
                      onPress={() => Linking.openSettings().catch(() => null)}
                      testID="open-settings-btn"
                      accessibilityRole="button"
                      accessibilityLabel="Open Settings"
                      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text variant="subhead" color="textPrimary" style={s.linkText}>Open Settings</Text>
                    </PressableScale>
                  </View>
                ) : null}

                {needsProfilePhoto ? (
                  <>
                    <View style={s.notice} testID="needs-profile-photo">
                      <View style={s.noticeTop}>
                        <Ionicons name="image-outline" size={18} color={c.textSecondary} {...HIDE_FROM_A11Y} />
                        <Text variant="footnote" color="textSecondary" style={s.noticeText}>
                          {t('verification.needPhotoBody', 'Your selfie is matched against your profile photos, and you have not added one yet.')}
                        </Text>
                      </View>
                    </View>
                    <Button
                      title={t('verification.addPhotoFirst', 'Add a profile photo first')}
                      icon="camera"
                      onPress={() => navigation.navigate('EditProfile', { section: 'photos' } as never)}
                      haptic={false}
                      testID="add-profile-photo-btn"
                    />
                  </>
                ) : (
                  <Button
                    title={captureTitle}
                    icon="camera"
                    onPress={handleCapture}
                    haptic={false}
                    loading={submitting}
                    disabled={submitting || !canSubmit}
                    testID="capture-selfie-btn"
                    accessibilityLabel={`${captureTitle}. Uses your live camera.`}
                  />
                )}
              </>
            )}
          </Card>

          <View style={s.note}>
            <Ionicons name="lock-closed-outline" size={14} color={c.textSecondary} {...HIDE_FROM_A11Y} />
            <Text variant="footnote" color="textSecondary" style={s.noteText}>
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
  errorBody:   { flex: 1, justifyContent: 'center' },
  content:     { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },

  trustCard:   { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg },
  trustCopy:   { flex: 1, gap: 4 },

  card:        { padding: spacing.lg, gap: spacing.md },

  statusRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  statusRowLast:  { paddingBottom: 0, borderBottomWidth: 0 },
  statusLeft:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },

  pill:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: borderRadius.full },

  perks:       { backgroundColor: c.surface2, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm },
  perkRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  perkText:    { flex: 1 },

  notesBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: c.errorBg, borderRadius: borderRadius.md, padding: spacing.md },
  notesText:   { flex: 1 },

  resultBanner:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md },
  resultText:  { flex: 1 },

  // No per-step border or fill: these sit inside a card already.
  steps:       { marginVertical: spacing.xs },
  step:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md },
  stepDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline },
  stepText:    { flex: 1 },
  // Accent tint + `primary` text: the burgundy-ramp p100/p500 pair is fine in
  // light mode and about 1.5:1 in dark.
  stepNum:     { width: 22, height: 22, borderRadius: 11, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },

  notice:      { backgroundColor: c.surface2, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.xs },
  noticeTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  noticeText:  { flex: 1 },
  noticeAction:{ alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: spacing.sm },
  linkText:    { textDecorationLine: 'underline' },

  note:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.xs },
  noteText:    { flex: 1 },
});
