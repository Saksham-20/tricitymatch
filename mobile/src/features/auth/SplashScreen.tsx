import React, { useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet } from 'react-native';
import Text from '../../components/ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import type { ThemeColours } from '@shared/constants/theme';
import Logo from '../../components/common/Logo';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

/**
 * There is no loading state here on purpose, and no hold either. This screen only
 * mounts inside the Auth stack, and RootNavigator renders its own spinner (and no
 * navigator at all) for as long as `isLoading` is true, so by the time Splash
 * exists the session check is already over. The brand moment belongs to the
 * native splash that covered the launch; holding a signed-out member here on
 * every cold start (doctrine §10.4's frequency gate) would only make the door to
 * Welcome slower, with no way to skip it.
 */
export default function SplashScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // An authenticated member never sees the Auth stack: RootNavigator swaps it out.
    if (!isLoading && !isAuthenticated) navigation.replace('Welcome');
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
        <Text variant="callout" color="onPrimary" style={styles.tagline}>{t('welcome.tagline', 'Find your perfect match')}</Text>
      </View>
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
    marginTop: 12,
  },
});
