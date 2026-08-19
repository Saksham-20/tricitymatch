import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import SmartImage from '../../components/common/SmartImage';
import { getSuccessStories, type SuccessStory } from '../../api/profile';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function StoryCard({ story }: { story: SuccessStory }) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.card} testID={`story-${story.id}`}>
      <SmartImage uri={story.photoUrl} name={story.coupleNames} style={styles.photo} initialSize={40} />
      <View style={styles.cardBody}>
        {story.tag ? (
          <View style={styles.tagPill}>
            <Text style={styles.tagText}>{story.tag}</Text>
          </View>
        ) : null}
        <Text style={styles.quote}>“{story.quote}”</Text>
        <Text style={styles.names}>{story.coupleNames}</Text>
        {(story.location || story.marriedOn) && (
          <Text style={styles.meta}>
            {[story.location, story.marriedOn ? new Date(story.marriedOn).getFullYear() : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function SuccessStoriesBrowseScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['success-stories'],
    queryFn: getSuccessStories,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <SafeAreaView style={styles.safe} testID="SuccessStoriesBrowseScreen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} testID="back-btn" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Success Stories</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('SuccessStory')}
          testID="share-story-btn"
          accessibilityLabel="Share your story"
        >
          <Ionicons name="add-circle-outline" size={24} color={c.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <StoryCard story={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={48} color={c.textMuted} />
              <Text style={styles.emptyTitle}>No stories yet</Text>
              <Text style={styles.emptySub}>Be the first to share your TricityMatch journey.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('SuccessStory')}
                testID="empty-share-btn"
              >
                <Text style={styles.emptyBtnText}>Share your story</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: c.textPrimary,
  },
  list: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  photo: { width: '100%', height: 200, backgroundColor: c.background },
  cardBody: { padding: spacing.lg },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: c.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    color: c.primary,
    fontFamily: typography.fontFamily.semiBold,
  },
  quote: {
    fontSize: typography.fontSize.base,
    color: c.textPrimary,
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  names: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: c.textPrimary,
  },
  meta: { fontSize: typography.fontSize.xs, color: c.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    color: c.textPrimary,
    marginTop: spacing.sm,
  },
  emptySub: {
    fontSize: typography.fontSize.sm,
    color: c.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyBtn: {
    marginTop: spacing.lg,
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  emptyBtnText: {
    color: '#fff',
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
  },
});
