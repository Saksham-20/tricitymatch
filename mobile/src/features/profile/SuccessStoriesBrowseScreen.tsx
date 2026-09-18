import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import { ListSkeleton } from '../../components/ui/skeletons';
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
        <Text variant="headline" color="textPrimary">Success Stories</Text>
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
              <Text variant="headline" color="textPrimary" style={styles.emptyTitle}>No stories yet</Text>
              <Text variant="footnote" color="textSecondary" style={styles.emptySub}>Be the first to share your TricityMatch journey.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('SuccessStory')}
                testID="empty-share-btn"
              >
                <Text variant="caption" style={styles.emptyBtnText}>Share your story</Text>
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
