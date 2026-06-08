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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getBureauClients, createMatchProposal } from '../../api/bureau';
import { search as searchProfiles } from '../../api/search';
import type { BureauClient, ProfileSummary } from '../../types';
import type { BureauStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'MatchProposal'>;
type RouteT = RouteProp<BureauStackParamList, 'MatchProposal'>;

function ProfilePickerItem({
  profile,
  selected,
  onSelect,
}: {
  profile: ProfileSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  return (
    <TouchableOpacity
      style={[s.pickerItem, selected && s.pickerItemSelected]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[s.radioCircle, selected && s.radioCircleSelected]}>
        {selected && <View style={s.radioDot} />}
      </View>
      <View style={s.pickerInfo}>
        <Text style={s.pickerName}>{[profile.firstName, profile.lastName].filter(Boolean).join(' ')}</Text>
        <Text style={s.pickerMeta}>
          {[age ? `${age} yrs` : null, profile.city, profile.profession].filter(Boolean).join(' • ')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MatchProposalScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const qc = useQueryClient();

  // Pre-select client if navigated from ClientRoster
  const preselectedClientUserId = route.params?.profileId ?? '';

  const [clientUserId, setClientUserId] = useState(preselectedClientUserId);
  const [proposedUserId, setProposedUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'client' | 'match' | 'review'>(
    preselectedClientUserId ? 'match' : 'client'
  );
  const [showConfirm, setShowConfirm] = useState(false);

  const clientsQ = useQuery<BureauClient[]>({
    queryKey: ['bureau', 'clients'],
    queryFn: getBureauClients,
  });

  // Search results for match selection (loads all on mount, can filter)
  const matchesQ = useQuery<{ profiles: ProfileSummary[] }>({
    queryKey: ['bureau', 'matchSearch'],
    queryFn: () => searchProfiles({}),
    enabled: step === 'match',
  });

  const proposeMut = useMutation({
    mutationFn: () => createMatchProposal(clientUserId, proposedUserId, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'proposals'] });
      Alert.alert('Proposal Sent', 'Both parties will be notified.', [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
    },
    onError: () => Alert.alert('Error', 'Failed to send proposal. Try again.'),
  });

  const selectedClient = clientsQ.data?.find((c) => c.userId === clientUserId);
  const selectedMatch  = matchesQ.data?.profiles.find((p) => p.id === proposedUserId);

  const handleNext = () => {
    if (step === 'client') {
      if (!clientUserId) { Alert.alert('Select a client first'); return; }
      setStep('match');
    } else if (step === 'match') {
      if (!proposedUserId) { Alert.alert('Select a match first'); return; }
      setStep('review');
    } else {
      setShowConfirm(true);
    }
  };

  const stepLabel = step === 'client' ? 'Step 1: Select Client' : step === 'match' ? 'Step 2: Select Match' : 'Step 3: Review & Send';

  return (
    <SafeAreaView style={s.safe} testID="MatchProposalScreen">
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            if (step === 'match' && !preselectedClientUserId) setStep('client');
            else if (step === 'review') setStep('match');
            else nav.goBack();
          }}
          style={s.backBtn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>New Proposal</Text>
      </View>

      <View style={s.stepBar}>
        {(['client', 'match', 'review'] as const).map((st, i) => (
          <View key={st} style={[s.stepDot, step === st && s.stepDotActive]} />
        ))}
      </View>
      <Text style={s.stepLabel}>{stepLabel}</Text>

      {/* Client selection */}
      {step === 'client' && (
        clientsQ.isLoading ? (
          <ActivityIndicator style={s.loader} color={colours.primary} />
        ) : (
          <FlatList
            data={clientsQ.data ?? []}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <ProfilePickerItem
                profile={item.profile}
                selected={clientUserId === item.userId}
                onSelect={() => setClientUserId(item.userId)}
              />
            )}
            contentContainerStyle={s.list}
            ListEmptyComponent={<Text style={s.emptyText}>No clients registered</Text>}
          />
        )
      )}

      {/* Match selection */}
      {step === 'match' && (
        matchesQ.isLoading ? (
          <ActivityIndicator style={s.loader} color={colours.primary} />
        ) : (
          <FlatList
            data={matchesQ.data?.profiles ?? []}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <ProfilePickerItem
                profile={item}
                selected={proposedUserId === item.id}
                onSelect={() => setProposedUserId(item.id)}
              />
            )}
            contentContainerStyle={s.list}
            ListEmptyComponent={<Text style={s.emptyText}>No profiles found</Text>}
          />
        )
      )}

      {/* Review step */}
      {step === 'review' && (
        <View style={s.reviewCard}>
          <View style={s.reviewRow}>
            <Text style={s.reviewLabel}>Client</Text>
            <Text style={s.reviewValue}>{[selectedClient?.profile.firstName, selectedClient?.profile.lastName].filter(Boolean).join(' ') || clientUserId}</Text>
          </View>
          <View style={s.reviewRow}>
            <Text style={s.reviewLabel}>Proposed</Text>
            <Text style={s.reviewValue}>{[selectedMatch?.firstName, selectedMatch?.lastName].filter(Boolean).join(' ') || proposedUserId}</Text>
          </View>
          <Text style={s.notesLabel}>Notes (optional)</Text>
          <TextInput
            style={s.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note for the client..."
            placeholderTextColor={colours.textMuted}
            multiline
            maxLength={500}
            testID="proposal-notes"
          />
        </View>
      )}

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.nextBtn, proposeMut.isPending && s.disabled]}
          onPress={handleNext}
          disabled={proposeMut.isPending}
          testID="next-btn"
        >
          {proposeMut.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.nextBtnText}>
              {step === 'review' ? 'Send Proposal' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Confirm Proposal</Text>
            <Text style={s.modalBody}>
              Propose <Text style={s.modalBold}>{[selectedMatch?.firstName, selectedMatch?.lastName].filter(Boolean).join(' ')}</Text> to{' '}
              <Text style={s.modalBold}>{[selectedClient?.profile.firstName, selectedClient?.profile.lastName].filter(Boolean).join(' ')}</Text>?
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowConfirm(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalConfirm}
                onPress={() => { setShowConfirm(false); proposeMut.mutate(); }}
                testID="confirm-proposal-btn"
              >
                <Text style={s.modalConfirmText}>Send</Text>
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
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colours.border,
  },
  stepDotActive: { backgroundColor: colours.primary, width: 24 },
  stepLabel: {
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textSecondary,
    marginBottom: spacing.sm,
  },
  loader: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.xs },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerItemSelected: { borderColor: colours.primary, backgroundColor: colours.primary + '08' },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colours.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: colours.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colours.primary,
  },
  pickerInfo: { flex: 1 },
  pickerName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  pickerMeta: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
  },
  reviewCard: {
    margin: spacing.lg,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textSecondary,
    width: 80,
  },
  reviewValue: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
    textAlign: 'right',
  },
  notesLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textSecondary,
    marginTop: spacing.xs,
  },
  notesInput: {
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
  emptyText: {
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textMuted,
    marginTop: spacing.xl,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colours.border,
    marginTop: 'auto',
  },
  nextBtn: {
    backgroundColor: colours.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: '#fff',
  },
  disabled: { opacity: 0.6 },
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
  modalBody: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
  },
  modalBold: { fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
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
    backgroundColor: colours.primary,
    borderRadius: borderRadius.sm,
  },
  modalConfirmText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: '#fff',
  },
});
