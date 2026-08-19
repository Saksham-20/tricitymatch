import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from './types';

import CompleteBasicsScreen from '../features/onboarding/CompleteBasicsScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * Legacy-account gate (D6). New signups collect the basics in the Auth stack
 * and land on Main directly; only accounts with onboardingComplete=false
 * (pre-door signups, or web accounts missing basics) pass through here.
 */
export default function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="CompleteBasics" component={CompleteBasicsScreen} />
    </Stack.Navigator>
  );
}
