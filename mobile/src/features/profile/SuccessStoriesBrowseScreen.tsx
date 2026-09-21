import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import { ListSkeleton } from '../../components/ui/skeletons';
import { EmptyState } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
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
            <Text variant="caption" color="primary">{story.tag}</Text>
          </View>
        ) : null}
        <Text variant="callout" color="textPrimary" style={styles.quote}>“{story.quote}”</Text>
        <Text variant="headline" color="textPrimary">{story.coupleNames}</Text>
        {(story.location || story.marriedOn) && (
          <Text variant="footnote" color="textMuted" style={styles.meta}>
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

  const { data: stories = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['success-stories'],
    queryFn: getSuccessStories,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <SafeAreaView style={styles.safe} testID="SuccessStoriesBrowseScreen">
      <View style={styles.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          testID="back-btn"
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
        </PressableScale>
        <Text variant="headline" color="textPrimary">Success Stories</Text>
        <PressableScale
          onPress={() => navigation.navigate('SuccessStory')}
          testID="share-story-btn"
          accessibilityLabel="Share your story"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add-circle-outline" size={24} color={c.primary} />
        </PressableScale>
      </View>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : isError && stories.length === 0 ? (
        <EmptyState
          variant="error"
          icon="cloud-offline-outline"
          title="Couldn't load stories"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => refetch()}
          testID="SuccessStoriesBrowseScreen-error"
        />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <StoryCard story={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={48} color={c.textMuted} />
              <Text variant="headline" color="textPrimary" style={styles.emptyTitle}>No stories yet</Text>
              <Text variant="footnote" color="textSecondary" style={styles.emptySub}>Be the first to share your TricityMatch journey.</Text>
              <PressableScale
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('SuccessStory')}
                testID="empty-share-btn"
                accessibilityRole="button"
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text variant="caption" style={styles.emptyBtnText}>Share your story</Text>
              </PressableScale>
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
  quote: {
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  meta: { marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyTitle: {
    marginTop: spacing.sm,
  },
  emptySub: {
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
  },
});
