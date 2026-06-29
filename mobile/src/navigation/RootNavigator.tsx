import React, { useEffect } from 'react';
import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { NavigationContainer, LinkingOptions, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useCallStore } from '../stores/callStore';
import { colours, darkColours } from '@shared/constants/theme';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import IncomingCallModal from '../components/calls/IncomingCallModal';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['tricityshadi://', 'https://tricityshadi.com'],
  config: {
    screens: {
      Main: {
        screens: {
          MainTabs: {
            screens: {
              Home: 'home',
              Search: 'search',
              Matches: 'matches',
              Chat: 'chat',
              Profile: 'profile',
            },
          },
          ProfileDetail: 'profile/:userId',
        },
      },
      Auth: {
        screens: {
          ResetPassword: 'reset-password',
        },
      },
    },
  },
};

export default function RootNavigator() {
  const { isLoading, isAuthenticated, user, initialize } = useAuthStore();
  const { initFromCache, darkModeOverride } = useUIStore();
  const { incomingCall } = useCallStore();
  const systemScheme = useColorScheme();

  useEffect(() => {
    initFromCache();
    initialize();
  }, []);

  const isDark = darkModeOverride !== null ? darkModeOverride : systemScheme === 'dark';
  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: darkColours.background, card: darkColours.surfaceCard, border: darkColours.border, text: darkColours.textPrimary } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colours.background, card: colours.surfaceCard, border: colours.border, text: colours.textPrimary } };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.primary }}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  // The backend now returns `onboardingComplete` (keyed off firstName, since
  // gender/DOB carry NOT-NULL placeholder defaults at signup). Honour that flag;
  // fall back to a firstName check only if an older flagless response arrives.
  const onboardingComplete =
    user?.onboardingComplete ??
    Boolean(user?.Profile?.firstName && user?.Profile?.gender && user?.Profile?.dateOfBirth);

  return (
    <NavigationContainer linking={linking} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !onboardingComplete ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>

      {/* Foreground incoming call overlay — shown globally on top of any screen */}
      {isAuthenticated && incomingCall && (
        <IncomingCallModal invitation={incomingCall} />
      )}
    </NavigationContainer>
  );
}
