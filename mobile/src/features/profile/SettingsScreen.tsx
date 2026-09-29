import React, { useState, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  AccessibilityInfo,
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ListRow from '../../components/ui/ListRow';
import PickerSheet from '../../components/ui/PickerSheet';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Screen from '../../components/layout/Screen';
import { useReduceTransparency } from '../../components/motion';
import { showToast } from '../../utils/toast';
import i18n from '../../i18n';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PLANS } from '@shared/constants/plans';
import { getMyProfile, updateMyProfile } from '../../api/profile';
import { getGuardianCandidates } from '../../api/guardian';
import { deleteAccount } from '../../api/auth';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import type { MainStackParamList } from '../../navigation/types';
import type { Profile } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// `incognitoMode` rides on the profile record but the shared Profile type does
// not declare it yet, so read it through this widened shape.
type ProfileWithIncognito = Profile & { incognitoMode?: boolean };

// Decorative glyphs sit beside a text label; the screen reader reads the label.
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

type Language = 'en' | 'hi' | 'pa';

const LANG_OPTIONS: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
];

// ─── Section ──────────────────────────────────────────────────────────────────

// No entrance choreography: Settings is a tens-per-day surface and the native push has already
// animated the whole screen in; a per-section rise on top of it is motion the member pays for
// every visit (doctrine frequency gate). StaggeredEntrance belongs on rare surfaces only.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  const sec = React.useMemo(() => makeSec(c), [c]);
  return (
    <View style={sec.container}>
      {/* textSecondary, not textMuted: a 12pt group label on the grey page fails AA in muted grey. */}
      <Text variant="caption" color="textSecondary" style={sec.title} accessibilityRole="header">{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  );
}

const makeSec = (c: ThemeColours) => StyleSheet.create({
  container: { marginBottom: spacing.xl },
  title:     { marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  card:      { backgroundColor: c.background, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border },
});

function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.border, marginLeft: 68 }} />;
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────
// The failure state lives INSIDE the modal: a toast renders in the root window,
// which an open <Modal> covers, so the member would see nothing at all.
//
// The server will not erase an account without the member's password
// (DELETE /auth/account -> `body('password').notEmpty()`), so the confirm step
// asks for it. Without it every tap of "Delete my account" came back 400.

/** Names the real reason the request failed instead of a blanket "check your connection". */
const deleteFailureMessage = (err: unknown): string => {
  const e = err as {
    retryAfter?: number;
    response?: { data?: { error?: { message?: string }; message?: string } };
  };
  // api/client rewrites a 429 into a plain Error carrying `retryAfter` (no `response`).
  if (e?.retryAfter) return 'Too many attempts. Wait a minute, then try again.';
  if (!e?.response) return 'Could not reach the server. Check your connection and try again.';
  return e.response.data?.error?.message ?? e.response.data?.message ?? 'Could not delete your account. Please try again.';
};

function DeleteModal({ visible, onClose, onConfirm, loading, error }: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const { c } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const dm = React.useMemo(() => makeDm(c), [c]);
  const [password, setPassword] = useState('');
  // Closing mid-request would orphan the mutation; the request decides the outcome.
  const close = () => { if (!loading) onClose(); };
  const canConfirm = password.length > 0 && !loading;
  const submit = () => { if (canConfirm) onConfirm(password); };

  // A closed modal must not keep the typed password around.
  useEffect(() => {
    if (!visible) setPassword('');
  }, [visible]);

  // The failure appears without a tap. Android reads the live region below; iOS
  // has none, so it is announced here (one channel per platform, never both).
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={dm.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[dm.backdrop, reduceTransparency && dm.backdropOpaque]}>
          {/* Scrolls so the card survives the keyboard, a longer hi/pa string and the largest OS text size. */}
          <ScrollView
            contentContainerStyle={dm.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={dm.card} testID="delete-account-modal" accessibilityViewIsModal>
              <Ionicons name="warning" size={40} color={c.error} {...HIDE_FROM_A11Y} />
              <Text variant="title3" color="textPrimary" accessibilityRole="header">Delete account</Text>
              <Text variant="footnote" color="textSecondary" style={dm.body}>
                This will permanently delete your profile, matches, and all data. This cannot be undone.
              </Text>
              <Input
                label="Confirm your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                secureToggle
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={submit}
                editable={!loading}
                containerStyle={dm.field}
                testID="delete-password"
                accessibilityLabel="Confirm your password"
              />
              {error ? (
                <Text
                  variant="footnote"
                  color="error"
                  style={dm.body}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                  testID="delete-account-error"
                >
                  {error}
                </Text>
              ) : null}
              <Button
                title="Delete my account"
                variant="danger"
                onPress={submit}
                loading={loading}
                disabled={!canConfirm}
                testID="delete-confirm-btn"
                accessibilityLabel="Confirm delete account"
                style={dm.action}
              />
              <Button
                title="Cancel"
                variant="text"
                haptic={false}
                onPress={close}
                disabled={loading}
                testID="delete-cancel-btn"
                style={dm.action}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeDm = (c: ThemeColours) => StyleSheet.create({
  flex:           { flex: 1 },
  backdrop:       { flex: 1, backgroundColor: c.scrim },
  // Reduce Transparency: a see-through scrim becomes a solid themed surface (doctrine 10.5).
  backdropOpaque: { backgroundColor: c.surface2 },
  scroll:         { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  // Elevation is the border alone: the card sits on a scrim, not on a shadow.
  card:           { backgroundColor: c.background, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: c.border, padding: spacing['2xl'], alignItems: 'center', gap: spacing.md, width: '100%' },
  body:           { textAlign: 'center' },
  field:          { width: '100%', marginBottom: 0 },
  action:         { width: '100%' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  // Individual selectors: subscribing to the whole store re-renders all ten
  // sections on any uiStore change (a sheet opening elsewhere, for one).
  const language = useUIStore((s) => s.language);
  const elderMode = useUIStore((s) => s.elderMode);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const setElderMode = useUIStore((s) => s.setElderMode);

  const [incognito, setIncognito] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // The switch must show what the server actually holds, not a hard-coded "off"
  // (a member with incognito already on used to see it off and turn it "on" again).
  const profileQuery = useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: getMyProfile,
    staleTime: 60 * 1000,
  });
  const myProfile = profileQuery.data;
  // Until the server has answered, the switch would be showing a guess: a member
  // with incognito ON would see it OFF on a privacy setting.
  const incognitoKnown = myProfile !== undefined;
  const serverIncognito = (myProfile as ProfileWithIncognito | undefined)?.incognitoMode;
  useEffect(() => {
    if (typeof serverIncognito === 'boolean') setIncognito(serverIncognito);
  }, [serverIncognito]);

  // Optimistic: the switch moves on the tap, not after the round trip, and
  // snaps back (with a message) if the server refuses.
  const incognitoMutation = useMutation({
    mutationFn: (val: boolean) => updateMyProfile({ incognitoMode: val } as any),
    onMutate: (val) => setIncognito(val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    },
    onError: (_err, val) => {
      setIncognito(!val);
      showToast.error('Could not update', 'Incognito mode was not changed.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (password: string) => deleteAccount(password),
    onSuccess: async () => {
      setShowDeleteModal(false);
      await logout();
    },
    // No toast: the failure is shown inside the (still open) confirm modal.
  });

  // The guardian dashboard is only useful to someone a member has invited as
  // their guardian; for everyone else it was an empty screen. Same query the
  // dashboard itself runs, so opening it afterwards is instant.
  const { data: guardianLinks } = useQuery({
    queryKey: queryKeys.guardianCandidates,
    queryFn: getGuardianCandidates,
    staleTime: 2 * 60 * 1000,
  });
  const isGuardian = guardianLinks?.some((l) => l.status === 'active') ?? false;

  const handleLanguage = (lang: Language) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const currentLangLabel = LANG_OPTIONS.find((l) => l.code === language)?.native ?? 'English';

  const planLabel = user?.subscriptionPlan
    ? (PLANS[user.subscriptionPlan]?.label ?? user.subscriptionPlan.replace(/_/g, ' '))
    : null;

  return (
    <Screen edges={['top', 'bottom']} style={s.wrapper} testID="SettingsScreen">
      <ScreenHeader title="Settings" testID="settings-header" />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Account */}
        <Section title="Account">
          <ListRow
            icon="person-outline"
            label="Edit profile"
            onPress={() => navigation.navigate('EditProfile')}
            testID="setting-edit-profile"
          />
          <Divider />
          <ListRow
            icon="shield-checkmark-outline"
            label="Verification"
            sublabel="Get your photo-verified badge"
            onPress={() => navigation.navigate('Verification')}
            testID="setting-verification"
          />
          <Divider />
          <ListRow
            icon="card-outline"
            iconColor={c.secondary}
            label="Subscription"
            sublabel={planLabel ? `Current: ${planLabel}` : undefined}
            onPress={() => navigation.navigate('Subscription')}
            testID="setting-subscription"
          />
          {/* No Face ID / Touch ID row: sign-in by biometric never worked (a signed-out
              device has no stored session to exchange), so a switch for it only promised
              something the app could not do. */}
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          {incognitoKnown ? (
            <ListRow
              icon="eye-off-outline"
              iconColor={c.primary}
              label="Incognito mode"
              sublabel="Browse profiles without being seen"
              switchValue={incognito}
              onSwitchChange={(v) => incognitoMutation.mutate(v)}
              testID="setting-incognito"
            />
          ) : profileQuery.isError ? (
            // No switch: showing "off" for a value we could not read is a false statement.
            <ListRow
              icon="eye-off-outline"
              iconColor={c.primary}
              label="Incognito mode"
              sublabel="Could not load this setting. Tap to retry."
              onPress={() => profileQuery.refetch()}
              testID="setting-incognito-retry"
            />
          ) : (
            <ListRow
              icon="eye-off-outline"
              iconColor={c.primary}
              label="Incognito mode"
              sublabel="Loading your setting"
              testID="setting-incognito-loading"
            />
          )}
          <Divider />
          <ListRow
            icon="lock-closed-outline"
            iconColor={c.primary}
            label="Privacy controls"
            sublabel="Profile visibility, online status and last seen"
            onPress={() => navigation.navigate('PrivacySettings')}
            testID="setting-privacy-controls"
          />
          <Divider />
          <ListRow
            icon="key-outline"
            iconColor={c.primary}
            label="Account security"
            sublabel="Change password and signed-in devices"
            onPress={() => navigation.navigate('AccountSecurity')}
            testID="setting-account-security"
          />
          <Divider />
          <ListRow
            icon="download-outline"
            iconColor={c.primary}
            label="Download my data"
            sublabel="Get a copy of everything we hold about you, on the website"
            onPress={() => { Linking.openURL('https://tricitymatch.com/settings').catch(() => {}); }}
            testID="setting-download-data"
          />
        </Section>

        {/* Appearance — there is no in-app dark-mode switch on purpose: the app
            follows the system light/dark setting (useTheme reads it live). */}
        <Section title="Appearance">
          <ListRow
            icon="text-outline"
            iconColor={c.primary}
            label="Elder mode"
            sublabel="Larger text and simplified navigation"
            switchValue={elderMode}
            onSwitchChange={setElderMode}
            testID="setting-elder-mode"
          />
          <Divider />
          <ListRow
            icon="language-outline"
            iconColor={c.primary}
            label="Language"
            value={currentLangLabel}
            onPress={() => setShowLangPicker(true)}
            testID="setting-language"
          />
        </Section>

        {/* Family & Guardian */}
        <Section title="Family">
          <ListRow
            icon="people-outline"
            iconColor={c.primary}
            label="Family chat"
            sublabel="Private group chat with your family"
            onPress={() => navigation.navigate('FamilyGroups')}
            testID="setting-family-chat"
          />
          <Divider />
          <ListRow
            icon="shield-half-outline"
            iconColor={c.primary}
            label="Guardian co-pilot"
            sublabel="Let a parent or guardian browse your matches"
            onPress={() => navigation.navigate('GuardianSetup')}
            testID="setting-guardian-setup"
          />
          {/* Only for a member someone has invited as their guardian. */}
          {isGuardian ? (
            <>
              <Divider />
              <ListRow
                icon="eye-outline"
                iconColor={c.primary}
                label="Guardian dashboard"
                sublabel="Browse matches for someone who invited you"
                onPress={() => navigation.navigate('GuardianCandidates')}
                testID="setting-guardian-dashboard"
              />
            </>
          ) : null}
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <ListRow
            icon="notifications-outline"
            label="Notifications"
            sublabel="View your matches, messages and alerts"
            onPress={() => navigation.navigate('Notifications')}
            testID="setting-notifications"
          />
        </Section>

        {/* Role-specific sections */}
        {(user?.role === 'admin' || user?.role === 'super_admin') && (
          <Section title="Administration">
            <ListRow
              icon="shield-outline"
              iconColor={c.error}
              label="Admin panel"
              sublabel="Verify users, review reports"
              onPress={() => navigation.navigate('AdminStack', { screen: 'AdminHome' })}
              testID="setting-admin-panel"
            />
          </Section>
        )}

        {/* Support */}
        <Section title="Support">
          <ListRow
            icon="help-circle-outline"
            iconColor={c.textSecondary}
            label="Help and support"
            onPress={() => navigation.navigate('Support')}
            testID="setting-support"
          />
          <Divider />
          <ListRow
            icon="heart-outline"
            iconColor={c.primary}
            label="Success stories"
            sublabel="Read couples who found their match"
            onPress={() => navigation.navigate('SuccessStoriesBrowse')}
            testID="setting-success-stories-browse"
          />
          <Divider />
          <ListRow
            icon="star-outline"
            iconColor={c.primary}
            label="Share your story"
            sublabel="Found your match? Tell your story."
            onPress={() => navigation.navigate('SuccessStory')}
            testID="setting-success-story"
          />
          {user?.features?.astrologerMarketplace && (
            <>
              <Divider />
              <ListRow
                icon="moon-outline"
                iconColor={c.primary}
                label="Astrologer consult"
                sublabel="Get expert Vedic guidance for your match"
                onPress={() => navigation.navigate('AstrologerMarketplace')}
                testID="setting-astrologer"
              />
            </>
          )}
        </Section>

        {/* About & Legal */}
        <Section title="About and legal">
          <ListRow
            icon="information-circle-outline"
            iconColor={c.textSecondary}
            label="About TricityMatch"
            onPress={() => navigation.navigate('About')}
            testID="setting-about"
          />
          <Divider />
          <ListRow
            icon="shield-checkmark-outline"
            iconColor={c.textSecondary}
            label="Safety and trust"
            onPress={() => navigation.navigate('Safety')}
            testID="setting-safety"
          />
          <Divider />
          <ListRow
            icon="mail-outline"
            iconColor={c.textSecondary}
            label="Contact us"
            onPress={() => navigation.navigate('Contact')}
            testID="setting-contact"
          />
          <Divider />
          <ListRow
            icon="document-text-outline"
            iconColor={c.textSecondary}
            label="Terms of Service"
            onPress={() => navigation.navigate('Terms')}
            testID="setting-terms"
          />
          <Divider />
          <ListRow
            icon="lock-closed-outline"
            iconColor={c.textSecondary}
            label="Privacy policy"
            onPress={() => navigation.navigate('Privacy')}
            testID="setting-privacy-policy"
          />
        </Section>

        {/* Danger zone */}
        <Section title="Account actions">
          <ListRow
            icon="log-out-outline"
            iconColor={c.warning}
            label="Log out"
            // Ends the session, so it asks first (ruling 22: a confirmation, not an error channel).
            onPress={() =>
              Alert.alert('Log out?', 'You will need to sign in again.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => logout() },
              ])
            }
            testID="setting-logout"
          />
          <Divider />
          <ListRow
            icon="trash-outline"
            iconColor={c.error}
            label="Delete account"
            sublabel="Permanently remove all your data"
            destructive
            onPress={() => setShowDeleteModal(true)}
            testID="setting-delete-account"
          />
        </Section>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <PickerSheet<Language>
        visible={showLangPicker}
        title="Select language"
        options={LANG_OPTIONS.map((o) => ({
          value: o.code,
          label: o.native === o.label ? o.label : `${o.native} · ${o.label}`,
        }))}
        selected={language}
        onSelect={(v) => handleLanguage(v as Language)}
        onClose={() => setShowLangPicker(false)}
      />

      <DeleteModal
        visible={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); deleteMutation.reset(); }}
        onConfirm={(password) => deleteMutation.mutate(password)}
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? deleteFailureMessage(deleteMutation.error) : null}
      />
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  // Grouped-list look: the page sits on surfaceCard, each section card on background.
  wrapper:  { backgroundColor: c.surfaceCard },
});
