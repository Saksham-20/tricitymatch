import React, { useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { AccessibilityInfo, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { MainStackParamList, MainTabParamList, AdminStackParamList } from './types';
import { colours, tapTarget } from '@shared/constants/theme';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { TabIcon } from '../components/motion';
import { haptics } from '../utils/haptics';

// Tab Screens
import HomeScreen from '../features/home/HomeScreen';
import SearchScreen from '../features/search/SearchScreen';
import MatchesScreen from '../features/matches/MatchesScreen';
import ConversationsScreen from '../features/chat/ConversationsScreen';
import OwnProfileScreen from '../features/profile/OwnProfileScreen';

// Stack Screens
import ProfileDetailScreen from '../features/profile/ProfileDetailScreen';
import ChatThreadScreen from '../features/chat/ChatThreadScreen';
import VoiceCallScreen from '../features/calls/VoiceCallScreen';
import VideoCallScreen from '../features/calls/VideoCallScreen';
import SubscriptionScreen from '../features/subscription/SubscriptionScreen';
import EditProfileScreen from '../features/profile/EditProfileScreen';
import VerificationScreen from '../features/profile/VerificationScreen';
import SettingsScreen from '../features/profile/SettingsScreen';
import PrivacySettingsScreen from '../features/profile/PrivacySettingsScreen';
import AccountSecurityScreen from '../features/profile/AccountSecurityScreen';
import NotificationsScreen from '../features/notifications/NotificationsScreen';
import SupportScreen from '../features/profile/SupportScreen';
import SuccessStoryScreen from '../features/profile/SuccessStoryScreen';
import SuccessStoriesBrowseScreen from '../features/profile/SuccessStoriesBrowseScreen';
import QuizScreen from '../features/profile/QuizScreen';
import HoroscopeMatchScreen from '../features/profile/HoroscopeMatchScreen';

// Preferences journey (D6): the old onboarding Step2–12 run as a skippable
// modal group inside the Main stack, wrapped by OnboardingProvider.
import { OnboardingProvider } from '../features/onboarding/OnboardingContext';
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
import JourneyFinaleScreen from '../features/onboarding/JourneyFinaleScreen';

// Verification

// Static content / legal
import TermsScreen from '../features/legal/TermsScreen';
import PrivacyScreen from '../features/legal/PrivacyScreen';
import AboutScreen from '../features/legal/AboutScreen';
import SafetyScreen from '../features/legal/SafetyScreen';
import ContactScreen from '../features/legal/ContactScreen';

// Family group chat
import FamilyGroupsScreen from '../features/chat/FamilyGroupsScreen';
import FamilyGroupChatScreen from '../features/chat/FamilyGroupChatScreen';

// Guardian co-pilot
import GuardianSetupScreen from '../features/profile/GuardianSetupScreen';
import GuardianCandidatesScreen from '../features/profile/GuardianCandidatesScreen';
import GuardianViewScreen from '../features/profile/GuardianViewScreen';

// Admin
import AdminHomeScreen from '../features/admin/AdminHomeScreen';
import VerificationQueueScreen from '../features/admin/VerificationQueueScreen';
import ReportsQueueScreen from '../features/admin/ReportsQueueScreen';


// Astrologer marketplace (APP-059)
import AstrologerMarketplaceScreen from '../features/profile/AstrologerMarketplaceScreen';
import AstrologerDetailScreen from '../features/profile/AstrologerDetailScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  Home:    { active: 'home', inactive: 'home-outline' },
  Search:  { active: 'search', inactive: 'search-outline' },
  Matches: { active: 'heart', inactive: 'heart-outline' },
  Chat:    { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

function BottomTabs() {
  const { elderMode } = useUIStore();
  const { c } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const noAnimation = elderMode || reduceMotion;
  const tabBarHeight = elderMode ? 80 : 64;
  const tabBarLabelStyle = elderMode ? { fontSize: 14 } : {};

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { height: tabBarHeight },
        tabBarLabelStyle,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons.active : icons.inactive;
          // Elder mode: bigger icons + larger tap zone
          const iconSize = elderMode ? 28 : 22;
          return <TabIcon name={name} size={iconSize} color={color} focused={focused} />;
        },
        tabBarItemStyle: elderMode ? { minHeight: tapTarget.elder } : {},
        animation: noAnimation ? 'none' : 'shift',
      })}
      screenListeners={{ tabPress: () => haptics.light() }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} />
      {/* Chat tab hidden in elder mode — accessible via Profile → Chat or from match cards */}
      {!elderMode && <Tab.Screen name="Chat" component={ConversationsScreen} />}
      <Tab.Screen name="Profile" component={OwnProfileScreen} />
    </Tab.Navigator>
  );
}

function AdminNavigator() {
  return (
    <AdminStack.Navigator screenOptions={{ headerShown: false }}>
      <AdminStack.Screen name="AdminHome" component={AdminHomeScreen} />
      <AdminStack.Screen name="VerificationQueue" component={VerificationQueueScreen} />
      <AdminStack.Screen name="ReportsQueue" component={ReportsQueueScreen} />
    </AdminStack.Navigator>
  );
}

export default function MainNavigator() {
  const { elderMode } = useUIStore();
  const { user } = useAuthStore();
  const role = user?.role ?? 'user';
  const astrologerOn = user?.features?.astrologerMarketplace ?? false;
  // The provider sits ABOVE the Main stack, so its navigation handle is the
  // ROOT navigator's — journey routes must be addressed nested.
  const rootNavigation = useNavigation<any>();
  const navigateToStep = React.useCallback(
    (name: string) => rootNavigation.navigate('Main', { screen: name }),
    [rootNavigation],
  );

  return (
    <OnboardingProvider navigateToStep={navigateToStep}>
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // iOS keeps the native slide (interactive edge-swipe pop comes free);
        // Android's stock "default" is an abrupt fade-zoom — a consistent
        // slide-from-right reads as hierarchy on both platforms.
        animation: elderMode ? 'none' : Platform.OS === 'android' ? 'slide_from_right' : 'default',
      }}
    >
      <Stack.Screen name="MainTabs" component={BottomTabs} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
      <Stack.Screen
        name="VoiceCall"
        component={VoiceCallScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="VideoCall"
        component={VideoCallScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      {/* Sheet-like destinations rise as modals (handoff: sheets-as-screens). */}
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ presentation: 'modal', animation: elderMode ? 'none' : 'slide_from_bottom' }}
      />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="AccountSecurity" component={AccountSecurityScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen
        name="SuccessStory"
        component={SuccessStoryScreen}
        options={{ presentation: 'modal', animation: elderMode ? 'none' : 'slide_from_bottom' }}
      />
      <Stack.Screen name="SuccessStoriesBrowse" component={SuccessStoriesBrowseScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Quiz" component={QuizScreen} />

      {/* Static content / legal (store review requirement + web parity) */}
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Safety" component={SafetyScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />

      {/* Family group chat — all authenticated users */}
      <Stack.Screen name="FamilyGroups" component={FamilyGroupsScreen} />
      <Stack.Screen name="FamilyGroupChat" component={FamilyGroupChatScreen} />

      {/* Guardian co-pilot — all authenticated users */}
      <Stack.Screen name="GuardianSetup" component={GuardianSetupScreen} />
      <Stack.Screen name="GuardianCandidates" component={GuardianCandidatesScreen} />
      <Stack.Screen name="GuardianView" component={GuardianViewScreen} />

      {/* Horoscope match (APP-055) */}
      <Stack.Screen name="HoroscopeMatch" component={HoroscopeMatchScreen} />

      {/* Astrologer marketplace (APP-059) — D7: server-flagged, ships dark */}
      {astrologerOn && (
        <>
          <Stack.Screen name="AstrologerMarketplace" component={AstrologerMarketplaceScreen} />
          <Stack.Screen name="AstrologerDetail" component={AstrologerDetailScreen} />
        </>
      )}

      {/* Preferences journey (D6) — skippable, resumable; entered via
          HomeScreen auto-prompt or profile-completion CTAs */}
      <Stack.Group screenOptions={{ gestureEnabled: false, animation: elderMode ? 'none' : 'slide_from_bottom' }}>
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
        <Stack.Screen name="JourneyFinale" component={JourneyFinaleScreen} />
      </Stack.Group>

      {/* Role-gated: admin only */}
      {(role === 'admin' || role === 'super_admin') && (
        <Stack.Screen name="AdminStack" component={AdminNavigator} />
      )}
    </Stack.Navigator>
    </OnboardingProvider>
  );
}
