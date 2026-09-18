import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { getVerificationQueue, approveVerification, rejectVerification } from '../../api/admin';
import SmartImage from '../../components/common/SmartImage';
import type { Verification } from '../../types';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import { PressableScale } from '../../components/motion';

/**
 * Matches what `GET /admin/verifications` returns: the reviewed user arrives
 * nested as `User` (with `Profile`), not as flat `userName` / `userEmail`, which
 * the server has never sent — so every card read "User" with no email.
 *
 * The card also showed a document-type badge and a document filename. Govt-ID
 * collection was removed on 2026-07-02; those columns are dormant and always
 * null now, so the badge read "Unknown" on every row and the filename never
 * rendered. Verification is a selfie-to-profile-photo comparison, and this
 * screen could not show either image — an admin literally could not do the job
 * from mobile. It now puts the two side by side.
 */
interface VerifItem extends Verification {
  User?: {
    id: string;
    email?: string;
    Profile?: { firstName?: string; lastName?: string; profilePhoto?: string | null; photos?: string[] } | null;
  } | null;
}

const nameOf = (item: VerifItem): string => {
  const p = item.User?.Profile;
  return [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || 'User';
};

function VerifCard({
  item,
  onApprove,
  onReject,
}: {
  item: VerifItem;
  onApprove: (id: string) => void;
  onReject: (id: string, name: string) => void;
}) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const name = nameOf(item);
  const profilePhoto = item.User?.Profile?.profilePhoto ?? item.User?.Profile?.photos?.[0] ?? null;

  return (
    <View style={s.card} testID={`verif-card-${item.id}`}>
      <View style={s.cardHeader}>
        <Text variant="headline" color="textPrimary">{name}</Text>
        <Text variant="footnote" color="textSecondary">{new Date(item.createdAt).toLocaleDateString('en-IN')}</Text>
      </View>
      {item.User?.email ? <Text variant="footnote" color="textSecondary">{item.User.email}</Text> : null}

      {/* The actual review: submitted selfie against the profile photo. */}
      <View style={s.compareRow}>
        <View style={s.compareCell}>
          <Text variant="caption" color="textSecondary" style={s.compareLabel}>Selfie</Text>
          <SmartImage uri={item.selfiePhoto ?? undefined} name={name} style={s.compareImg} />
        </View>
        <View style={s.compareCell}>
          <Text variant="caption" color="textSecondary" style={s.compareLabel}>Profile photo</Text>
          <SmartImage uri={profilePhoto ?? undefined} name={name} style={s.compareImg} />
        </View>
      </View>

      <View style={s.actions}>
        <PressableScale
          style={[s.btn, s.rejectBtn]}
          onPress={() => onReject(item.id, nameOf(item))}
          testID={`reject-btn-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel="Reject verification"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color={c.error} />
          <Text variant="caption" color="error">Reject</Text>
        </PressableScale>
        <PressableScale
          style={[s.btn, s.approveBtn]}
          onPress={() => onApprove(item.id)}
          testID={`approve-btn-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel="Approve verification"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text variant="caption" style={{ color: '#fff' }}>Approve</Text>
        </PressableScale>
      </View>
    </View>
  );
}

export default function VerificationQueueScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const nav = useNavigation();
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery<VerifItem[]>({
    queryKey: ['admin', 'verificationQueue'],
    queryFn: getVerificationQueue,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveVerification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'verificationQueue'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: () => Alert.alert('Error', 'Failed to approve. Try again.'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, r }: { id: string; r: string }) => rejectVerification(id, r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'verificationQueue'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setRejectTarget(null);
      setReason('');
    },
    onError: () => Alert.alert('Error', 'Failed to reject. Try again.'),
  });

  const handleApprove = (id: string) => {
    Alert.alert('Approve Verification', 'Confirm approval?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveMut.mutate(id) },
    ]);
  };

  const handleRejectOpen = (id: string, name: string) => {
    setRejectTarget({ id, name });
    setReason('');
  };

  const handleRejectConfirm = () => {
    if (!rejectTarget) return;
    if (!reason.trim()) { Alert.alert('Reason required', 'Enter a rejection reason.'); return; }
    rejectMut.mutate({ id: rejectTarget.id, r: reason.trim() });
  };

  const mutPending = approveMut.isPending || rejectMut.isPending;

  return (
    <SafeAreaView style={s.safe} testID="VerificationQueueScreen">
      <View style={s.header}>
        <PressableScale
          onPress={() => nav.goBack()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <Text variant="title3" color="textPrimary" style={s.title}>Verification Queue</Text>
        {isLoading && <ActivityIndicator size="small" color={c.primary} />}
      </View>

      {isLoading ? (
        <ActivityIndicator style={s.loader} color={c.primary} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VerifCard item={item} onApprove={handleApprove} onReject={handleRejectOpen} />
          )}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={c.textMuted} />
              <Text variant="subhead" color="textMuted">Queue is clear</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={!!rejectTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text variant="title3" color="textPrimary">Reject Verification</Text>
            <Text variant="footnote" color="textSecondary">
              Rejecting <Text variant="caption" color="textPrimary">{rejectTarget?.name}</Text>. Provide a reason:
            </Text>
            <Input
              style={s.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Document unclear, mismatch with profile..."
              multiline
              maxLength={300}
              testID="reject-reason-input"
            />
            <View style={s.modalActions}>
              <PressableScale
                style={s.modalCancel}
                onPress={() => setRejectTarget(null)}
                accessibilityRole="button"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text variant="subhead" color="textSecondary">Cancel</Text>
              </PressableScale>
              <PressableScale
                style={[s.modalConfirm, mutPending && s.disabled]}
                onPress={handleRejectConfirm}
                disabled={mutPending}
                testID="reject-confirm-btn"
                accessibilityRole="button"
                accessibilityLabel="Confirm reject"
                accessibilityState={{ disabled: mutPending }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {mutPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text variant="caption" style={{ color: '#fff' }}>Reject</Text>
                )}
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  title: {
    flex: 1,
  },
  loader: { marginTop: spacing.xl },
  list: { padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compareRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  compareCell: { flex: 1, gap: 4 },
  compareLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  compareImg: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    backgroundColor: c.surfaceCard,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  rejectBtn: { borderWidth: 1, borderColor: c.error },
  approveBtn: { backgroundColor: c.success },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  reasonInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancel: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: c.error,
    borderRadius: borderRadius.sm,
  },
  disabled: { opacity: 0.6 },
});
