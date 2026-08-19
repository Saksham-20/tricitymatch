import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colours, spacing, type, type ThemeColours } from '@shared/constants/theme';
import {
  Button,
  Card,
  EmptyState,
  Input,
  PasswordStrength,
  ScreenHeader,
  SkeletonRow,
} from '../../components/ui';
import { changePassword, getSessions, logoutAll, revokeSession, type AuthSession } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { PASSWORD_RULES_ATTR, passwordProblem } from '../../utils/passwordRule';

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
  return (
    <View style={s.sessionRow} testID={`session-${session.id}`}>
      <Ionicons name={icon} size={20} color={c.textSecondary} />
      <View style={s.sessionInfo}>
        <View style={s.sessionTitleRow}>
          <Text style={s.sessionLabel}>{label}</Text>
          {session.isCurrent ? (
            <View style={s.currentChip}>
              <Text style={s.currentChipText}>This device</Text>
            </View>
          ) : null}
        </View>
        <Text style={s.sessionMeta}>
          {relativeTime(session.lastUsedAt ?? session.createdAt)}
          {session.ipAddress ? ` · ${session.ipAddress}` : ''}
        </Text>
      </View>
      {session.isCurrent ? null : (
        <Button
          title="Sign out"
          variant="text"
          size="sm"
          loading={revoking}
          onPress={() => onRevoke(session)}
          testID={`revoke-${session.id}`}
          accessibilityLabel={`Sign out of ${label}`}
        />
      )}
    </View>
  );
}

export default function AccountSecurityScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const storeLogout = useAuthStore((state) => state.logout);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
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
      setFormError(null);
      // Other devices were signed out server-side; this one survives.
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      Alert.alert('Password changed', 'Your other devices have been signed out.');
    },
    onError: (err) => setFormError(apiMessage(err, 'Could not change your password. Please try again.')),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
    onError: (err) => Alert.alert('Could not sign out that device', apiMessage(err, 'Please try again.')),
    onSettled: () => setRevokingId(null),
  });

  const logoutAllMutation = useMutation({
    mutationFn: logoutAll,
    // Every token is revoked, including this device's — drop the local session
    // rather than leave the app holding one the server will refuse.
    onSettled: () => storeLogout(),
  });

  const submitPassword = () => {
    const problem = passwordProblem(next);
    if (!current) return setFormError('Enter your current password');
    if (problem) return setFormError(problem);
    if (next !== confirm) return setFormError('The two new passwords do not match');
    if (next === current) return setFormError('Your new password must be different from your current one');
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

  const sessions = sessionsQuery.data ?? [];

  return (
    <View style={[s.wrapper, { paddingTop: insets.top }]} testID="AccountSecurityScreen">
      <ScreenHeader title="Account security" />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Change password */}
        <Card style={s.card}>
          <Text style={s.cardTitle}>Change password</Text>
          <Text style={s.cardBody}>
            Your other devices are signed out when the password changes. This one stays signed in.
          </Text>

          <Input
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            secureToggle
            autoCapitalize="none"
            textContentType="password"
            testID="current-password"
          />
          <Input
            label="New password"
            value={next}
            onChangeText={setNext}
            secureTextEntry
            secureToggle
            autoCapitalize="none"
            textContentType="newPassword"
            passwordRules={PASSWORD_RULES_ATTR}
            placeholder="Min. 8 chars, with a number & symbol"
            testID="new-password"
          />
          {next ? <PasswordStrength password={next} /> : null}
          <Input
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            secureToggle
            autoCapitalize="none"
            textContentType="newPassword"
            testID="confirm-password"
          />

          {formError ? (
            <View style={s.errorBanner} testID="password-error">
              <Ionicons name="alert-circle" size={15} color={c.error} />
              <Text style={s.errorText}>{formError}</Text>
            </View>
          ) : null}

          <Button
            title="Update password"
            onPress={submitPassword}
            loading={passwordMutation.isPending}
            disabled={passwordMutation.isPending}
            testID="submit-password"
          />
        </Card>

        {/* Sessions */}
        <Card style={s.card}>
          <Text style={s.cardTitle}>Where you're signed in</Text>
          <Text style={s.cardBody}>
            Sign out any device you don't recognise. Doing so does not change your password.
          </Text>

          {sessionsQuery.isLoading ? (
            <View style={s.skeletons}>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : sessionsQuery.isError ? (
            <EmptyState
              variant="error"
              title="Couldn't load your sessions"
              description="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => sessionsQuery.refetch()}
              testID="sessions-error"
            />
          ) : sessions.length === 0 ? (
            // The request itself proves one live session exists, so an empty
            // list means the server answered with something we can't show —
            // say that rather than "no devices", which reads as a security claim.
            <Text style={s.emptyNote}>No other sessions to show.</Text>
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
            onPress={confirmLogoutAll}
            loading={logoutAllMutation.isPending}
            testID="logout-all"
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:  { flex: 1, backgroundColor: c.background },
  content:  { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },

  card:      { padding: spacing.lg, gap: spacing.md },
  cardTitle: { ...type.headline, color: c.textPrimary },
  cardBody:  { ...type.footnote, color: c.textSecondary },

  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: c.errorBg, borderRadius: borderRadius.md, padding: spacing.md },
  errorText:   { flex: 1, ...type.footnote, color: c.error },

  skeletons:  { gap: spacing.sm },
  emptyNote:  { ...type.footnote, color: c.textMuted },

  sessionRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  sessionInfo:    { flex: 1, gap: 2 },
  sessionTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sessionLabel:   { ...type.callout, color: c.textPrimary },
  sessionMeta:    { ...type.footnote, color: c.textMuted },
  currentChip:    { backgroundColor: c.p100, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  currentChipText:{ ...type.micro, color: c.p500 },
});
