import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Screen from '../../components/layout/Screen';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { Badge, EmptyState, IconButton, ScreenHeader } from '../../components/ui';
import { useReduceMotion, useReduceTransparency } from '../../components/motion';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import {
  getMyGuardianLinks,
  inviteGuardian,
  revokeGuardian,
  type GuardianLink,
} from '../../api/guardian';
import { queryKeys } from '../../constants/queryKeys';
import { showToast } from '../../utils/toast';

// Decorative glyphs sit beside a text label; the screen reader reads the label.
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const apiMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
  return data?.error?.message ?? data?.message ?? fallback;
};

// ─── Invite modal ─────────────────────────────────────────────────────────────
// Stays open until the server says yes. It used to close the instant Send was
// tapped, so a failed invite lost the typed address and told nobody why.

function InviteGuardianModal({ visible, onClose, onCreate, sending, serverError }: {
  visible: boolean;
  onClose: () => void;
  onCreate: (email: string) => void;
  sending: boolean;
  serverError: string | null;
}) {
  const { c } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const reduceMotion = useReduceMotion();
  const im = React.useMemo(() => makeIm(c), [c]);
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  // A closed sheet must not keep last time's address or message.
  useEffect(() => {
    if (!visible) {
      setEmail('');
      setFieldError(null);
    }
  }, [visible]);

  const error = fieldError ?? serverError;
  // The message appears without a tap; iOS has no live regions, so say it.
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  const handleSend = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setFieldError('Enter a valid email address.');
      return;
    }
    setFieldError(null);
    onCreate(email.trim());
  };

  // Closing mid-request would orphan the mutation; the request decides the outcome.
  const close = () => { if (!sending) onClose(); };

  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={close}>
      <KeyboardAvoidingView style={im.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[im.overlay, reduceTransparency && im.overlayOpaque]}>
          {/* Tap outside to dismiss. A scrim has nothing to animate, so it is a plain
              Pressable; while a request is in flight `close` refuses, so nothing is orphaned. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="invite-guardian-scrim"
          />
          <View style={im.sheet} accessibilityViewIsModal>
            <View style={im.handle} {...HIDE_FROM_A11Y} />
            <Text variant="title3" color="textPrimary" style={im.title} accessibilityRole="header">Invite a guardian</Text>
            <Text variant="footnote" color="textSecondary" style={im.hint}>
              Your guardian gets read-only access to your match list and shortlist. They cannot message or take any match actions.
            </Text>

            <Input
              label="Guardian's email"
              value={email}
              onChangeText={setEmail}
              placeholder="guardian@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={handleSend}
              maxLength={120}
              error={error ?? undefined}
              testID="guardian-email-input"
              accessibilityLabel="Guardian email"
            />

            <Button
              title="Send invite"
              onPress={handleSend}
              loading={sending}
              // The success toast fires its own haptic; one per committed action.
              haptic={false}
              testID="send-guardian-invite-btn"
              accessibilityLabel="Send invite"
              style={im.action}
            />
            <Button
              title="Cancel"
              variant="text"
              haptic={false}
              onPress={close}
              disabled={sending}
              testID="cancel-guardian-invite-btn"
              style={im.action}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeIm = (c: ThemeColours) => StyleSheet.create({
  flex:          { flex: 1 },
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
  // Reduce Transparency: a see-through scrim becomes a solid themed surface (doctrine 10.5).
  overlayOpaque: { backgroundColor: c.surface2 },
  // Elevation is the top border alone: the sheet rests on a scrim, not on a shadow.
  sheet:         { backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: c.border, padding: spacing.xl, paddingBottom: spacing['3xl'] },
  handle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
  title:         { marginBottom: spacing.sm },
  hint:          { marginBottom: spacing.lg },
  action:        { width: '100%', marginTop: spacing.xs },
});

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<GuardianLink['status'], { label: string; tone: 'warning' | 'success' | 'neutral' }> = {
  pending: { label: 'Waiting for reply', tone: 'warning' },
  active:  { label: 'Active',      tone: 'success' },
  revoked: { label: 'Revoked',     tone: 'neutral' },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GuardianSetupScreen() {
  const { c, elder } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);

  const { data: links, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.guardianLinks,
    queryFn: getMyGuardianLinks,
    staleTime: 2 * 60 * 1000,
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => inviteGuardian(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guardianLinks });
      setShowInvite(false);
      showToast.success('Invite sent', 'They have 7 days to accept. They only see your matches if they say yes.');
    },
    // No toast: the failure is shown inside the (still open) invite sheet.
  });

  const revokeMutation = useMutation({
    mutationFn: (linkId: string) => revokeGuardian(linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.guardianLinks }),
    onError: (err) => showToast.error('Could not revoke access', apiMessage(err, 'Check your connection and try again.')),
  });

  const handleRevoke = (link: GuardianLink) => {
    Alert.alert(
      'Revoke access',
      `Remove ${link.guardianName}'s guardian access? They will no longer see your matches.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => revokeMutation.mutate(link.id) },
      ]
    );
  };

  const closeInvite = () => {
    setShowInvite(false);
    inviteMutation.reset();
  };

  const activeLinks = links?.filter((l) => l.status !== 'revoked') ?? [];
  const hasLinks = !!links && links.length > 0;
  // The empty state carries its own invite action; a second identical button
  // above it would put two "Invite a guardian" CTAs on one screen.
  const showEmptyState = !isLoading && !isError && !hasLinks;

  return (
    <Screen edges={['top', 'bottom']} style={s.wrapper} testID="GuardianSetupScreen">
      <ScreenHeader title="Guardian co-pilot" testID="guardian-setup-header" />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Feature intro */}
        <View style={s.introBanner}>
          <Ionicons name="shield-half-outline" size={36} color={c.primary} {...HIDE_FROM_A11Y} />
          <Text variant="title3" color="primary" style={s.introTitle}>Involve your family</Text>
          <Text variant="footnote" color="textSecondary" style={s.introSub}>
            Invite a parent, sibling, or trusted relative as your guardian. They get read-only access to browse your matches and shortlist, but cannot send messages or take match actions.
          </Text>
        </View>

        {/* Permission list */}
        <View style={s.permCard}>
          <Text variant="headline" color="textPrimary" style={s.permHeading} accessibilityRole="header">What guardians can do</Text>
          {[
            { icon: 'checkmark-circle' as const,    color: c.successAccent, label: 'View your match list' },
            { icon: 'checkmark-circle' as const,    color: c.successAccent, label: 'View your shortlisted profiles' },
            { icon: 'checkmark-circle' as const,    color: c.successAccent, label: 'See the name and city of each match' },
            { icon: 'close-circle' as const,        color: c.error,         label: 'Send messages (not allowed)' },
            { icon: 'close-circle' as const,        color: c.error,         label: 'Like, decline, or shortlist (not allowed)' },
            { icon: 'close-circle' as const,        color: c.error,         label: 'See your private conversations (not allowed)' },
          ].map((row, i) => (
            <View key={i} style={s.permRow}>
              <Ionicons name={row.icon} size={18} color={row.color} {...HIDE_FROM_A11Y} />
              <Text variant="footnote" color="textSecondary" style={s.permLabel}>{row.label}</Text>
            </View>
          ))}
        </View>

        {/* Invite button */}
        {activeLinks.length < 3 && !showEmptyState && (
          <Button
            title="Invite a guardian"
            icon="person-add-outline"
            // Only opens the invite sheet; the success toast is the committed action's haptic.
            haptic={false}
            onPress={() => setShowInvite(true)}
            testID="invite-guardian-btn"
            accessibilityLabel="Invite a guardian"
          />
        )}

        {activeLinks.length >= 3 && (
          <View style={s.limitNote}>
            <Ionicons name="information-circle-outline" size={16} color={c.textMuted} {...HIDE_FROM_A11Y} />
            <Text variant="footnote" color="textSecondary" style={s.limitText}>Maximum 3 active guardians allowed.</Text>
          </View>
        )}

        {/* Guardian list */}
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : isError && (!links || links.length === 0) ? (
          <EmptyState
            variant="error"
            icon="cloud-offline-outline"
            title="Couldn't load guardians"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => refetch()}
            testID="GuardianSetupScreen-error"
          />
        ) : hasLinks ? (
          <View style={s.linksList}>
            <Text variant="headline" color="textPrimary" style={s.linksHeading} accessibilityRole="header">Your guardians</Text>
            {links.map((link) => {
              const badge = STATUS_BADGE[link.status];
              const revoking = revokeMutation.isPending && revokeMutation.variables === link.id;
              return (
                <View key={link.id} style={s.linkRow} testID={`guardian-row-${link.id}`}>
                  <View style={s.linkAvatar} {...HIDE_FROM_A11Y}>
                    <Ionicons name="person" size={18} color={c.primary} />
                  </View>
                  <View style={s.linkInfo}>
                    <Text variant="subhead" color="textPrimary" numberOfLines={1} ellipsizeMode="middle">{link.guardianName}</Text>
                  </View>
                  <Badge label={badge.label} tone={badge.tone} style={s.badge} />
                  {link.status !== 'revoked' && (
                    revoking ? (
                      <View style={[s.revokeSlot, elder && { width: tapSize(true), height: tapSize(true) }]} accessible accessibilityLabel={`Revoking ${link.guardianName}`} accessibilityLiveRegion="polite">
                        <ActivityIndicator size="small" color={c.error} />
                      </View>
                    ) : (
                      <IconButton
                        icon="trash-outline"
                        size={18}
                        color={c.error}
                        onPress={() => handleRevoke(link)}
                        testID={`revoke-btn-${link.id}`}
                        accessibilityLabel={`Revoke ${link.guardianName}`}
                      />
                    )
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="people-outline"
            title="No guardians yet"
            description="Invite a parent or sibling to follow your matches with you."
            actionLabel="Invite a guardian"
            onAction={() => setShowInvite(true)}
            testID="GuardianSetupScreen-empty"
          />
        )}
      </ScrollView>

      <InviteGuardianModal
        visible={showInvite}
        onClose={closeInvite}
        onCreate={(email) => inviteMutation.mutate(email)}
        sending={inviteMutation.isPending}
        serverError={
          inviteMutation.isError
            ? apiMessage(inviteMutation.error, 'Could not send the invite. Check your connection and try again.')
            : null
        }
      />
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:      { backgroundColor: c.background },
  content:      { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.lg },
  introBanner:  { alignItems: 'center', backgroundColor: c.primaryLight, borderRadius: borderRadius.lg, padding: spacing.xl, gap: spacing.sm },
  introTitle:   { textAlign: 'center' },
  introSub:     { textAlign: 'center' },
  permCard:     { backgroundColor: c.surfaceCard, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  permHeading:  { marginBottom: spacing.md },
  permRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  permLabel:    { flex: 1 },
  limitNote:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: c.surfaceCard, borderRadius: borderRadius.md },
  limitText:    { flex: 1 },
  linksList:    { gap: spacing.sm },
  linksHeading: { marginBottom: spacing.xs },
  linkRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.surfaceCard, borderRadius: borderRadius.md, paddingVertical: spacing.xs, paddingLeft: spacing.md, paddingRight: spacing.xs, borderWidth: 1, borderColor: c.border },
  linkAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
  linkInfo:     { flex: 1 },
  badge:        { alignSelf: 'center' },
  revokeSlot:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
