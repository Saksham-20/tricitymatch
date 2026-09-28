import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { Badge, EmptyState, IconButton, ScreenHeader, SkeletonBlock } from '../../components/ui';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import SmartImage from '../../components/common/SmartImage';
import { getSuccessStories, type SuccessStory } from '../../api/profile';
import type { MainStackParamList } from '../../navigation/types';
import { LIST_PERF } from '../../constants/listPerf';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function StoryCard({ story }: { story: SuccessStory }) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.card} testID={`story-${story.id}`}>
      <SmartImage uri={story.photoUrl} name={story.coupleNames} style={styles.photo} initialSize={40} />
      <View style={styles.cardBody}>
        {story.tag ? <Badge label={story.tag} tone="primary" style={styles.tag} /> : null}
        <Text variant="callout" color="textPrimary" style={styles.quote}>“{story.quote}”</Text>
        <Text variant="headline" color="textPrimary">{story.coupleNames}</Text>
        {(story.location || story.marriedOn) && (
          // textSecondary, not textMuted: 13pt meta on a card fails AA in muted grey.
          <Text variant="footnote" color="textSecondary" style={styles.meta}>
            {[story.location, story.marriedOn ? new Date(story.marriedOn).getFullYear() : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Loading stand-in shaped like a StoryCard: photo, tag, quote lines, names. */
function StoryCardSkeleton() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.card}>
      <SkeletonBlock width="100%" height={200} radius={0} />
      <View style={styles.cardBody}>
        <SkeletonBlock width={72} height={22} radius={borderRadius.pill} />
        <SkeletonBlock width="100%" height={16} style={styles.skeletonLine} />
        <SkeletonBlock width="80%" height={16} style={styles.skeletonLine} />
        <SkeletonBlock width="50%" height={20} style={styles.skeletonLine} />
      </View>
    </View>
  );
}

export default function SuccessStoriesBrowseScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();

  const { data: stories = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['success-stories'],
    queryFn: getSuccessStories,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Screen edges={['top', 'bottom']} style={styles.safe} testID="SuccessStoriesBrowseScreen">
      <ScreenHeader
        title="Success stories"
        testID="success-stories-header"
        right={
          <IconButton
            icon="add-circle-outline"
            size={24}
            color={c.primary}
            onPress={() => navigation.navigate('SuccessStory')}
            testID="share-story-btn"
            accessibilityLabel="Share your story"
          />
        }
      />

      {isLoading ? (
        <View style={styles.list}>
          <StoryCardSkeleton />
          <StoryCardSkeleton />
        </View>
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
          {...LIST_PERF}
          data={stories}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <StoryCard story={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor={c.primary}
              colors={[c.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="No stories yet"
              description="Be the first to share your TricityMatch journey."
              actionLabel="Share your story"
              onAction={() => navigation.navigate('SuccessStory')}
              testID="SuccessStoriesBrowseScreen-empty"
            />
          }
        />
      )}
    </Screen>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  safe: { backgroundColor: c.background },
  list: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: 200, backgroundColor: c.background },
  cardBody: { padding: spacing.lg },
  tag: { marginBottom: spacing.sm },
  skeletonLine: { marginTop: spacing.sm },
  // No fontStyle: 'italic': Inter has no italic file loaded, so Android would
  // fake-slant it and iOS would ignore it. The curly quotes carry the meaning.
  quote: { marginBottom: spacing.sm },
  meta: { marginTop: 2 },
});
