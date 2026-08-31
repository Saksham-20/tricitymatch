import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CallType } from '../types';

// Auth Stack
export type AuthStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  SignupBasics: { contactKind: 'email' | 'phone'; contactValue: string; password: string };
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  Terms: undefined;
  Privacy: undefined;
};

// Onboarding Stack — legacy-account gate only (D6: signup collects basics,
// preference steps live in the Main stack as the journey group)
export type OnboardingStackParamList = {
  CompleteBasics: undefined;
};

// Bottom Tabs
export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Matches: undefined;
  Chat: undefined;
  Profile: undefined;
};

// Admin Stack
export type AdminStackParamList = {
  AdminHome: undefined;
  VerificationQueue: undefined;
  ReportsQueue: undefined;
};

// Main Stack (wraps tabs + modals)
export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  ProfileDetail: { userId: string };
  ChatThread: { userId: string; name: string; photo?: string; draft?: string };
  VoiceCall: { callId?: string; channelName: string; calleeId: string };
  VideoCall: { callId?: string; channelName: string; calleeId: string; callType: CallType };
  EditProfile: undefined;
  Subscription: undefined;
  Verification: undefined;
  Settings: undefined;
  PrivacySettings: undefined;
  AccountSecurity: undefined;
  Notifications: undefined;
  SuccessStory: undefined;
  SuccessStoriesBrowse: undefined;
  Support: undefined;
  Quiz: undefined;
  // Preferences journey (D6) — skippable modal group reusing Step2–12
  Step2: undefined;
  Step3: undefined;
  Step4: undefined;
  Step5: undefined;
  Step6: undefined;
  Step7: undefined;
  Step8: undefined;
  Step9: undefined;
  Step10: undefined;
  Step11: undefined;
  Step12: undefined;
  JourneyFinale: undefined;
  // Static content / legal
  Terms: undefined;
  Privacy: undefined;
  About: undefined;
  Safety: undefined;
  Contact: undefined;
  // Family group chat
  FamilyGroups: undefined;
  FamilyGroupChat: { groupId: string; groupName: string; memberCount: number };
  // Guardian co-pilot
  GuardianSetup: undefined;
  GuardianCandidates: undefined;
  GuardianView: { candidateId: string; candidateName: string };
  // Admin
  AdminStack: NavigatorScreenParams<AdminStackParamList>;
  // Horoscope match (APP-055)
  HoroscopeMatch: { userId: string; name: string };
  // Astrologer marketplace (APP-059)
  AstrologerMarketplace: undefined;
  AstrologerDetail: { astrologerId: string; astrologerName: string };
};

// Root Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};
