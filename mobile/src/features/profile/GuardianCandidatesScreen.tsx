import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Text from '../../components/ui/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { EmptyState } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { useTranslation } from 'react-i18next';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { getGuardianCandidates, type GuardianLink } from '../../api/guardian';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

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
      <View style={cr.avatar}>
        <Ionicons name="person" size={20} color={c.primary} />
      </View>
      <View style={cr.info}>
        <Text variant="headline" color="textPrimary">{link.guardianName}</Text>
        <Text variant="footnote" color="textSecondary" style={cr.sub}>You are a guardian for this person</Text>
      </View>
      <View style={cr.viewBtn}>
        <Text variant="caption" color="primary">Browse</Text>
        <Ionicons name="chevron-forward" size={16} color={c.primary} />
      </View>
    </PressableScale>
  );
}

const makeCr = (c: ThemeColours) => StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  avatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
  info:    { flex: 1 },
  sub:     { marginTop: 2 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});

export default function GuardianCandidatesScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const { t } = useTranslation();
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
    <View style={s.wrapper} testID="GuardianCandidatesScreen">
      <View style={s.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          testID="back-btn"
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <Text variant="title3" color="textPrimary">Guardian Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.banner}>
        <Ionicons name="shield-half-outline" size={24} color={c.primary} />
        <Text variant="footnote" color="textSecondary" style={s.bannerText}>You are a guardian for the people listed below. Browse their matches — read only.</Text>
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
          data={activeLinks}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <CandidateRow link={item} onPress={() => openCandidate(item)} />}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={c.primary} />
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="people-outline" size={52} color={c.textMuted} />
              <Text variant="title3" color="textSecondary">No Active Guardian Links</Text>
              <Text variant="footnote" color="textMuted" style={s.emptyHint}>When someone invites you as their guardian, they will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:    { flex: 1, backgroundColor: c.background },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  banner:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: c.primaryLight, padding: spacing.lg },
  bannerText: { flex: 1 },
  emptyState: { alignItems: 'center', gap: spacing.md, paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyHint:  { textAlign: 'center' },
});
