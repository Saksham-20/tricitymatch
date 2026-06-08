import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import { getFamilyGroups, createFamilyGroup, type FamilyGroup } from '../../api/chat';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Create Group Modal ────────────────────────────────────────────────────────

function CreateGroupModal({ visible, onClose, onCreate }: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Required', 'Enter a group name.'); return; }
    onCreate(trimmed);
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cm.overlay}>
        <View style={cm.sheet}>
          <View style={cm.handle} />
          <Text style={cm.title}>Create Family Group</Text>
          <Text style={cm.hint}>Create a private group to discuss this match with your family. Invite members after creating.</Text>
          <Text style={cm.label}>Group Name</Text>
          <TextInput
            style={cm.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Our Family Chat"
            autoFocus
            maxLength={50}
            testID="group-name-input"
            accessibilityLabel="Group name"
          />
          <TouchableOpacity style={cm.createBtn} onPress={handleCreate} testID="create-group-btn" accessibilityLabel="Create group">
            <Text style={cm.createText}>Create Group</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cm.cancelBtn} onPress={onClose} testID="cancel-create-btn">
            <Text style={cm.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:     { backgroundColor: colours.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing['3xl'] },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: colours.border, alignSelf: 'center', marginBottom: spacing.lg },
  title:     { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginBottom: spacing.sm },
  hint:      { fontSize: typography.fontSize.sm, color: colours.textSecondary, marginBottom: spacing.lg, lineHeight: 20 },
  label:     { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold, color: colours.textSecondary, marginBottom: spacing.xs },
  input:     { borderWidth: 1, borderColor: colours.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.fontSize.base, color: colours.textPrimary, marginBottom: spacing.lg },
  createBtn: { backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  createText:{ color: '#fff', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText:{ fontSize: typography.fontSize.base, color: colours.textSecondary },
});

// ─── Group row ─────────────────────────────────────────────────────────────────

function GroupRow({ group, onPress }: { group: FamilyGroup; onPress: () => void }) {
  return (
    <TouchableOpacity style={gr.row} onPress={onPress} testID={`group-row-${group.id}`} accessibilityLabel={`Open ${group.name} group chat`}>
      <View style={gr.avatar}>
        <Ionicons name="people" size={20} color="#fff" />
      </View>
      <View style={gr.info}>
        <Text style={gr.name}>{group.name}</Text>
        <Text style={gr.sub}>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colours.textMuted} />
    </TouchableOpacity>
  );
}

const gr = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colours.background, borderBottomWidth: 1, borderBottomColor: colours.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center' },
  info:   { flex: 1 },
  name:   { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  sub:    { fontSize: typography.fontSize.xs, color: colours.textSecondary, marginTop: 2 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FamilyGroupsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: groups, isLoading } = useQuery({
    queryKey: queryKeys.familyGroups,
    queryFn: getFamilyGroups,
    staleTime: 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createFamilyGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familyGroups });
    },
    onError: () => Alert.alert('Error', 'Failed to create group. Please try again.'),
  });

  const openGroup = (group: FamilyGroup) => {
    navigation.navigate('FamilyGroupChat', {
      groupId: group.id,
      groupName: group.name,
      memberCount: group.members.length,
    });
  };

  return (
    <View style={s.wrapper} testID="FamilyGroupsScreen">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} testID="back-btn" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Family Chat</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setShowCreate(true)}
          testID="add-group-btn"
          accessibilityLabel="Create family group"
        >
          <Ionicons name="add" size={24} color={colours.primary} />
        </TouchableOpacity>
      </View>

      {/* Intro */}
      <View style={s.banner}>
        <Ionicons name="people-circle-outline" size={28} color={colours.primary} />
        <Text style={s.bannerText}>
          Invite family members to a private group chat. Discuss matches together before making decisions.
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colours.primary} style={{ marginTop: spacing['3xl'] }} />
      ) : (
        <FlatList
          data={groups ?? []}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => <GroupRow group={item} onPress={() => openGroup(item)} />}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="chatbubbles-outline" size={52} color={colours.textMuted} />
              <Text style={s.emptyTitle}>No Family Groups Yet</Text>
              <Text style={s.emptyHint}>Create a group and invite your parents or siblings to discuss matches together.</Text>
              <TouchableOpacity
                style={s.createCta}
                onPress={() => setShowCreate(true)}
                testID="create-cta-btn"
                accessibilityLabel="Create first group"
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: spacing.sm }} />
                <Text style={s.ctaText}>Create Family Group</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <CreateGroupModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(name) => createMutation.mutate(name)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:    { flex: 1, backgroundColor: colours.background },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colours.background, borderBottomWidth: 1, borderBottomColor: colours.border },
  backBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  addBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  banner:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colours.primaryLight, padding: spacing.lg },
  bannerText: { flex: 1, fontSize: typography.fontSize.sm, color: colours.textSecondary, lineHeight: 20 },
  emptyState: { alignItems: 'center', gap: spacing.md, paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.semiBold, color: colours.textSecondary },
  emptyHint:  { fontSize: typography.fontSize.sm, color: colours.textMuted, textAlign: 'center', lineHeight: 20 },
  createCta:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  ctaText:    { color: '#fff', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold },
});
