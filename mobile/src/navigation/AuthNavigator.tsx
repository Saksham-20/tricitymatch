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
    </Stack.Navigator>
  );
}
