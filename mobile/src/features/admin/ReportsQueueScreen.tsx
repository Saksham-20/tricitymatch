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
import { getReportsQueue, updateReport, updateUserStatus } from '../../api/admin';

interface ReportItem {
  id: string;
  reporterId: string;
  reportedUserId: string;
  category: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
  reporterName?: string;
  reportedName?: string;
}

const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  fake_profile:    'person-remove-outline',
  harassment:      'warning-outline',
  inappropriate:   'eye-off-outline',
  spam:            'mail-unread-outline',
  scam:            'card-outline',
  underage:        'alert-circle-outline',
};

function ReportCard({
  item,
  onDismiss,
  onBlock,
}: {
  item: ReportItem;
  onDismiss: (id: string) => void;
  onBlock: (reportId: string, userId: string, name: string) => void;
}) {
  const iconName = CATEGORY_ICONS[item.category] ?? 'flag-outline';
  const label = item.category.replace(/_/g, ' ');

  return (
    <View style={s.card} testID={`report-card-${item.id}`}>
      <View style={s.cardHeader}>
        <View style={s.categoryRow}>
          <Ionicons name={iconName} size={16} color={colours.warning} />
          <Text style={s.categoryText}>{label}</Text>
        </View>
        <Text style={s.cardDate}>{new Date(item.createdAt).toLocaleDateString('en-IN')}</Text>
      </View>

      <View style={s.namesRow}>
        <Text style={s.nameLabel}>Reported:</Text>
        <Text style={s.nameValue}>{item.reportedName ?? item.reportedUserId}</Text>
      </View>
      <View style={s.namesRow}>
        <Text style={s.nameLabel}>By:</Text>
        <Text style={s.nameValue}>{item.reporterName ?? item.reporterId}</Text>
      </View>

      {item.description ? (
        <Text style={s.desc} numberOfLines={3}>{item.description}</Text>
      ) : null}

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.btn, s.dismissBtn]}
          onPress={() => onDismiss(item.id)}
          testID={`dismiss-btn-${item.id}`}
          accessibilityLabel="Dismiss report"
        >
          <Ionicons name="close-circle-outline" size={16} color={colours.textSecondary} />
          <Text style={[s.btnText, { color: colours.textSecondary }]}>Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btn, s.blockBtn]}
          onPress={() => onBlock(item.id, item.reportedUserId, item.reportedName ?? 'User')}
          testID={`block-btn-${item.id}`}
          accessibilityLabel="Block user"
        >
          <Ionicons name="ban-outline" size={16} color="#fff" />
          <Text style={[s.btnText, { color: '#fff' }]}>Suspend</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ReportsQueueScreen() {
  const nav = useNavigation();
  const qc = useQueryClient();
  const [blockTarget, setBlockTarget] = useState<{ reportId: string; userId: string; name: string } | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery<ReportItem[]>({
    queryKey: ['admin', 'reportsQueue'],
    queryFn: getReportsQueue,
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => updateReport(id, 'dismissed'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reportsQueue'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: () => Alert.alert('Error', 'Failed to dismiss. Try again.'),
  });

  const blockMut = useMutation({
    mutationFn: ({ reportId, userId, notes }: { reportId: string; userId: string; notes: string }) =>
      Promise.all([
        updateReport(reportId, 'reviewed', notes || undefined),
        updateUserStatus(userId, 'suspended'),
      ]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reportsQueue'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setBlockTarget(null);
      setAdminNotes('');
    },
    onError: () => Alert.alert('Error', 'Failed to suspend user. Try again.'),
  });

  const handleDismiss = (id: string) => {
    Alert.alert('Dismiss Report', 'Mark this report as dismissed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Dismiss', onPress: () => dismissMut.mutate(id) },
    ]);
  };

  const handleBlockOpen = (reportId: string, userId: string, name: string) => {
    setBlockTarget({ reportId, userId, name });
    setAdminNotes('');
  };

  const handleBlockConfirm = () => {
    if (!blockTarget) return;
    blockMut.mutate({ reportId: blockTarget.reportId, userId: blockTarget.userId, notes: adminNotes });
  };

  const mutPending = dismissMut.isPending || blockMut.isPending;

  return (
    <SafeAreaView style={s.safe} testID="ReportsQueueScreen">
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Reports Queue</Text>
        {isLoading && <ActivityIndicator size="small" color={colours.primary} />}
      </View>

      {isLoading ? (
        <ActivityIndicator style={s.loader} color={colours.primary} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReportCard item={item} onDismiss={handleDismiss} onBlock={handleBlockOpen} />
          )}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="shield-checkmark-outline" size={48} color={colours.textMuted} />
              <Text style={s.emptyText}>No open reports</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={!!blockTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockTarget(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Suspend User</Text>
            <Text style={s.modalSub}>
              Suspend <Text style={s.modalBold}>{blockTarget?.name}</Text> and mark report as reviewed?
            </Text>
            <TextInput
              style={s.notesInput}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder="Admin notes (optional)..."
              placeholderTextColor={colours.textMuted}
              multiline
              maxLength={300}
              testID="admin-notes-input"
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setBlockTarget(null)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirm, mutPending && s.disabled]}
                onPress={handleBlockConfirm}
                disabled={mutPending}
                testID="block-confirm-btn"
              >
                {mutPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.modalConfirmText}>Suspend</Text>
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
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  categoryText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.warning,
    textTransform: 'capitalize',
  },
  cardDate: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
  },
  namesRow: { flexDirection: 'row', gap: spacing.xs },
  nameLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textSecondary,
    width: 60,
  },
  nameValue: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  desc: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    fontStyle: 'italic',
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
  dismissBtn: { borderWidth: 1, borderColor: colours.border },
  blockBtn: { backgroundColor: '#EF4444' },
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
  notesInput: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    minHeight: 60,
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
