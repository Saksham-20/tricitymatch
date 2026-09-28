import React, { useCallback, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  AccessibilityInfo,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Screen from '../../components/layout/Screen';
import { PressableScale, useReduceMotion } from '../../components/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { Button, EmptyState } from '../../components/ui';
import { spacing, type ThemeColours } from '@shared/constants/theme';
import { getFamilyGroups, createFamilyGroup, type FamilyGroup } from '../../api/chat';
import { queryKeys } from '../../constants/queryKeys';
import { showToast } from '../../utils/toast';
import { tapSize } from '../../utils/elderTheme';
import type { MainStackParamList } from '../../navigation/types';
import { LIST_PERF } from '../../constants/listPerf';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Create Group Modal ────────────────────────────────────────────────────────

function CreateGroupModal({ visible, onClose, onCreate }: {
  visible: boolean;
  onClose: () => void;
  /** Resolves once the group exists; rejects if it could not be created. */
  onCreate: (name: string) => Promise<unknown>;
}) {
  const { c } = useTheme();
  const cm = React.useMemo(() => makeCm(c), [c]);
  const reduced = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setName('');
    setError(undefined);
    onClose();
  };

  // An inline error is plain text: unlike the native alert it replaced, nothing
  // speaks it, and focus stays on the button that was just pressed. Say it.
  const fail = (message: string) => {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  // Validation and failure both stay inside the sheet as an inline error under
  // the field. They used to be two native alert popups, and a failed create
  // closed the sheet and threw the typed name away.
  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) { fail('Enter a group name.'); return; }
    setBusy(true);
    setError(undefined);
    try {
      await onCreate(trimmed);
      setName('');
      onClose();
    } catch {
      fail("Couldn't create the group. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    // Reduce Motion: a fade, never a slide (doctrine §10.2 ruling 18).
    <Modal visible={visible} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={close}>
      {/* The name field autofocuses; without this the keyboard covers Create. */}
      <KeyboardAvoidingView style={cm.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Tap outside to dismiss. Cancel is the reader's way out, so the backdrop
            stays out of the accessibility tree rather than being a second one. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessible={false}
          importantForAccessibility="no"
          testID="create-group-backdrop"
        />
        {/* No drag handle: the sheet does not drag, so a handle would promise a
            gesture that is not there. The bottom padding clears the home
            indicator / 3-button bar (it was a flat 32). */}
        <View style={[cm.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) + spacing.lg }]}>
          <Text variant="title3" color="textPrimary" style={cm.title} accessibilityRole="header">Create family group</Text>
          <Text variant="subhead" color="textSecondary" style={cm.hint}>Create a private group to talk through matches with your family. You can add members after creating it.</Text>
          <Input
            label="Group name"
            value={name}
            onChangeText={(v) => { setName(v); if (error) setError(undefined); }}
            placeholder="e.g. Our family chat"
            autoFocus
            maxLength={50}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
            error={error}
            testID="group-name-input"
            accessibilityLabel="Group name"
          />
          <Button
            title="Create family group"
            onPress={handleCreate}
            loading={busy}
            style={cm.createBtn}
            testID="create-group-btn"
          />
          <Button
            title="Cancel"
            variant="text"
            onPress={close}
            disabled={busy}
            testID="cancel-create-btn"
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeCm = (c: ThemeColours) => StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
  // paddingBottom is applied inline (it depends on the bottom safe-area inset).
  sheet:     { backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl },
  title:     { marginBottom: spacing.sm },
  hint:      { marginBottom: spacing.lg },
  createBtn: { marginBottom: spacing.sm },
});

// ─── Group row ─────────────────────────────────────────────────────────────────

function GroupRow({ group, onPress }: { group: FamilyGroup; onPress: () => void }) {
  const { c } = useTheme();
  const gr = React.useMemo(() => makeGr(c), [c]);
  const n = group.members.length;
  const members = `${n} member${n !== 1 ? 's' : ''}`;
  return (
    <PressableScale
      style={gr.row}
      onPress={onPress}
      testID={`group-row-${group.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${members}`}
      accessibilityHint="Opens the group chat"
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={gr.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="people" size={20} color={c.onPrimary} />
      </View>
      <View style={gr.info}>
        <Text variant="headline" color="textPrimary">{group.name}</Text>
        <Text variant="caption" color="textSecondary" style={gr.sub}>{members}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    </PressableScale>
  );
}

const makeGr = (c: ThemeColours) => StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.p500, alignItems: 'center', justifyContent: 'center' },
  info:   { flex: 1 },
  sub:    { marginTop: 2 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FamilyGroupsScreen() {
  const { c, elder } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const tap = tapSize(elder);
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: groups, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.familyGroups,
    queryFn: getFamilyGroups,
    staleTime: 60 * 1000,
  });

  // Failure is handled inside the sheet (it stays open with the name intact),
  // so there is deliberately no onError alert here.
  const createMutation = useMutation({
    mutationFn: createFamilyGroup,
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familyGroups });
      showToast.success('Family group created', group?.name);
    },
  });

  const openGroup = (group: FamilyGroup) => {
    navigation.navigate('FamilyGroupChat', {
      groupId: group.id,
      groupName: group.name,
      memberCount: group.members.length,
    });
  };

  const isEmpty = (groups?.length ?? 0) === 0;

  // The spinner belongs to the pull that asked for it, not to every background
  // refetch (focus, invalidate) that used to draw it unprompted.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    // No native header on this stack (headerShown:false), so Screen supplies the
    // safe-area padding. The header used to draw under the status bar and notch.
    <Screen edges={['top', 'bottom']} testID="FamilyGroupsScreen">
      {/* Header */}
      <View style={s.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={[s.iconBtn, { width: tap, height: tap }]}
          testID="back-btn"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <Text variant="title3" color="textPrimary" numberOfLines={1} style={s.title} accessibilityRole="header">Family groups</Text>
        <PressableScale
          style={[s.iconBtn, { width: tap, height: tap }]}
          onPress={() => setShowCreate(true)}
          testID="add-group-btn"
          accessibilityRole="button"
          accessibilityLabel="Create family group"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add" size={24} color={c.primary} />
        </PressableScale>
      </View>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : isError && !groups ? (
        <EmptyState
          variant="error"
          icon="people-outline"
          title="Couldn't load family groups"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => refetch()}
          testID="FamilyGroupsScreen-error"
        />
      ) : (
        <FlatList
          {...LIST_PERF}
          data={groups ?? []}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => <GroupRow group={item} onPress={() => openGroup(item)} />}
          // The intro lives in the list, only when there are groups: the empty state
          // already says the same thing, and pinned above the list it ate the
          // viewport at a large OS text size. Scrolling it away is the point.
          ListHeaderComponent={isEmpty ? null : (
            <View style={s.banner}>
              <Ionicons name="people-circle-outline" size={28} color={c.primary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
              <Text variant="subhead" color="textSecondary" style={s.bannerText}>
                Add family members to a private group chat. Talk through matches together before you decide.
              </Text>
            </View>
          )}
          contentContainerStyle={isEmpty ? s.emptyContainer : undefined}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.accent]} tintColor={c.accent} />}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No family groups yet"
              description="Create a group and add your parents or siblings to talk through matches together."
              actionLabel="Create family group"
              onAction={() => setShowCreate(true)}
              testID="FamilyGroupsScreen-empty"
            />
          }
        />
      )}

      <CreateGroupModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(name) => createMutation.mutateAsync(name)}
      />
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  // Size (48 / 60 elder) is applied inline from tapSize().
  iconBtn:    { alignItems: 'center', justifyContent: 'center' },
  title:      { flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  banner:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: c.surface2, padding: spacing.lg },
  bannerText: { flex: 1 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
});
