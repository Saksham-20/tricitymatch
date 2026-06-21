import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getMyProfile, updatePrivacy, type PrivacySettings } from '../../api/profile';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Visibility = 'everyone' | 'matches_only';

export default function PrivacySettingsScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
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
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colours.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="PrivacySettingsScreen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} testID="back-btn" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Profile visibility */}
        <Text style={styles.sectionTitle}>Who can see your profile</Text>
        <View style={styles.segment}>
          {(['everyone', 'matches_only'] as Visibility[]).map((opt) => {
            const active = visibility === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => setVisibility(opt)}
                testID={`visibility-${opt}`}
                accessibilityLabel={opt === 'everyone' ? 'Everyone' : 'Matches only'}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {opt === 'everyone' ? 'Everyone' : 'Matches only'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hint}>
          {visibility === 'everyone'
            ? 'Anyone on TricityShadi can view your full profile.'
            : 'Only people you have matched with can view your full profile.'}
        </Text>

        {/* Toggles */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Show online status</Text>
              <Text style={styles.toggleSub}>Let others see when you are active</Text>
            </View>
            <Switch
              value={showOnlineStatus}
              onValueChange={setShowOnlineStatus}
              trackColor={{ false: colours.border, true: colours.primary + '80' }}
              thumbColor={showOnlineStatus ? colours.primary : colours.textMuted}
              testID="toggle-online-status"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Show last seen</Text>
              <Text style={styles.toggleSub}>Display when you were last online</Text>
            </View>
            <Switch
              value={showLastSeen}
              onValueChange={setShowLastSeen}
              trackColor={{ false: colours.border, true: colours.primary + '80' }}
              thumbColor={showLastSeen ? colours.primary : colours.textMuted}
              testID="toggle-last-seen"
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={save}
          disabled={mutation.isPending}
          testID="save-privacy"
          accessibilityLabel="Save privacy settings"
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Save Privacy Settings</Text>
          )}
        </TouchableOpacity>

        {mutation.isSuccess && !mutation.isPending && (
          <Text style={styles.savedNote}>Saved ✓</Text>
        )}
        {mutation.isError && (
          <Text style={styles.errorNote}>Could not save. Please try again.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.background },
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
  body: { padding: spacing.lg },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colours.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  segmentBtnActive: { backgroundColor: colours.primary },
  segmentText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textSecondary,
  },
  segmentTextActive: { color: '#fff', fontFamily: typography.fontFamily.semiBold },
  hint: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 18,
  },
  toggleCard: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colours.border,
    paddingHorizontal: spacing.lg,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  toggleSub: { fontSize: typography.fontSize.xs, color: colours.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colours.border },
  saveBtn: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: '#fff',
  },
  savedNote: {
    textAlign: 'center',
    marginTop: spacing.md,
    color: colours.success || colours.primary,
    fontFamily: typography.fontFamily.medium,
  },
  errorNote: {
    textAlign: 'center',
    marginTop: spacing.md,
    color: colours.error,
    fontFamily: typography.fontFamily.medium,
  },
});
