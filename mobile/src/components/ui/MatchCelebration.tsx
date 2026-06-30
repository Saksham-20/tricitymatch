import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

  useEffect(() => {
    if (visible) {
      haptics.success();
      scale.value = reduced ? 1 : withSpring(1, spring.pop);
    } else {
      scale.value = reduced ? 1 : 0;
    }
  }, [visible, reduced, scale]);

  const sealStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scrim}>
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
