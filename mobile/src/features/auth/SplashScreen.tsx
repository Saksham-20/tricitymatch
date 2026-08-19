import React, { useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { colours, typography, type ThemeColours } from '@shared/constants/theme';
import Logo from '../../components/common/Logo';
import { useReduceMotion } from '../../components/motion';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

/** One dot of the boot loader — gentle opacity pulse (handoff: 3-dot loader). */
function LoaderDot({ delay }: { delay: number }) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const reduced = useReduceMotion();
  const o = useSharedValue(0.35);
  useEffect(() => {
    if (reduced) {
      o.value = 0.7;
      return;
    }
    o.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 350, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.35, { duration: 350, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(o);
  }, [reduced, delay, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, st]} />;
}

export default function SplashScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const { isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        navigation.replace('Welcome');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, navigation]);

  return (
    <View style={styles.container} testID="SplashScreen">
      <LinearGradient
        colors={[c.p600, c.p500, c.p700]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.logoContainer}>
        <Logo variant="white" size="xl" />
        <Text style={styles.tagline}>Find Your Perfect Match</Text>
      </View>
      {isLoading && (
        <View style={styles.dotsRow} testID="SplashScreen-loader">
          <LoaderDot delay={0} />
          <LoaderDot delay={160} />
          <LoaderDot delay={320} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 12,
    letterSpacing: 0.3,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
});
