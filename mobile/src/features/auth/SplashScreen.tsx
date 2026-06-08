import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { colours, typography } from '@shared/constants/theme';
import Logo from '../../components/common/Logo';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

export default function SplashScreen() {
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
      <View style={styles.logoContainer}>
        <Logo variant="white" size="xl" />
        <Text style={styles.tagline}>Find Your Perfect Match</Text>
      </View>
      {isLoading && (
        <ActivityIndicator
          size="large"
          color="#FFFFFF"
          style={styles.spinner}
          testID="SplashScreen-loader"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.primary,
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
  spinner: {
    position: 'absolute',
    bottom: 80,
  },
});
