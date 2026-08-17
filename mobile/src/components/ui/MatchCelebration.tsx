import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colours, type } from '@shared/constants/theme';
import { spring } from '@shared/constants/motion';
import { haptics } from '../../utils/haptics';
import { useReduceMotion } from '../motion';
import Button from './Button';

interface Props {
  visible: boolean;
  name?: string;
  onClose: () => void;
  onMessage?: () => void;
}

/**
 * Mutual-match reveal — a tasteful full-screen gold seal that scales in with
 * `spring.pop` + a success haptic (handoff: "no confetti spam"). Burgundy scrim,
 * gold seal, name line, message / keep-browsing CTAs.
 */
export default function MatchCelebration({ visible, name, onClose, onMessage }: Props) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(reduced ? 1 : 0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      haptics.success();
      scale.value = reduced ? 1 : withSpring(1, spring.pop);
      // One subtle ring pulse behind the seal — celebration, not confetti.
      if (!reduced) {
        pulse.value = 0;
        pulse.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
      }
    } else {
      scale.value = reduced ? 1 : 0;
      pulse.value = 0;
    }
  }, [visible, reduced, scale, pulse]);

  const sealStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scrim}>
        <Animated.View style={[styles.pulseRing, pulseStyle]} pointerEvents="none" />
        <Animated.View style={sealStyle}>
          <LinearGradient
            colors={[colours.g300, colours.g600]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.seal}
          >
            <Ionicons name="heart" size={48} color={colours.goldText} />
          </LinearGradient>
        </Animated.View>
        <Text style={styles.title}>It's a match!</Text>
        {name ? <Text style={styles.sub}>You and {name} have shown interest in each other.</Text> : null}
        <View style={styles.ctaRow}>
          {onMessage ? (
            <Button title="Send a message" variant="gold" icon="chatbubble" onPress={onMessage} style={styles.cta} />
          ) : null}
          <Button title="Keep browsing" variant="text" onPress={onClose} />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'rgba(85,23,46,0.94)', // p700 @ ~94%
  },
  pulseRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: colours.g300,
  },
  seal: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: { ...type.title1, fontFamily: 'PlayfairDisplay-Bold', color: '#fff', textAlign: 'center' },
  sub: { ...type.callout, color: 'rgba(255,255,255,0.86)', textAlign: 'center', marginTop: 8, maxWidth: 300 },
  ctaRow: { marginTop: 28, width: '100%', gap: 4, alignItems: 'center' },
  cta: { width: '100%' },
});
