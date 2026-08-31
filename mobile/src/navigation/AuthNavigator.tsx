import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';

// Placeholder screens
import SplashScreen from '../features/auth/SplashScreen';
import WelcomeScreen from '../features/auth/WelcomeScreen';
import LoginScreen from '../features/auth/LoginScreen';
import CreateAccountScreen from '../features/auth/CreateAccountScreen';
import BasicsScreen from '../features/auth/BasicsScreen';
import ForgotPasswordScreen from '../features/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../features/auth/ResetPasswordScreen';
import TermsScreen from '../features/legal/TermsScreen';
import PrivacyScreen from '../features/legal/PrivacyScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={CreateAccountScreen} />
      <Stack.Screen name="SignupBasics" component={BasicsScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      {/* Legal pages reachable from the signup consent checkbox (pre-auth) */}
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
    </Stack.Navigator>
  );
}
