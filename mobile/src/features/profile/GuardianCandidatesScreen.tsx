import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { EmptyState, ScreenHeader } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { spacing, type ThemeColours } from '@shared/constants/theme';
import { getGuardianCandidates, type GuardianLink } from '../../api/guardian';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import { LIST_PERF } from '../../constants/listPerf';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// Decorative glyphs sit beside a text label; the screen reader reads the label.
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

function CandidateRow({ link, onPress }: { link: GuardianLink; onPress: () => void }) {
  const { c } = useTheme();
  const cr = React.useMemo(() => makeCr(c), [c]);
  return (
    <PressableScale
      style={cr.row}
      onPress={onPress}
      testID={`candidate-row-${link.id}`}
      accessibilityLabel={`View ${link.guardianName}'s matches`}
      accessibilityRole="button"
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={cr.avatar} {...HIDE_FROM_A11Y}>
        <Ionicons name="person" size={20} color={c.primary} />
      </View>
      <View style={cr.info}>
        <Text variant="headline" color="textPrimary" numberOfLines={1}>{link.guardianName}</Text>
        <Text variant="footnote" color="textSecondary" style={cr.sub}>You are a guardian for this person</Text>
      </View>
      <View style={cr.viewBtn} {...HIDE_FROM_A11Y}>
        <Text variant="caption" color="primary">Browse</Text>
        <Ionicons name="chevron-forward" size={16} color={c.primary} />
      </View>
    </PressableScale>
  );
}

const makeCr = (c: ThemeColours) => StyleSheet.create({
  // minHeight, not height: a bigger OS text size must grow the row, never clip it.
  row:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: 72, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  avatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
  info:    { flex: 1 },
  sub:     { marginTop: 2 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});

export default function GuardianCandidatesScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const navigation = useNavigation<Nav>();

  const { data: candidates, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.guardianCandidates,
    queryFn: getGuardianCandidates,
    staleTime: 2 * 60 * 1000,
  });

  const activeLinks = candidates?.filter((l) => l.status === 'active') ?? [];

  const openCandidate = (link: GuardianLink) => {
    navigation.navigate('GuardianView', {
      candidateId: link.candidateId,
      candidateName: link.guardianName,
    });
  };

  return (
    <Screen edges={['top', 'bottom']} style={s.wrapper} testID="GuardianCandidatesScreen">
      <ScreenHeader title="Guardian dashboard" testID="guardian-candidates-header" />

      <View style={s.banner}>
        <Ionicons name="shield-half-outline" size={24} color={c.primary} {...HIDE_FROM_A11Y} />
        <Text variant="footnote" color="textSecondary" style={s.bannerText}>You are a guardian for the people listed below. You can see the names and cities of their matches, but cannot act on them.</Text>
      </View>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError && !candidates ? (
        <EmptyState
          variant="error"
          icon="cloud-offline-outline"
          title="Couldn't load guardian links"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => refetch()}
          testID="GuardianCandidatesScreen-error"
        />
      ) : (
        <FlatList
          {...LIST_PERF}
          data={activeLinks}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <CandidateRow link={item} onPress={() => openCandidate(item)} />}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={c.primary} colors={[c.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No active guardian links"
              description="When someone invites you as their guardian, they will appear here."
              actionLabel="Refresh"
              onAction={() => refetch()}
              testID="GuardianCandidatesScreen-empty"
            />
          }
        />
      )}
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:    { backgroundColor: c.background },
  banner:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: c.primaryLight, padding: spacing.lg },
  bannerText: { flex: 1 },
});
