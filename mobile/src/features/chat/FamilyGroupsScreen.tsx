import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import { PressableScale } from '../../components/motion';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { useTranslation } from 'react-i18next';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
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
  const { c } = useTheme();
  const cm = React.useMemo(() => makeCm(c), [c]);
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
          <Text variant="title3" color="textPrimary" style={cm.title}>Create Family Group</Text>
          <Text variant="subhead" color="textSecondary" style={cm.hint}>Create a private group to discuss this match with your family. Invite members after creating.</Text>
          <Input
            label="Group Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Our Family Chat"
            autoFocus
            maxLength={50}
            testID="group-name-input"
            accessibilityLabel="Group name"
          />
          <PressableScale
            style={cm.createBtn}
            onPress={handleCreate}
            testID="create-group-btn"
            accessibilityRole="button"
            accessibilityLabel="Create group"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="headline" style={cm.createText}>Create Group</Text>
          </PressableScale>
          <PressableScale
            style={cm.cancelBtn}
            onPress={onClose}
            testID="cancel-create-btn"
            accessibilityRole="button"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="callout" color="textSecondary">Cancel</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const makeCm = (c: ThemeColours) => StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:     { backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing['3xl'] },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
  title:     { marginBottom: spacing.sm },
  hint:      { marginBottom: spacing.lg },
  createBtn: { backgroundColor: c.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  createText:{ color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
});

// ─── Group row ─────────────────────────────────────────────────────────────────

function GroupRow({ group, onPress }: { group: FamilyGroup; onPress: () => void }) {
  const { c } = useTheme();
  const gr = React.useMemo(() => makeGr(c), [c]);
  return (
    <PressableScale
      style={gr.row}
      onPress={onPress}
      testID={`group-row-${group.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${group.name} group chat`}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={gr.avatar}>
        <Ionicons name="people" size={20} color="#fff" />
      </View>
      <View style={gr.info}>
        <Text variant="headline" color="textPrimary">{group.name}</Text>
        <Text variant="caption" color="textSecondary" style={gr.sub}>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </PressableScale>
  );
}

const makeGr = (c: ThemeColours) => StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  info:   { flex: 1 },
  sub:    { marginTop: 2 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FamilyGroupsScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
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
        <PressableScale
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          testID="back-btn"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <Text variant="title3" color="textPrimary">Family Chat</Text>
        <PressableScale
          style={s.addBtn}
          onPress={() => setShowCreate(true)}
          testID="add-group-btn"
          accessibilityRole="button"
          accessibilityLabel="Create family group"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add" size={24} color={c.primary} />
        </PressableScale>
      </View>

      {/* Intro */}
      <View style={s.banner}>
        <Ionicons name="people-circle-outline" size={28} color={c.primary} />
        <Text variant="subhead" color="textSecondary" style={s.bannerText}>
          Invite family members to a private group chat. Discuss matches together before making decisions.
        </Text>
      </View>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : (
        <FlatList
          data={groups ?? []}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => <GroupRow group={item} onPress={() => openGroup(item)} />}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="chatbubbles-outline" size={52} color={c.textMuted} />
              <Text variant="title3" color="textSecondary">No Family Groups Yet</Text>
              <Text variant="subhead" color="textMuted" style={s.emptyHint}>Create a group and invite your parents or siblings to discuss matches together.</Text>
              <PressableScale
                style={s.createCta}
                onPress={() => setShowCreate(true)}
                testID="create-cta-btn"
                accessibilityRole="button"
                accessibilityLabel="Create first group"
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: spacing.sm }} />
                <Text variant="callout" style={s.ctaText}>Create Family Group</Text>
              </PressableScale>
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

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:    { flex: 1, backgroundColor: c.background },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  banner:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: c.primaryLight, padding: spacing.lg },
  bannerText: { flex: 1 },
  emptyState: { alignItems: 'center', gap: spacing.md, paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyHint:  { textAlign: 'center' },
  createCta:  { flexDirection: 'row', alignItems: 'center', backgroundColor: c.primary, borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  ctaText:    { color: '#fff' },
});
