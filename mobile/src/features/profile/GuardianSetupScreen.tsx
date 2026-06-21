import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
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
          <Text style={im.title}>Invite Guardian</Text>
          <Text style={im.hint}>
            Your guardian gets read-only access to your match list and shortlist. They cannot message or take any match actions.
          </Text>

          <Text style={im.label}>Guardian's Email</Text>
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
            <Text style={im.sendText}>Send Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity style={im.cancelBtn} onPress={onClose} testID="cancel-guardian-invite-btn">
            <Text style={im.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const im = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:    { backgroundColor: colours.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing['3xl'] },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: colours.border, alignSelf: 'center', marginBottom: spacing.lg },
  title:    { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginBottom: spacing.sm },
  hint:     { fontSize: typography.fontSize.sm, color: colours.textSecondary, marginBottom: spacing.lg, lineHeight: 20 },
  label:    { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold, color: colours.textSecondary, marginBottom: spacing.xs },
  input:    { borderWidth: 1, borderColor: colours.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.fontSize.base, color: colours.textPrimary, marginBottom: spacing.lg },
  sendBtn:  { backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  sendText: { color: '#fff', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold },
  cancelBtn:{ alignItems: 'center', paddingVertical: spacing.sm },
  cancelText:{ fontSize: typography.fontSize.base, color: colours.textSecondary },
});

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: GuardianLink['status'] }) {
  const cfg = {
    pending: { label: 'Invite Sent', bg: colours.warning + '20', color: colours.warning },
    active:  { label: 'Active',      bg: colours.success + '20', color: colours.success },
    revoked: { label: 'Revoked',     bg: colours.border,          color: colours.textMuted },
  }[status];
  return (
    <View style={[sp.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[sp.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const sp = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
  text: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GuardianSetupScreen() {
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
    <View style={s.wrapper} testID="GuardianSetupScreen">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} testID="back-btn" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Guardian Co-Pilot</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Feature intro */}
        <View style={s.introBanner}>
          <Ionicons name="shield-half-outline" size={36} color={colours.primary} />
          <Text style={s.introTitle}>Involve Your Family</Text>
          <Text style={s.introSub}>
            Invite a parent, sibling, or trusted relative as your guardian. They get read-only access to browse your matches and shortlist — but cannot send messages or take match actions.
          </Text>
        </View>

        {/* Permission list */}
        <View style={s.permCard}>
          <Text style={s.permHeading}>What guardians can do</Text>
          {[
            { icon: 'checkmark-circle' as const,    color: colours.success, label: 'View your match list' },
            { icon: 'checkmark-circle' as const,    color: colours.success, label: 'View your shortlisted profiles' },
            { icon: 'checkmark-circle' as const,    color: colours.success, label: 'View full profile details of matches' },
            { icon: 'close-circle' as const,        color: colours.error,   label: 'Send messages (not allowed)' },
            { icon: 'close-circle' as const,        color: colours.error,   label: 'Like, decline, or shortlist (not allowed)' },
            { icon: 'close-circle' as const,        color: colours.error,   label: 'See your private conversations (not allowed)' },
          ].map((row, i) => (
            <View key={i} style={s.permRow}>
              <Ionicons name={row.icon} size={18} color={row.color} />
              <Text style={s.permLabel}>{row.label}</Text>
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
            <Text style={s.inviteBtnText}>Invite a Guardian</Text>
          </TouchableOpacity>
        )}

        {activeLinks.length >= 3 && (
          <View style={s.limitNote}>
            <Ionicons name="information-circle-outline" size={16} color={colours.textMuted} />
            <Text style={s.limitNoteText}>Maximum 3 active guardians allowed.</Text>
          </View>
        )}

        {/* Guardian list */}
        {isLoading ? (
          <ActivityIndicator size="large" color={colours.primary} style={{ marginTop: spacing.xl }} />
        ) : links && links.length > 0 ? (
          <View style={s.linksList}>
            <Text style={s.linksHeading}>Your Guardians</Text>
            {links.map((link) => (
              <View key={link.id} style={s.linkRow} testID={`guardian-row-${link.id}`}>
                <View style={s.linkAvatar}>
                  <Ionicons name="person" size={18} color={colours.primary} />
                </View>
                <View style={s.linkInfo}>
                  <Text style={s.linkName}>{link.guardianName}</Text>
                </View>
                <StatusPill status={link.status} />
                {link.status !== 'revoked' && (
                  <TouchableOpacity
                    style={s.revokeBtn}
                    onPress={() => handleRevoke(link)}
                    testID={`revoke-btn-${link.id}`}
                    accessibilityLabel={`Revoke ${link.guardianName}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={colours.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={s.emptyLinks}>
            <Text style={s.emptyText}>No guardians invited yet.</Text>
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

const s = StyleSheet.create({
  wrapper:      { flex: 1, backgroundColor: colours.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colours.background, borderBottomWidth: 1, borderBottomColor: colours.border },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  content:      { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.lg },
  introBanner:  { alignItems: 'center', backgroundColor: colours.primaryLight, borderRadius: borderRadius.lg, padding: spacing.xl, gap: spacing.sm },
  introTitle:   { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.primary, textAlign: 'center' },
  introSub:     { fontSize: typography.fontSize.sm, color: colours.textSecondary, textAlign: 'center', lineHeight: 22 },
  permCard:     { backgroundColor: colours.surfaceCard, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colours.border },
  permHeading:  { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary, marginBottom: spacing.md },
  permRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  permLabel:    { fontSize: typography.fontSize.sm, color: colours.textSecondary },
  inviteBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md },
  inviteBtnText:{ color: '#fff', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold },
  limitNote:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colours.surfaceCard, borderRadius: borderRadius.md },
  limitNoteText:{ fontSize: typography.fontSize.sm, color: colours.textMuted },
  linksList:    { gap: spacing.sm },
  linksHeading: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary, marginBottom: spacing.xs },
  linkRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colours.surfaceCard, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colours.border },
  linkAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: colours.primaryLight, alignItems: 'center', justifyContent: 'center' },
  linkInfo:     { flex: 1 },
  linkName:     { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  linkPhone:    { fontSize: typography.fontSize.xs, color: colours.textSecondary },
  revokeBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  emptyLinks:   { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText:    { fontSize: typography.fontSize.sm, color: colours.textMuted },
});
