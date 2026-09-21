import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import { EmptyState } from '../../components/ui';
import { ListSkeleton } from '../../components/ui/skeletons';
import { PressableScale } from '../../components/motion';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { getMyProfile, updatePrivacy, type PrivacySettings } from '../../api/profile';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Visibility = 'everyone' | 'matches_only';

export default function PrivacySettingsScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  });

  const [visibility, setVisibility] = useState<Visibility>('everyone');
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [showLastSeen, setShowLastSeen] = useState(true);

  // Hydrate from the loaded profile (these columns ride on the profile record).
  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    if (p.profileVisibility === 'matches_only' || p.profileVisibility === 'everyone') {
      setVisibility(p.profileVisibility);
    }
    if (typeof p.showOnlineStatus === 'boolean') setShowOnlineStatus(p.showOnlineStatus);
    if (typeof p.showLastSeen === 'boolean') setShowLastSeen(p.showLastSeen);
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (settings: PrivacySettings) => updatePrivacy(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  const save = () => {
    mutation.mutate({ profileVisibility: visibility, showOnlineStatus, showLastSeen });
  };

  if (isLoading) {
    return (
      <View style={styles.loader} testID="PrivacyLoading">
        <ListSkeleton rows={5} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="PrivacySettingsScreen">
      <View style={styles.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          testID="back-btn"
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
        </PressableScale>
        <Text variant="headline" color="textPrimary">Privacy</Text>
        <View style={{ width: 26 }} />
      </View>

      {isError && !profile ? (
        <EmptyState
          variant="error"
          icon="shield-outline"
          title="Couldn't load privacy settings"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => refetch()}
          testID="PrivacySettingsScreen-error"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {/* Profile visibility */}
          <Text variant="caption" color="textMuted" style={styles.sectionTitle}>Who can see your profile</Text>
          <View style={styles.segment}>
            {(['everyone', 'matches_only'] as Visibility[]).map((opt) => {
              const active = visibility === opt;
              return (
                <PressableScale
                  key={opt}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  onPress={() => setVisibility(opt)}
                  testID={`visibility-${opt}`}
                  accessibilityLabel={opt === 'everyone' ? 'Everyone' : 'Matches only'}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text variant="subhead" color="textSecondary" style={active && styles.segmentTextActive}>
                    {opt === 'everyone' ? 'Everyone' : 'Matches only'}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
          <Text variant="footnote" color="textMuted" style={styles.hint}>
            {visibility === 'everyone'
              ? 'Anyone on TricityMatch can view your full profile.'
              : 'Only people you have matched with can view your full profile.'}
          </Text>

          {/* Toggles */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text variant="subhead" color="textPrimary">Show online status</Text>
                <Text variant="footnote" color="textSecondary" style={styles.toggleSub}>Let others see when you are active</Text>
              </View>
              <Switch
                value={showOnlineStatus}
                onValueChange={setShowOnlineStatus}
                trackColor={{ false: c.border, true: c.primary + '80' }}
                thumbColor={showOnlineStatus ? c.primary : c.textMuted}
                testID="toggle-online-status"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text variant="subhead" color="textPrimary">Show last seen</Text>
                <Text variant="footnote" color="textSecondary" style={styles.toggleSub}>Display when you were last online</Text>
              </View>
              <Switch
                value={showLastSeen}
                onValueChange={setShowLastSeen}
                trackColor={{ false: c.border, true: c.primary + '80' }}
                thumbColor={showLastSeen ? c.primary : c.textMuted}
                testID="toggle-last-seen"
              />
            </View>
          </View>

          <PressableScale
            style={styles.saveBtn}
            onPress={save}
            disabled={mutation.isPending}
            testID="save-privacy"
            accessibilityLabel="Save privacy settings"
            accessibilityRole="button"
            accessibilityState={{ disabled: mutation.isPending }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text variant="headline" style={styles.saveText}>Save Privacy Settings</Text>
            )}
          </PressableScale>

          {mutation.isSuccess && !mutation.isPending && (
            <View style={styles.savedNote}>
              <Ionicons name="checkmark-circle" size={16} color={c.success} />
              <Text variant="subhead" color="success">Saved</Text>
            </View>
          )}
          {mutation.isError && (
            <Text variant="subhead" color="error" style={styles.errorNote}>Could not save. Please try again.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  body: { padding: spacing.lg },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  segmentBtnActive: { backgroundColor: c.primary },
  segmentTextActive: { color: '#fff' },
  hint: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  toggleCard: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  toggleSub: { marginTop: 2 },
  divider: { height: 1, backgroundColor: c.border },
  saveBtn: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveText: {
    color: '#fff',
  },
  savedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  errorNote: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
