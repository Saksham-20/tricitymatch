import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getBureauClients } from '../../api/bureau';
import type { BureauClient } from '../../types';
import type { BureauStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<BureauStackParamList>;

function ClientCard({ client, onPropose }: { client: BureauClient; onPropose: (id: string) => void }) {
  const p = client.profile;
  const age = p.dateOfBirth
    ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <View style={s.card} testID={`client-card-${client.id}`}>
      <View style={s.cardTop}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{([p.firstName, p.lastName].filter(Boolean).join(' ') ?? 'U')[0].toUpperCase()}</Text>
        </View>
        <View style={s.cardInfo}>
          <Text style={s.cardName}>{[p.firstName, p.lastName].filter(Boolean).join(' ') ?? 'Unknown'}</Text>
          <Text style={s.cardMeta}>
            {[age ? `${age} yrs` : null, p.city, p.profession].filter(Boolean).join(' • ')}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={s.proposeBtn}
        onPress={() => onPropose(client.userId)}
        testID={`propose-btn-${client.id}`}
        accessibilityLabel="Create proposal for client"
      >
        <Ionicons name="git-compare-outline" size={14} color={colours.primary} />
        <Text style={s.proposeBtnText}>Propose Match</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ClientRosterScreen() {
  const nav = useNavigation<Nav>();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery<BureauClient[]>({
    queryKey: ['bureau', 'clients'],
    queryFn: getBureauClients,
  });

  const filtered = (data ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      [c.profile?.firstName, c.profile?.lastName].filter(Boolean).join(' ').toLowerCase().includes(q) ||
      c.profile?.city?.toLowerCase().includes(q) ||
      c.profile?.profession?.toLowerCase().includes(q)
    );
  });

  const handlePropose = (clientUserId: string) => {
    nav.navigate('MatchProposal', { profileId: clientUserId });
  };

  return (
    <SafeAreaView style={s.safe} testID="ClientRosterScreen">
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Client Roster</Text>
        {isLoading && <ActivityIndicator size="small" color={colours.primary} />}
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={18} color={colours.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search clients..."
          placeholderTextColor={colours.textMuted}
          testID="client-search"
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={s.loader} color={colours.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ClientCard client={item} onPropose={handlePropose} />}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={48} color={colours.textMuted} />
              <Text style={s.emptyText}>{search ? 'No clients match' : 'No clients yet'}</Text>
            </View>
          }
        />
      )}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textPrimary,
  },
  loader: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  card: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colours.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.primary,
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  cardMeta: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    marginTop: 2,
  },
  proposeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colours.primary,
    borderRadius: borderRadius.sm,
  },
  proposeBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.primary,
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colours.textMuted,
  },
});
