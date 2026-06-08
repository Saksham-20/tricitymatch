import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getVerificationQueue, approveVerification, rejectVerification } from '../../api/admin';
import type { Verification, DocumentType } from '../../types';

interface VerifItem extends Verification {
  userName?: string;
  userEmail?: string;
}

const DOC_LABELS: Record<DocumentType, string> = {
  aadhaar:        'Aadhaar',
  pan:            'PAN',
  passport:       'Passport',
  driving_license:'Driving License',
};

const DOC_COLOUR: Record<DocumentType, string> = {
  aadhaar:        colours.primary,
  pan:            '#3B82F6',
  passport:       '#8B5CF6',
  driving_license:'#6B7280',
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
  const docType = item.documentType;
  const tierColor = docType ? (DOC_COLOUR[docType] ?? colours.primary) : colours.primary;
  const tierLabel = docType ? (DOC_LABELS[docType] ?? docType) : 'Unknown';
  return (
    <View style={s.card} testID={`verif-card-${item.id}`}>
      <View style={s.cardHeader}>
        <View style={[s.tierBadge, { backgroundColor: tierColor + '20', borderColor: tierColor }]}>
          <Text style={[s.tierText, { color: tierColor }]}>{tierLabel}</Text>
        </View>
        <Text style={s.cardDate}>{new Date(item.createdAt).toLocaleDateString('en-IN')}</Text>
      </View>

      <Text style={s.cardName}>{item.userName ?? 'User'}</Text>
      {item.userEmail ? <Text style={s.cardEmail}>{item.userEmail}</Text> : null}

      {item.documentFront ? (
        <View style={s.docRow}>
          <Ionicons name="document-outline" size={14} color={colours.textSecondary} />
          <Text style={s.docText} numberOfLines={1}>{item.documentFront.split('/').pop()}</Text>
        </View>
      ) : null}

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.btn, s.rejectBtn]}
          onPress={() => onReject(item.id, item.userName ?? 'User')}
          testID={`reject-btn-${item.id}`}
          accessibilityLabel="Reject verification"
        >
          <Ionicons name="close" size={16} color="#EF4444" />
          <Text style={[s.btnText, { color: '#EF4444' }]}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btn, s.approveBtn]}
          onPress={() => onApprove(item.id)}
          testID={`approve-btn-${item.id}`}
          accessibilityLabel="Approve verification"
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={[s.btnText, { color: '#fff' }]}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function VerificationQueueScreen() {
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
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Verification Queue</Text>
        {isLoading && <ActivityIndicator size="small" color={colours.primary} />}
      </View>

      {isLoading ? (
        <ActivityIndicator style={s.loader} color={colours.primary} />
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
              <Ionicons name="checkmark-circle-outline" size={48} color={colours.textMuted} />
              <Text style={s.emptyText}>Queue is clear</Text>
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
            <Text style={s.modalTitle}>Reject Verification</Text>
            <Text style={s.modalSub}>
              Rejecting <Text style={s.modalBold}>{rejectTarget?.name}</Text>. Provide a reason:
            </Text>
            <TextInput
              style={s.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Document unclear, mismatch with profile..."
              placeholderTextColor={colours.textMuted}
              multiline
              maxLength={300}
              testID="reject-reason-input"
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setRejectTarget(null)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirm, mutPending && s.disabled]}
                onPress={handleRejectConfirm}
                disabled={mutPending}
                testID="reject-confirm-btn"
              >
                {mutPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.modalConfirmText}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  title: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  loader: { marginTop: spacing.xl },
  list: { padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  tierText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold },
  cardDate: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
  },
  cardName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  cardEmail: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
  },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  docText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
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
  rejectBtn: { borderWidth: 1, borderColor: '#EF4444' },
  approveBtn: { backgroundColor: colours.success },
  btnText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colours.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  modalSub: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
  },
  modalBold: { fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  reasonInput: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textPrimary,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancel: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
  },
  modalCancelText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textSecondary,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: borderRadius.sm,
  },
  modalConfirmText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: '#fff',
  },
  disabled: { opacity: 0.6 },
});
