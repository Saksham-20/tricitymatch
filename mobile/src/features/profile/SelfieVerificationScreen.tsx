import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { submitSelfieVerification } from '../../api/verification';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Camera stub (dynamic require — no-op in Expo Go) ─────────────────────────

type CameraRef = { recordAsync: (opts: { maxDuration: number }) => Promise<{ uri: string }> };

async function startCameraRecording(cameraRef: React.RefObject<CameraRef | null>): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Camera } = require('expo-camera');
    void Camera; // ensure import is used
    if (!cameraRef.current) return null;
    const result = await cameraRef.current.recordAsync({ maxDuration: 3 });
    return result.uri;
  } catch {
    // Expo Go stub — simulate a 3s recording
    return new Promise((resolve) =>
      setTimeout(() => resolve('file://DEV_STUB_SELFIE.mp4'), 3000)
    );
  }
}

async function stopCameraRecording(cameraRef: React.RefObject<CameraRef | null>): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Camera } = require('expo-camera');
    void Camera;
    if (cameraRef.current) {
      // stopRecording is called on the ref directly
      (cameraRef.current as any).stopRecording?.();
    }
  } catch { /* no-op in Expo Go */ }
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { icon: 'eye-outline' as const,      label: 'Look straight at camera' },
  { icon: 'scan-outline' as const,     label: 'Slowly turn head left then right' },
  { icon: 'checkmark-circle-outline' as const, label: 'Hold still for 1 second' },
];

function LivenessInstructions() {
  return (
    <View style={ins.container}>
      <Text style={ins.title}>Liveness Check Instructions</Text>
      {STEPS.map((step, i) => (
        <View key={i} style={ins.row}>
          <View style={ins.numBadge}>
            <Text style={ins.num}>{i + 1}</Text>
          </View>
          <Ionicons name={step.icon} size={20} color={colours.primary} style={{ marginHorizontal: spacing.sm }} />
          <Text style={ins.label}>{step.label}</Text>
        </View>
      ))}
    </View>
  );
}

const ins = StyleSheet.create({
  container: { backgroundColor: colours.primaryLight, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.xl },
  title:     { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.primary, marginBottom: spacing.md },
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  numBadge:  { width: 24, height: 24, borderRadius: 12, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center' },
  num:       { color: '#fff', fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.bold },
  label:     { flex: 1, fontSize: typography.fontSize.sm, color: colours.textSecondary },
});

// ─── Recording indicator ──────────────────────────────────────────────────────

function RecordingDot({ recording }: { recording: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!recording) { opacity.setValue(1); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [recording]);

  return (
    <Animated.View style={[rd.dot, { opacity }]} />
  );
}

const rd = StyleSheet.create({
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colours.error, marginRight: spacing.xs },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

type Stage = 'instructions' | 'recording' | 'processing' | 'success' | 'failed';

export default function SelfieVerificationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const cameraRef = useRef<CameraRef | null>(null);

  const [stage, setStage] = useState<Stage>('instructions');
  const [countdown, setCountdown] = useState(3);

  const submitMutation = useMutation({
    mutationFn: submitSelfieVerification,
    onSuccess: () => {
      setStage('success');
      queryClient.invalidateQueries({ queryKey: queryKeys.verification });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    },
    onError: () => setStage('failed'),
  });

  const startRecording = async () => {
    setStage('recording');
    setCountdown(3);

    // Countdown ticker
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);

    const uri = await startCameraRecording(cameraRef);
    await stopCameraRecording(cameraRef);
    clearInterval(interval);

    if (!uri) {
      setStage('failed');
      return;
    }

    setStage('processing');
    const form = new FormData();
    form.append('selfieVideo', { uri, name: 'liveness.mp4', type: 'video/mp4' } as any);
    submitMutation.mutate(form);
  };

  const reset = () => {
    setStage('instructions');
    setCountdown(3);
  };

  return (
    <View style={s.wrapper} testID="SelfieVerificationScreen">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} testID="back-btn" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Video Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.content}>
        {/* Badge banner */}
        <View style={s.badgeBanner}>
          <Ionicons name="videocam" size={28} color={colours.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.badgeTitle}>Video Verified Badge</Text>
            <Text style={s.badgeSub}>Complete a 3-second selfie liveness check to earn the Video Verified badge on your profile.</Text>
          </View>
        </View>

        {stage === 'instructions' && (
          <>
            <LivenessInstructions />

            {/* Camera preview placeholder */}
            <View style={s.cameraBox} testID="camera-preview">
              <Ionicons name="camera-outline" size={48} color={colours.textMuted} />
              <Text style={s.cameraHint}>Camera preview will appear here</Text>
              <Text style={s.cameraNote}>(Native build required — Expo Go shows stub)</Text>
            </View>

            <TouchableOpacity
              style={s.recordBtn}
              onPress={startRecording}
              testID="start-recording-btn"
              accessibilityLabel="Start liveness recording"
            >
              <Ionicons name="radio-button-on" size={20} color="#fff" style={{ marginRight: spacing.sm }} />
              <Text style={s.recordBtnText}>Start 3-Second Check</Text>
            </TouchableOpacity>
          </>
        )}

        {stage === 'recording' && (
          <View style={s.recordingState}>
            <View style={s.recordingBadge}>
              <RecordingDot recording />
              <Text style={s.recordingLabel}>Recording…</Text>
            </View>
            <View style={s.countdownCircle}>
              <Text style={s.countdownNumber}>{countdown > 0 ? countdown : '✓'}</Text>
            </View>
            <Text style={s.recordingHint}>Look straight, then slowly turn your head left and right</Text>
          </View>
        )}

        {stage === 'processing' && (
          <View style={s.centreState}>
            <ActivityIndicator size="large" color={colours.primary} />
            <Text style={s.processingText}>Analyzing liveness…</Text>
            <Text style={s.processingNote}>This usually takes 5–10 seconds</Text>
          </View>
        )}

        {stage === 'success' && (
          <View style={s.centreState}>
            <View style={s.successIcon}>
              <Ionicons name="checkmark-circle" size={72} color={colours.success} />
            </View>
            <Text style={s.successTitle}>Video Verified!</Text>
            <Text style={s.successSub}>Your profile now displays the Video Verified badge. Verified profiles receive significantly more interest.</Text>
            <TouchableOpacity
              style={[s.recordBtn, { backgroundColor: colours.success }]}
              onPress={() => navigation.goBack()}
              testID="done-btn"
              accessibilityLabel="Done"
            >
              <Text style={s.recordBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {stage === 'failed' && (
          <View style={s.centreState}>
            <Ionicons name="alert-circle" size={72} color={colours.error} />
            <Text style={s.failedTitle}>Verification Failed</Text>
            <Text style={s.failedSub}>We could not confirm liveness. Please ensure good lighting and your face is fully visible, then try again.</Text>
            <TouchableOpacity
              style={[s.recordBtn, { backgroundColor: colours.error }]}
              onPress={reset}
              testID="retry-btn"
              accessibilityLabel="Try again"
            >
              <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: spacing.sm }} />
              <Text style={s.recordBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:         { flex: 1, backgroundColor: colours.background },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colours.background, borderBottomWidth: 1, borderBottomColor: colours.border },
  backBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:           { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  content:         { flex: 1, padding: spacing.lg },
  badgeBanner:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colours.primaryLight, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.xl },
  badgeTitle:      { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.primary, marginBottom: 2 },
  badgeSub:        { fontSize: typography.fontSize.sm, color: colours.textSecondary, lineHeight: 20 },
  cameraBox:       { alignItems: 'center', justifyContent: 'center', backgroundColor: colours.surfaceCard, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colours.border, height: 220, marginBottom: spacing.xl, gap: spacing.sm },
  cameraHint:      { fontSize: typography.fontSize.sm, color: colours.textMuted },
  cameraNote:      { fontSize: typography.fontSize.xs, color: colours.textMuted },
  recordBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  recordBtnText:   { color: '#fff', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold },
  recordingState:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  recordingBadge:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.error + '15', borderRadius: borderRadius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  recordingLabel:  { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.error },
  countdownCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: colours.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.primaryLight },
  countdownNumber: { fontSize: 48, fontFamily: typography.fontFamily.bold, color: colours.primary },
  recordingHint:   { fontSize: typography.fontSize.sm, color: colours.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
  centreState:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  processingText:  { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  processingNote:  { fontSize: typography.fontSize.sm, color: colours.textSecondary },
  successIcon:     { marginBottom: spacing.md },
  successTitle:    { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold, color: colours.success, textAlign: 'center' },
  successSub:      { fontSize: typography.fontSize.sm, color: colours.textSecondary, textAlign: 'center', lineHeight: 22 },
  failedTitle:     { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold, color: colours.error, textAlign: 'center' },
  failedSub:       { fontSize: typography.fontSize.sm, color: colours.textSecondary, textAlign: 'center', lineHeight: 22 },
});
