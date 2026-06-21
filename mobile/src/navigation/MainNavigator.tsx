import React, { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { MainStackParamList, MainTabParamList, AdminStackParamList, BureauStackParamList } from './types';
import { colours, tapTarget } from '@shared/constants/theme';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';

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
import NotificationsScreen from '../features/notifications/NotificationsScreen';
import SupportScreen from '../features/profile/SupportScreen';
import SuccessStoryScreen from '../features/profile/SuccessStoryScreen';
import SuccessStoriesBrowseScreen from '../features/profile/SuccessStoriesBrowseScreen';
import QuizScreen from '../features/profile/QuizScreen';
import HoroscopeMatchScreen from '../features/profile/HoroscopeMatchScreen';

// Verification
import SelfieVerificationScreen from '../features/profile/SelfieVerificationScreen';

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

// Bureau
import BureauHomeScreen from '../features/bureau/BureauHomeScreen';
import ClientRosterScreen from '../features/bureau/ClientRosterScreen';
import MatchProposalScreen from '../features/bureau/MatchProposalScreen';
import EarningsScreen from '../features/bureau/EarningsScreen';

// Astrologer marketplace (APP-059)
import AstrologerMarketplaceScreen from '../features/profile/AstrologerMarketplaceScreen';
import AstrologerDetailScreen from '../features/profile/AstrologerDetailScreen';
import BackgroundCheckScreen from '../features/profile/BackgroundCheckScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();
const BureauStack = createNativeStackNavigator<BureauStackParamList>();

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
        tabBarActiveTintColor: colours.primary,
        tabBarInactiveTintColor: colours.textMuted,
        tabBarStyle: { height: tabBarHeight },
        tabBarLabelStyle,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons.active : icons.inactive;
          // Elder mode: bigger icons + larger tap zone
          const iconSize = elderMode ? 28 : 22;
          return <Ionicons name={name} size={iconSize} color={color} />;
        },
        tabBarItemStyle: elderMode ? { minHeight: tapTarget.elder } : {},
        animation: noAnimation ? 'none' : 'shift',
      })}
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

function BureauNavigator() {
  return (
    <BureauStack.Navigator screenOptions={{ headerShown: false }}>
      <BureauStack.Screen name="BureauHome" component={BureauHomeScreen} />
      <BureauStack.Screen name="ClientRoster" component={ClientRosterScreen} />
      <BureauStack.Screen name="MatchProposal" component={MatchProposalScreen} />
      <BureauStack.Screen name="Earnings" component={EarningsScreen} />
    </BureauStack.Navigator>
  );
}

export default function MainNavigator() {
  const { elderMode } = useUIStore();
  const { user } = useAuthStore();
  const role = user?.role ?? 'user';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: elderMode ? 'none' : 'default' }}>
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
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="SelfieVerification" component={SelfieVerificationScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="SuccessStory" component={SuccessStoryScreen} />
      <Stack.Screen name="SuccessStoriesBrowse" component={SuccessStoriesBrowseScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Quiz" component={QuizScreen} />

      {/* Family group chat — all authenticated users */}
      <Stack.Screen name="FamilyGroups" component={FamilyGroupsScreen} />
      <Stack.Screen name="FamilyGroupChat" component={FamilyGroupChatScreen} />

      {/* Guardian co-pilot — all authenticated users */}
      <Stack.Screen name="GuardianSetup" component={GuardianSetupScreen} />
      <Stack.Screen name="GuardianCandidates" component={GuardianCandidatesScreen} />
      <Stack.Screen name="GuardianView" component={GuardianViewScreen} />

      {/* Horoscope match (APP-055) */}
      <Stack.Screen name="HoroscopeMatch" component={HoroscopeMatchScreen} />

      {/* Astrologer marketplace (APP-059) */}
      <Stack.Screen name="AstrologerMarketplace" component={AstrologerMarketplaceScreen} />
      <Stack.Screen name="AstrologerDetail" component={AstrologerDetailScreen} />

      {/* Background check (APP-060) */}
      <Stack.Screen name="BackgroundCheck" component={BackgroundCheckScreen} />

      {/* Role-gated: admin only */}
      {(role === 'admin' || role === 'super_admin') && (
        <Stack.Screen name="AdminStack" component={AdminNavigator} />
      )}

      {/* Role-gated: bureau only */}
      {role === 'bureau' && (
        <Stack.Screen name="BureauStack" component={BureauNavigator} />
      )}
    </Stack.Navigator>
  );
}
