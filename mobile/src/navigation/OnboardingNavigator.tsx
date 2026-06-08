import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from './types';
import { OnboardingProvider } from '../features/onboarding/OnboardingContext';

import Step0Screen from '../features/onboarding/Step0Screen';
import Step1Screen from '../features/onboarding/Step1Screen';
import Step2Screen from '../features/onboarding/Step2Screen';
import Step3Screen from '../features/onboarding/Step3Screen';
import Step4Screen from '../features/onboarding/Step4Screen';
import Step5Screen from '../features/onboarding/Step5Screen';
import Step6Screen from '../features/onboarding/Step6Screen';
import Step7Screen from '../features/onboarding/Step7Screen';
import Step8Screen from '../features/onboarding/Step8Screen';
import Step9Screen from '../features/onboarding/Step9Screen';
import Step10Screen from '../features/onboarding/Step10Screen';
import Step11Screen from '../features/onboarding/Step11Screen';
import Step12Screen from '../features/onboarding/Step12Screen';
import Step13Screen from '../features/onboarding/Step13Screen';
import Step14Screen from '../features/onboarding/Step14Screen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  return (
    <OnboardingProvider>
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="Step0" component={Step0Screen} />
      <Stack.Screen name="Step1" component={Step1Screen} />
      <Stack.Screen name="Step2" component={Step2Screen} />
      <Stack.Screen name="Step3" component={Step3Screen} />
      <Stack.Screen name="Step4" component={Step4Screen} />
      <Stack.Screen name="Step5" component={Step5Screen} />
      <Stack.Screen name="Step6" component={Step6Screen} />
      <Stack.Screen name="Step7" component={Step7Screen} />
      <Stack.Screen name="Step8" component={Step8Screen} />
      <Stack.Screen name="Step9" component={Step9Screen} />
      <Stack.Screen name="Step10" component={Step10Screen} />
      <Stack.Screen name="Step11" component={Step11Screen} />
      <Stack.Screen name="Step12" component={Step12Screen} />
      <Stack.Screen name="Step13" component={Step13Screen} />
      <Stack.Screen name="Step14" component={Step14Screen} />
    </Stack.Navigator>
    </OnboardingProvider>
  );
}
