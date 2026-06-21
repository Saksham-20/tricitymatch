import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  useColorScheme,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { cache, CACHE_KEYS } from '../../utils/cache';
import { updateMyProfile } from '../../api/profile';
import { deleteAccount } from '../../api/auth';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type Language = 'en' | 'hi' | 'pa';

const LANG_OPTIONS: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
];

// ─── Setting Row ──────────────────────────────────────────────────────────────

interface SettingRowProps {
  icon: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  value?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
}

function SettingRow({
  icon, iconColor, label, sublabel, value,
  toggle, toggleValue, onToggle, onPress, destructive, testID,
}: SettingRowProps) {
  return (
    <TouchableOpacity
      style={sr.row}
      onPress={onPress}
      disabled={!onPress && !toggle}
      testID={testID ?? `setting-row-${label}`}
      accessibilityLabel={label}
      accessibilityRole={toggle ? 'switch' : onPress ? 'button' : 'none'}
    >
      <View style={[sr.iconWrap, { backgroundColor: (iconColor ?? colours.primary) + '15' }]}>
        <Ionicons name={icon as any} size={18} color={iconColor ?? colours.primary} />
      </View>
      <View style={sr.info}>
        <Text style={[sr.label, destructive && { color: colours.error }]}>{label}</Text>
        {sublabel ? <Text style={sr.sub}>{sublabel}</Text> : null}
      </View>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: colours.border, true: colours.primary + '80' }}
          thumbColor={toggleValue ? colours.primary : colours.textMuted}
          testID={`${testID ?? label}-switch`}
        />
      ) : value ? (
        <Text style={sr.value}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colours.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
}

const sr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colours.background, minHeight: 56 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  info:    { flex: 1 },
  label:   { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.medium, color: colours.textPrimary },
  sub:     { fontSize: typography.fontSize.xs, color: colours.textSecondary, marginTop: 2 },
  value:   { fontSize: typography.fontSize.sm, color: colours.textSecondary, fontFamily: typography.fontFamily.regular },
});

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sec.container}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  );
}

const sec = StyleSheet.create({
  container: { marginBottom: spacing.xl },
  title:     { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold, color: colours.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  card:      { backgroundColor: colours.background, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colours.border },
});

function Divider() {
  return <View style={{ height: 1, backgroundColor: colours.border, marginLeft: 68 }} />;
}

// ─── Language Picker Modal ─────────────────────────────────────────────────────

function LanguagePicker({ visible, current, onSelect, onClose }: {
  visible: boolean;
  current: Language;
  onSelect: (lang: Language) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={lp.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={lp.sheet} testID="language-picker">
          <View style={lp.handle} />
          <Text style={lp.heading}>Select Language</Text>
          {LANG_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.code}
              style={lp.option}
              onPress={() => { onSelect(opt.code); onClose(); }}
              testID={`lang-option-${opt.code}`}
              accessibilityLabel={opt.label}
            >
              <Text style={lp.optionMain}>{opt.native}</Text>
              <Text style={lp.optionSub}>{opt.label}</Text>
              {opt.code === current && (
                <Ionicons name="checkmark" size={20} color={colours.primary} style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const lp = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: colours.background, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.xl, paddingBottom: spacing['3xl'] },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: colours.border, alignSelf: 'center', marginBottom: spacing.lg },
  heading:    { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginBottom: spacing.lg },
  option:     { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colours.border, gap: spacing.md },
  optionMain: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  optionSub:  { fontSize: typography.fontSize.sm, color: colours.textSecondary, marginLeft: spacing.sm },
});

// ─── Delete Account Modal ─────────────────────────────────────────────────────

function DeleteModal({ visible, onClose, onConfirm, loading }: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dm.backdrop}>
        <View style={dm.card} testID="delete-account-modal">
          <Ionicons name="warning" size={40} color={colours.error} />
          <Text style={dm.title}>Delete Account</Text>
          <Text style={dm.body}>
            This will permanently delete your profile, matches, and all data. This cannot be undone.
          </Text>
          <TouchableOpacity
            style={dm.confirmBtn}
            onPress={onConfirm}
            disabled={loading}
            testID="delete-confirm-btn"
            accessibilityLabel="Confirm delete account"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={dm.confirmText}>Delete My Account</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={dm.cancelBtn} onPress={onClose} testID="delete-cancel-btn">
            <Text style={dm.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const dm = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card:        { backgroundColor: colours.background, borderRadius: borderRadius.xl, padding: spacing['2xl'], alignItems: 'center', gap: spacing.md, width: '100%' },
  title:       { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  body:        { fontSize: typography.fontSize.sm, color: colours.textSecondary, textAlign: 'center', lineHeight: 22 },
  confirmBtn:  { backgroundColor: colours.error, borderRadius: borderRadius.md, paddingVertical: spacing.md, width: '100%', alignItems: 'center', marginTop: spacing.sm },
  confirmText: { color: '#fff', fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.base },
  cancelBtn:   { paddingVertical: spacing.sm, width: '100%', alignItems: 'center' },
  cancelText:  { color: colours.textSecondary, fontSize: typography.fontSize.base },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { language, elderMode, darkModeOverride, setLanguage, setElderMode, setDarkModeOverride } = useUIStore();
  const systemScheme = useColorScheme();
  const isDark = darkModeOverride !== null ? darkModeOverride : systemScheme === 'dark';

  const [incognito, setIncognito] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const available = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(available && enrolled);
        setBiometricEnabled(cache.getBoolean(CACHE_KEYS.BIOMETRIC_ENABLED) ?? false);
      } catch {
        setBiometricAvailable(false);
      }
    })();
  }, []);

  const incognitoMutation = useMutation({
    mutationFn: (val: boolean) => updateMyProfile({ incognitoMode: val } as any),
    onSuccess: (_, val) => {
      setIncognito(val);
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: () => Alert.alert('Error', 'Could not update incognito mode.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      setShowDeleteModal(false);
      await logout();
    },
    onError: () => Alert.alert('Error', 'Could not delete account. Please try again.'),
  });

  const handleBiometricToggle = (val: boolean) => {
    cache.setBoolean(CACHE_KEYS.BIOMETRIC_ENABLED, val);
    setBiometricEnabled(val);
  };

  const handleLanguage = (lang: Language) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const currentLangLabel = LANG_OPTIONS.find((l) => l.code === language)?.native ?? 'English';

  return (
    <SafeAreaView style={s.wrapper} testID="SettingsScreen">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} testID="back-btn" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Account */}
        <Section title="Account">
          <SettingRow
            icon="person-outline"
            label="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
            testID="setting-edit-profile"
          />
          <Divider />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Verification"
            sublabel="Verify your ID, education & income"
            onPress={() => navigation.navigate('Verification')}
            testID="setting-verification"
          />
          <Divider />
          <SettingRow
            icon="card-outline"
            label="Subscription"
            sublabel={user?.subscriptionPlan ? `Current: ${user.subscriptionPlan.replace('_', ' ')}` : undefined}
            onPress={() => navigation.navigate('Subscription')}
            testID="setting-subscription"
          />
          {biometricAvailable && (
            <>
              <Divider />
              <SettingRow
                icon="finger-print-outline"
                label="Face ID / Touch ID"
                sublabel="Sign in without typing your password"
                toggle
                toggleValue={biometricEnabled}
                onToggle={handleBiometricToggle}
                testID="setting-biometric"
              />
            </>
          )}
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          <SettingRow
            icon="eye-off-outline"
            iconColor={colours.secondary}
            label="Incognito Mode"
            sublabel="Browse profiles without being seen"
            toggle
            toggleValue={incognito}
            onToggle={(v) => incognitoMutation.mutate(v)}
            testID="setting-incognito"
          />
          <Divider />
          <SettingRow
            icon="lock-closed-outline"
            iconColor={colours.secondary}
            label="Privacy Controls"
            sublabel="Profile visibility, online status & last seen"
            onPress={() => navigation.navigate('PrivacySettings')}
            testID="setting-privacy-controls"
          />
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <SettingRow
            icon="moon-outline"
            iconColor={colours.info}
            label="Dark Mode"
            sublabel={darkModeOverride === null ? 'Following system setting' : undefined}
            toggle
            toggleValue={isDark}
            onToggle={(v) => setDarkModeOverride(v)}
            testID="setting-dark-mode"
          />
          <Divider />
          <SettingRow
            icon="text-outline"
            iconColor={colours.info}
            label="Elder Mode"
            sublabel="Larger text and simplified navigation"
            toggle
            toggleValue={elderMode}
            onToggle={setElderMode}
            testID="setting-elder-mode"
          />
          <Divider />
          <SettingRow
            icon="language-outline"
            iconColor={colours.info}
            label="Language"
            value={currentLangLabel}
            onPress={() => setShowLangPicker(true)}
            testID="setting-language"
          />
        </Section>

        {/* Family & Guardian */}
        <Section title="Family">
          <SettingRow
            icon="people-outline"
            iconColor={colours.secondary}
            label="Family Chat"
            sublabel="Private group chat with your family"
            onPress={() => navigation.navigate('FamilyGroups')}
            testID="setting-family-chat"
          />
          <Divider />
          <SettingRow
            icon="shield-half-outline"
            iconColor={colours.secondary}
            label="Guardian Co-Pilot"
            sublabel="Let a parent or guardian browse your matches"
            onPress={() => navigation.navigate('GuardianSetup')}
            testID="setting-guardian-setup"
          />
          {/* Show guardian dashboard if this user is acting as a guardian */}
          <Divider />
          <SettingRow
            icon="eye-outline"
            iconColor={colours.secondary}
            label="Guardian Dashboard"
            sublabel="Browse matches for someone who invited you"
            onPress={() => navigation.navigate('GuardianCandidates')}
            testID="setting-guardian-dashboard"
          />
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <SettingRow
            icon="notifications-outline"
            label="Notification Preferences"
            sublabel="Manage which alerts you receive"
            onPress={() => navigation.navigate('Notifications')}
            testID="setting-notifications"
          />
        </Section>

        {/* Role-specific sections */}
        {(user?.role === 'admin' || user?.role === 'super_admin') && (
          <Section title="Administration">
            <SettingRow
              icon="shield-outline"
              iconColor={colours.error}
              label="Admin Panel"
              sublabel="Verify users, review reports"
              onPress={() => navigation.navigate('AdminStack', { screen: 'AdminHome' })}
              testID="setting-admin-panel"
            />
          </Section>
        )}

        {user?.role === 'bureau' && (
          <Section title="Bureau">
            <SettingRow
              icon="briefcase-outline"
              iconColor={colours.primary}
              label="Bureau Dashboard"
              sublabel="Manage clients and proposals"
              onPress={() => navigation.navigate('BureauStack', { screen: 'BureauHome' })}
              testID="setting-bureau-panel"
            />
          </Section>
        )}

        {/* Support */}
        <Section title="Support">
          <SettingRow
            icon="help-circle-outline"
            iconColor={colours.textSecondary}
            label="Help & Support"
            onPress={() => navigation.navigate('Support')}
            testID="setting-support"
          />
          <Divider />
          <SettingRow
            icon="heart-outline"
            iconColor={colours.secondary}
            label="Success Stories"
            sublabel="Read couples who found their match"
            onPress={() => navigation.navigate('SuccessStoriesBrowse')}
            testID="setting-success-stories-browse"
          />
          <Divider />
          <SettingRow
            icon="star-outline"
            iconColor={colours.secondary}
            label="Share Your Story"
            sublabel="Found your match? Inspire others!"
            onPress={() => navigation.navigate('SuccessStory')}
            testID="setting-success-story"
          />
          <Divider />
          <SettingRow
            icon="moon-outline"
            iconColor={colours.secondary}
            label="Astrologer Consult"
            sublabel="Get expert Vedic guidance for your match"
            onPress={() => navigation.navigate('AstrologerMarketplace')}
            testID="setting-astrologer"
          />
        </Section>

        {/* Danger zone */}
        <Section title="Account Actions">
          <SettingRow
            icon="log-out-outline"
            iconColor={colours.warning}
            label="Log Out"
            onPress={() =>
              Alert.alert('Log Out', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log Out', style: 'destructive', onPress: () => logout() },
              ])
            }
            testID="setting-logout"
          />
          <Divider />
          <SettingRow
            icon="trash-outline"
            iconColor={colours.error}
            label="Delete Account"
            sublabel="Permanently remove all your data"
            destructive
            onPress={() => setShowDeleteModal(true)}
            testID="setting-delete-account"
          />
        </Section>

        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>

      <LanguagePicker
        visible={showLangPicker}
        current={language as Language}
        onSelect={handleLanguage}
        onClose={() => setShowLangPicker(false)}
      />

      <DeleteModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrapper:  { flex: 1, backgroundColor: colours.surfaceCard },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colours.background, borderBottomWidth: 1, borderBottomColor: colours.border },
  backBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
});
