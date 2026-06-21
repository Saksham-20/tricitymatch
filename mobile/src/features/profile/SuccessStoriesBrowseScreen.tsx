import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import SmartImage from '../../components/common/SmartImage';
import { getSuccessStories, type SuccessStory } from '../../api/profile';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function StoryCard({ story }: { story: SuccessStory }) {
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
          <Ionicons name="chevron-back" size={26} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Success Stories</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('SuccessStory')}
          testID="share-story-btn"
          accessibilityLabel="Share your story"
        >
          <Ionicons name="add-circle-outline" size={24} color={colours.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colours.primary} />
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <StoryCard story={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={48} color={colours.textMuted} />
              <Text style={styles.emptyTitle}>No stories yet</Text>
              <Text style={styles.emptySub}>Be the first to share your TricityShadi journey.</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  list: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colours.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  photo: { width: '100%', height: 200, backgroundColor: colours.background },
  cardBody: { padding: spacing.lg },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: colours.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    color: colours.primary,
    fontFamily: typography.fontFamily.semiBold,
  },
  quote: {
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  names: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  meta: { fontSize: typography.fontSize.xs, color: colours.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    marginTop: spacing.sm,
  },
  emptySub: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyBtn: {
    marginTop: spacing.lg,
    backgroundColor: colours.primary,
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
