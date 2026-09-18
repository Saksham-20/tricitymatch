import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import Text from '../../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import {
  getMyGuardianLinks,
  inviteGuardian,
  revokeGuardian,
  type GuardianLink,
} from '../../api/guardian';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteGuardianModal({ visible, onClose, onCreate }: {
  visible: boolean;
  onClose: () => void;
  onCreate: (email: string) => void;
}) {
  const { c } = useTheme();
  const im = React.useMemo(() => makeIm(c), [c]);
  const [email, setEmail] = useState('');

  const handleSend = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { Alert.alert('Invalid', 'Enter a valid email address.'); return; }
    onCreate(email.trim());
    setEmail('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={im.overlay}>
        <View style={im.sheet}>
          <View style={im.handle} />
          <Text variant="title3" color="textPrimary" style={im.title}>Invite Guardian</Text>
          <Text variant="footnote" color="textSecondary" style={im.hint}>
            Your guardian gets read-only access to your match list and shortlist. They cannot message or take any match actions.
          </Text>

          <Text variant="caption" color="textSecondary" style={im.label}>Guardian's Email</Text>
          <TextInput
            style={im.input}
            value={email}
            onChangeText={setEmail}
            placeholder="guardian@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={120}
            testID="guardian-email-input"
            accessibilityLabel="Guardian email"
          />

          <TouchableOpacity style={im.sendBtn} onPress={handleSend} testID="send-guardian-invite-btn" accessibilityLabel="Send invite">
            <Text variant="headline" style={im.sendText}>Send Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity style={im.cancelBtn} onPress={onClose} testID="cancel-guardian-invite-btn">
            <Text variant="callout" color="textSecondary">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeIm = (c: ThemeColours) => StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:    { backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing['3xl'] },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
  title:    { marginBottom: spacing.sm },
  hint:     { marginBottom: spacing.lg },
  label:    { marginBottom: spacing.xs },
  input:    { borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.fontSize.base, color: c.textPrimary, marginBottom: spacing.lg },
  sendBtn:  { backgroundColor: c.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  sendText: { color: '#fff' },
  cancelBtn:{ alignItems: 'center', paddingVertical: spacing.sm },
});

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: GuardianLink['status'] }) {
  const { c } = useTheme();
  const cfg = {
    pending: { label: 'Invite Sent', bg: c.warning + '20', color: c.warning },
    active:  { label: 'Active',      bg: c.success + '20', color: c.success },
    revoked: { label: 'Revoked',     bg: c.border,          color: c.textMuted },
  }[status];
  return (
    <View style={[sp.pill, { backgroundColor: cfg.bg }]}>
      {/* cfg.color is picked from a status→colour map (pending/active/revoked) —
          dynamically computed, not a single curated token, so kept as a style override. */}
      <Text variant="caption" style={{ color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}

const sp = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GuardianSetupScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);

  const { data: links, isLoading } = useQuery({
    queryKey: queryKeys.guardianLinks,
    queryFn: getMyGuardianLinks,
    staleTime: 2 * 60 * 1000,
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => inviteGuardian(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guardianLinks });
      Alert.alert('Invited!', 'Guardian invite sent. They can log in with their email to access your match list.');
    },
    onError: () => Alert.alert('Error', 'Failed to send invite.'),
  });

  const handleRevoke = (link: GuardianLink) => {
    Alert.alert(
      'Revoke Access',
      `Remove ${link.guardianName}'s guardian access? They will no longer see your matches.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeGuardian(link.id);
              queryClient.invalidateQueries({ queryKey: queryKeys.guardianLinks });
            } catch {
              Alert.alert('Error', 'Failed to revoke access.');
            }
          },
        },
      ]
    );
  };

  const activeLinks = links?.filter((l) => l.status !== 'revoked') ?? [];

  return (
    <View style={[s.wrapper, { paddingTop: insets.top }]} testID="GuardianSetupScreen">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} testID="back-btn" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text variant="title3" color="textPrimary">Guardian Co-Pilot</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Feature intro */}
        <View style={s.introBanner}>
          <Ionicons name="shield-half-outline" size={36} color={c.primary} />
          <Text variant="title3" color="primary" style={s.introTitle}>Involve Your Family</Text>
          <Text variant="footnote" color="textSecondary" style={s.introSub}>
            Invite a parent, sibling, or trusted relative as your guardian. They get read-only access to browse your matches and shortlist — but cannot send messages or take match actions.
          </Text>
        </View>

        {/* Permission list */}
        <View style={s.permCard}>
          <Text variant="headline" color="textPrimary" style={s.permHeading}>What guardians can do</Text>
          {[
            { icon: 'checkmark-circle' as const,    color: c.success, label: 'View your match list' },
            { icon: 'checkmark-circle' as const,    color: c.success, label: 'View your shortlisted profiles' },
            { icon: 'checkmark-circle' as const,    color: c.success, label: 'View full profile details of matches' },
            { icon: 'close-circle' as const,        color: c.error,   label: 'Send messages (not allowed)' },
            { icon: 'close-circle' as const,        color: c.error,   label: 'Like, decline, or shortlist (not allowed)' },
            { icon: 'close-circle' as const,        color: c.error,   label: 'See your private conversations (not allowed)' },
          ].map((row, i) => (
            <View key={i} style={s.permRow}>
              <Ionicons name={row.icon} size={18} color={row.color} />
              <Text variant="footnote" color="textSecondary">{row.label}</Text>
            </View>
          ))}
        </View>

        {/* Invite button */}
        {activeLinks.length < 3 && (
          <TouchableOpacity
            style={s.inviteBtn}
            onPress={() => setShowInvite(true)}
            testID="invite-guardian-btn"
            accessibilityLabel="Invite a guardian"
          >
            <Ionicons name="person-add-outline" size={18} color="#fff" style={{ marginRight: spacing.sm }} />
            <Text variant="headline" style={s.inviteBtnText}>Invite a Guardian</Text>
          </TouchableOpacity>
        )}

        {activeLinks.length >= 3 && (
          <View style={s.limitNote}>
            <Ionicons name="information-circle-outline" size={16} color={c.textMuted} />
            <Text variant="footnote" color="textMuted">Maximum 3 active guardians allowed.</Text>
          </View>
        )}

        {/* Guardian list */}
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : links && links.length > 0 ? (
          <View style={s.linksList}>
            <Text variant="headline" color="textPrimary" style={s.linksHeading}>Your Guardians</Text>
            {links.map((link) => (
              <View key={link.id} style={s.linkRow} testID={`guardian-row-${link.id}`}>
                <View style={s.linkAvatar}>
                  <Ionicons name="person" size={18} color={c.primary} />
                </View>
                <View style={s.linkInfo}>
                  <Text variant="caption" color="textPrimary">{link.guardianName}</Text>
                </View>
                <StatusPill status={link.status} />
                {link.status !== 'revoked' && (
                  <TouchableOpacity
                    style={s.revokeBtn}
                    onPress={() => handleRevoke(link)}
                    testID={`revoke-btn-${link.id}`}
                    accessibilityLabel={`Revoke ${link.guardianName}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={c.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={s.emptyLinks}>
            <Text variant="footnote" color="textMuted">No guardians invited yet.</Text>
          </View>
        )}
      </ScrollView>

      <InviteGuardianModal
        visible={showInvite}
        onClose={() => setShowInvite(false)}
        onCreate={(email) => inviteMutation.mutate(email)}
      />
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:      { flex: 1, backgroundColor: c.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content:      { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.lg },
  introBanner:  { alignItems: 'center', backgroundColor: c.primaryLight, borderRadius: borderRadius.lg, padding: spacing.xl, gap: spacing.sm },
  introTitle:   { textAlign: 'center' },
  introSub:     { textAlign: 'center' },
  permCard:     { backgroundColor: c.surfaceCard, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  permHeading:  { marginBottom: spacing.md },
  permRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  inviteBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md },
  inviteBtnText:{ color: '#fff' },
  limitNote:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: c.surfaceCard, borderRadius: borderRadius.md },
  linksList:    { gap: spacing.sm },
  linksHeading: { marginBottom: spacing.xs },
  linkRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.surfaceCard, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  linkAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
  linkInfo:     { flex: 1 },
  linkPhone:    { fontSize: typography.fontSize.xs, color: c.textSecondary },
  revokeBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  emptyLinks:   { alignItems: 'center', paddingVertical: spacing.xl },
});
