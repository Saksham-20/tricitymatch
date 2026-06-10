import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Modal, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { callColours } from '../../features/calls/callTheme';
import { useCallStore } from '../../stores/callStore';
import { declineCall } from '../../api/calls';
import type { MainStackParamList } from '../../navigation/types';
import type { CallInvitation } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const RING_TIMEOUT_MS = 30_000;

interface Props {
  invitation: CallInvitation;
}

export default function IncomingCallModal({ invitation }: Props) {
  const navigation = useNavigation<Nav>();
  const { clearIncomingCall } = useCallStore();

  const [visible, setVisible] = useState(true);
  const [remaining, setRemaining] = useState(30);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);

  // ─── Pulse animation on avatar ──────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // ─── Countdown timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining((r) => r - 1);
    }, 1000);

    timeoutRef.current = setTimeout(() => {
      if (!dismissedRef.current) dismiss();
    }, RING_TIMEOUT_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
    clearIncomingCall();
  }, [clearIncomingCall]);

  const handleAccept = useCallback(() => {
    const screen = invitation.callType === 'video' ? 'VideoCall' : 'VoiceCall';
    const params =
      invitation.callType === 'video'
        ? { callId: invitation.callId, channelName: invitation.agoraChannel, calleeId: invitation.callerId, callType: 'video' as const }
        : { callId: invitation.callId, channelName: invitation.agoraChannel, calleeId: invitation.callerId };

    dismiss();
    // Small delay so modal fully dismisses before navigation
    setTimeout(() => {
      navigation.navigate(screen as any, params as any);
    }, 100);
  }, [invitation, dismiss, navigation]);

  const handleDecline = useCallback(async () => {
    dismiss();
    try { await declineCall(invitation.callId); } catch { /* ignore */ }
  }, [invitation.callId, dismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      testID="IncomingCallModal"
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Call type label */}
          <Text style={styles.callTypeLabel}>
            {invitation.callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'}
          </Text>

          {/* Avatar with pulse */}
          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
            {invitation.callerPhoto ? (
              <Image source={{ uri: invitation.callerPhoto }} style={styles.avatar} testID="CallerPhoto" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={48} color={colours.textMuted} />
              </View>
            )}
          </Animated.View>

          {/* Caller name */}
          <Text style={styles.callerName} testID="CallerName">{invitation.callerName}</Text>

          {/* Countdown */}
          <Text style={styles.countdown} testID="Countdown">
            Auto-declining in {remaining}s
          </Text>

          {/* Action buttons */}
          <View style={styles.actions}>
            <ActionBtn
              icon="call"
              label="Accept"
              color={colours.success}
              onPress={handleAccept}
              testID="AcceptBtn"
            />
            <ActionBtn
              icon="call"
              iconStyle={{ transform: [{ rotate: '135deg' }] }}
              label="Decline"
              color={colours.error}
              onPress={handleDecline}
              testID="DeclineBtn"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── ActionBtn ───────────────────────────────────────────────────────────────
interface ActionBtnProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconStyle?: object;
  label: string;
  color: string;
  onPress: () => void;
  testID?: string;
}

function ActionBtn({ icon, iconStyle, label, color, onPress, testID }: ActionBtnProps) {
  return (
    <View style={styles.actionWrap}>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: color }]}
        onPress={onPress}
        testID={testID}
        accessibilityLabel={label}
      >
        <View style={iconStyle}>
          <Ionicons name={icon} size={28} color="#fff" />
        </View>
      </TouchableOpacity>
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: callColours.scrimDark,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: callColours.overlay,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing['3xl'],
    alignItems: 'center',
    gap: spacing.lg,
  },
  callTypeLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  avatarWrap: {
    marginVertical: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colours.primary,
  },
  avatarFallback: {
    backgroundColor: colours.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callerName: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: '#ffffff',
  },
  countdown: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: callColours.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing['4xl'],
    marginTop: spacing.lg,
  },
  actionWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: callColours.black,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  actionLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: callColours.textMuted,
  },
});
