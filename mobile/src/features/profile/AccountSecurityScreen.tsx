import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { AccessibilityInfo, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing, type ThemeColours } from '@shared/constants/theme';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PasswordStrength,
  ScreenHeader,
  SkeletonRow,
} from '../../components/ui';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { changePassword, getSessions, logoutAll, revokeSession, type AuthSession } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { showToast } from '../../utils/toast';
import { PASSWORD_RULES_ATTR, passwordProblem } from '../../utils/passwordRule';

// Decorative glyphs sit beside a text label; the screen reader reads the label.
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/**
 * Account security — change password and see where the account is signed in.
 *
 * Both endpoints have shipped on the server for months with no client on this
 * platform, so a member could see their sessions on the website and not on the
 * phone that created most of them.
 */

const apiMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
  return data?.error?.message ?? data?.message ?? fallback;
};

/**
 * A user agent is not a device name. Rather than parse it into a false
 * precision ("iPhone 14 Pro"), name the platform and keep the raw string
 * available underneath — enough to recognise a session, honest about the rest.
 */
const deviceLabel = (ua: string | null): { label: string; icon: keyof typeof Ionicons.glyphMap } => {
  const ua2 = (ua ?? '').toLowerCase();
  if (!ua2) return { label: 'Unknown device', icon: 'help-circle-outline' };
  if (ua2.includes('tricitymatch') || ua2.includes('okhttp') || ua2.includes('expo')) {
    return { label: 'TricityMatch app', icon: 'phone-portrait-outline' };
  }
  if (ua2.includes('android')) return { label: 'Android device', icon: 'phone-portrait-outline' };
  if (ua2.includes('iphone')) return { label: 'iPhone', icon: 'phone-portrait-outline' };
  if (ua2.includes('ipad')) return { label: 'iPad', icon: 'tablet-portrait-outline' };
  if (ua2.includes('mac os') || ua2.includes('macintosh')) return { label: 'Mac', icon: 'desktop-outline' };
  if (ua2.includes('windows')) return { label: 'Windows PC', icon: 'desktop-outline' };
  return { label: 'Web browser', icon: 'globe-outline' };
};

const relativeTime = (iso: string | null): string => {
  if (!iso) return 'never used';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'active now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

interface FieldErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

/** Says the whole rule up front, so it is not first learned from a failed submit. */
const PASSWORD_HELPER = 'At least 8 characters, with upper and lower case, a number and one of @ $ ! % * ? &';

const SAME_AS_CURRENT = 'Your new password must be different from your current one';

const newPasswordProblem = (next: string, current: string): string | undefined =>
  passwordProblem(next) ?? (next === current ? SAME_AS_CURRENT : undefined);

const confirmProblem = (next: string, confirm: string): string | undefined =>
  next !== confirm ? 'The two new passwords do not match' : undefined;

function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: AuthSession;
  onRevoke: (s: AuthSession) => void;
  revoking: boolean;
}) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const { label, icon } = deviceLabel(session.userAgent);
  const when = relativeTime(session.lastUsedAt ?? session.createdAt);
  // Three Android sessions must not all read "Sign out of Android device".
  const whenSpoken = when === 'active now' || when === 'never used' || !when ? when : `last used ${when}`;
  return (
    <View style={s.sessionRow} testID={`session-${session.id}`}>
      <Ionicons name={icon} size={20} color={c.textSecondary} {...HIDE_FROM_A11Y} />
      <View style={s.sessionInfo}>
        <View style={s.sessionTitleRow}>
          <Text variant="callout" color="textPrimary">{label}</Text>
          {session.isCurrent ? <Badge label="This device" tone="primary" style={s.currentBadge} /> : null}
        </View>
        {/* textSecondary, not textMuted: 13pt meta on a white card fails AA in muted grey. */}
        <Text variant="footnote" color="textSecondary">
          {when}
          {session.ipAddress ? ` · ${session.ipAddress}` : ''}
        </Text>
      </View>
      {session.isCurrent ? null : (
        <Button
          title="Sign out"
          variant="text"
          size="sm"
          loading={revoking}
          // Only opens the confirm dialog; the confirmed sign-out is the committed action.
          haptic={false}
          onPress={() => onRevoke(session)}
          testID={`revoke-${session.id}`}
          accessibilityLabel={whenSpoken ? `Sign out of ${label}, ${whenSpoken}` : `Sign out of ${label}`}
        />
      )}
    </View>
  );
}

export default function AccountSecurityScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const queryClient = useQueryClient();
  const storeLogout = useAuthStore((state) => state.logout);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  // Rule problems sit under the field that has them; only a server refusal
  // (wrong current password, rate limit, offline) is a form-level banner.
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: getSessions,
    staleTime: 30 * 1000,
  });

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      setErrors({});
      setFormError(null);
      // Other devices were signed out server-side; this one survives.
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      showToast.success('Password changed', 'Your other devices have been signed out.');
    },
    onError: (err) => setFormError(apiMessage(err, 'Could not change your password. Please try again.')),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
    onError: (err) => showToast.error('Could not sign out that device', apiMessage(err, 'Please try again.')),
    onSettled: () => setRevokingId(null),
  });

  const logoutAllMutation = useMutation({
    mutationFn: logoutAll,
    // Every token is revoked, including this device's; drop the local session
    // rather than leave the app holding one the server will refuse. Only on
    // success: on a failed request the other devices are still signed in, and
    // this screen must not pretend they are not.
    onSuccess: () => storeLogout(),
    onError: (err) => showToast.error('Could not sign out everywhere', apiMessage(err, 'Check your connection and try again.')),
  });

  // Editing a field clears its own message, and any message that only made
  // sense against the value that just changed (a stale "do not match" would
  // otherwise sit under two passwords that now match).
  const changeCurrent = (v: string) => {
    setCurrent(v);
    setFormError(null);
    setErrors((e) => ({ ...e, current: undefined, next: e.next === SAME_AS_CURRENT ? undefined : e.next }));
  };
  const changeNext = (v: string) => {
    setNext(v);
    setFormError(null);
    setErrors((e) => ({ ...e, next: undefined, confirm: e.confirm ? confirmProblem(v, confirm) : undefined }));
  };
  const changeConfirm = (v: string) => {
    setConfirm(v);
    setFormError(null);
    setErrors((e) => ({ ...e, confirm: undefined }));
  };

  // Validate on blur as well as on submit, and only once the member has typed
  // something: an empty field on blur is "not there yet", not "wrong".
  const blurNext = () => {
    if (next) setErrors((e) => ({ ...e, next: newPasswordProblem(next, current) }));
  };
  const blurConfirm = () => {
    if (confirm) setErrors((e) => ({ ...e, confirm: confirmProblem(next, confirm) }));
  };

  const submitPassword = () => {
    const found: FieldErrors = {
      current: current ? undefined : 'Enter your current password',
      next: newPasswordProblem(next, current),
      confirm: next !== confirm ? 'The two new passwords do not match' : undefined,
    };
    setErrors(found);
    const first = found.current ?? found.next ?? found.confirm;
    if (first) {
      AccessibilityInfo.announceForAccessibility(first);
      return;
    }
    setFormError(null);
    passwordMutation.mutate();
  };

  const confirmRevoke = (session: AuthSession) => {
    const { label } = deviceLabel(session.userAgent);
    Alert.alert('Sign out this device?', `${label} will need to sign in again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setRevokingId(session.id);
          revokeMutation.mutate(session.id);
        },
      },
    ]);
  };

  const confirmLogoutAll = () => {
    Alert.alert(
      'Sign out everywhere?',
      'Every device, including this one, will be signed out.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out everywhere', style: 'destructive', onPress: () => logoutAllMutation.mutate() },
      ],
    );
  };

  // A server refusal appears without a tap. Android reads the banner's live
  // region; iOS has none, so it is announced here (one channel per platform,
  // otherwise TalkBack reads it twice).
  useEffect(() => {
    if (formError && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(formError);
  }, [formError]);

  const sessions = sessionsQuery.data ?? [];

  return (
    <Screen edges={['top', 'bottom']} keyboard style={s.wrapper} testID="AccountSecurityScreen">
      <ScreenHeader title="Account security" />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Change password */}
        <Card style={s.card}>
          <Text variant="headline" color="textPrimary">Change password</Text>
          <Text variant="footnote" color="textSecondary">
            Your other devices are signed out when the password changes. This one stays signed in.
          </Text>

          <Input
            label="Current password"
            value={current}
            onChangeText={changeCurrent}
            secureTextEntry
            secureToggle
            autoCapitalize="none"
            textContentType="password"
            error={errors.current}
            testID="current-password"
            accessibilityLabel="Current password"
          />
          <Input
            label="New password"
            value={next}
            onChangeText={changeNext}
            onBlur={blurNext}
            secureTextEntry
            secureToggle
            autoCapitalize="none"
            textContentType="newPassword"
            passwordRules={PASSWORD_RULES_ATTR}
            helper={PASSWORD_HELPER}
            error={errors.next}
            testID="new-password"
            accessibilityLabel="New password"
          />
          {next ? <PasswordStrength password={next} /> : null}
          <Input
            label="Confirm new password"
            value={confirm}
            onChangeText={changeConfirm}
            onBlur={blurConfirm}
            secureTextEntry
            secureToggle
            autoCapitalize="none"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={submitPassword}
            error={errors.confirm}
            testID="confirm-password"
            accessibilityLabel="Confirm new password"
          />

          {formError ? (
            <View style={s.errorBanner} testID="password-error" accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={15} color={c.error} {...HIDE_FROM_A11Y} />
              <Text variant="footnote" color="error" style={s.errorText}>{formError}</Text>
            </View>
          ) : null}

          <Button
            title="Update password"
            onPress={submitPassword}
            loading={passwordMutation.isPending}
            disabled={passwordMutation.isPending}
            // The success toast fires its own haptic; one per committed action.
            haptic={false}
            testID="submit-password"
          />
        </Card>

        {/* Sessions */}
        <Card style={s.card}>
          <Text variant="headline" color="textPrimary">Where you're signed in</Text>
          <Text variant="footnote" color="textSecondary">
            Sign out any device you don't recognise. Doing so does not change your password.
          </Text>

          {sessionsQuery.isLoading ? (
            <View style={s.skeletons}>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : sessionsQuery.isError && !sessionsQuery.data ? (
            // Only when there is nothing cached to show: a failed background
            // refetch (e.g. after signing a device out) keeps the last good list.
            <EmptyState
              variant="error"
              icon="cloud-offline-outline"
              title="Couldn't load your sessions"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => sessionsQuery.refetch()}
              testID="AccountSecurityScreen-error"
            />
          ) : sessions.length === 0 ? (
            // The request itself proves one live session exists, so an empty
            // list means the server answered with something we can't show —
            // say that rather than "no devices", which reads as a security claim.
            <EmptyState
              icon="phone-portrait-outline"
              title="No sessions to show"
              description="The list came back empty. Refresh to check again."
              actionLabel="Refresh"
              onAction={() => sessionsQuery.refetch()}
              testID="AccountSecurityScreen-empty"
            />
          ) : (
            sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onRevoke={confirmRevoke}
                revoking={revokingId === session.id}
              />
            ))
          )}

          <Button
            title="Sign out everywhere"
            variant="danger"
            icon="log-out-outline"
            // Only opens the confirm dialog; the confirmed sign-out is the committed action.
            haptic={false}
            onPress={confirmLogoutAll}
            loading={logoutAllMutation.isPending}
            testID="logout-all"
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:  { flex: 1, backgroundColor: c.background },
  content:  { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },

  card:      { padding: spacing.lg, gap: spacing.md },

  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: c.errorBg, borderRadius: borderRadius.md, padding: spacing.md },
  errorText:   { flex: 1 },

  skeletons:  { gap: spacing.sm },

  sessionRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  sessionInfo:    { flex: 1, gap: 2 },
  // Wraps: a longer hi/pa label must push the badge down, not off the row.
  sessionTitleRow:{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  currentBadge:   { alignSelf: 'center' },
});
