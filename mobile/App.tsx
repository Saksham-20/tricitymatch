import './src/i18n';

import React from 'react';
import { View, ActivityIndicator, StatusBar, useColorScheme } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { queryClient } from './src/constants/queryClient';
import RootNavigator from './src/navigation/RootNavigator';
import { colours } from '@shared/constants/theme';
import { useUIStore } from './src/stores/uiStore';

// Brand-aware status bar: dark icons on light content, light icons in dark mode.
// Replaces the off-brand rose (#E11D48) status bar baked into the native Android theme.
function AppStatusBar() {
  const override = useUIStore((s) => s.darkModeOverride);
  const system = useColorScheme();
  const isDark = override === null ? system === 'dark' : override;
  return (
    <StatusBar
      barStyle={isDark ? 'light-content' : 'dark-content'}
      backgroundColor={isDark ? '#0F1117' : colours.background}
      translucent={false}
    />
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'PlayfairDisplay-Regular': PlayfairDisplay_400Regular,
    'PlayfairDisplay-Italic': PlayfairDisplay_400Regular_Italic,
    'PlayfairDisplay-Bold': PlayfairDisplay_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.background }}>
        <ActivityIndicator size="large" color={colours.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStatusBar />
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
