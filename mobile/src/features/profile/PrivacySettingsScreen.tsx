import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Platform, View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { Button, EmptyState, ScreenHeader, SkeletonBlock, Switch } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';
import { showToast } from '../../utils/toast';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { getMyProfile, updatePrivacy, type FieldLevel, type PrivacySettings } from '../../api/profile';
import { queryKeys } from '../../constants/queryKeys';
import type { Profile } from '../../types';

type Visibility = 'everyone' | 'matches_only';

/** A decorative glyph: the screen reader skips it and reads the text beside it. */
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

// The three privacy columns ride on the profile record but the shared Profile
// type does not declare them yet, so read them through this widened shape.
type ProfileWithPrivacy = Profile & PrivacySettings;

const VISIBILITY_OPTIONS: { key: Visibility; label: string }[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'matches_only', label: 'Matches only' },
];

const FIELD_LEVELS: { key: FieldLevel; label: string }[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'matches', label: 'Matches' },
  { key: 'hidden', label: 'Only me' },
];

const FIELD_GROUPS = [
  { key: 'income', label: 'Income', hint: 'Also stops people finding you with an income filter.' },
  { key: 'birthDetails', label: 'Birth time and place', hint: 'Used for horoscope reports. Your star sign match still works.' },
] as const;

type FieldGroupKey = (typeof FIELD_GROUPS)[number]['key'];
type FieldState = Record<FieldGroupKey, FieldLevel>;

const asLevel = (v: unknown): FieldLevel => (v === 'matches' || v === 'hidden' ? v : 'everyone');

// ─── Toggle row ──────────────────────────────────────────────────────────────
// The whole row is the switch: a bare 51x31 native switch is under 44pt tall.
// The visual switch inside is inert and hidden from the accessibility tree, so
// a screen reader meets exactly one control per setting.

interface ToggleRowProps {
  label: string;
  sub: string;
  value: boolean;
  onChange: (next: boolean) => void;
  divider?: boolean;
  testID: string;
}

function ToggleRow({ label, sub, value, onChange, divider, testID }: ToggleRowProps) {
  const { c, elder } = useTheme();
  return (
    <PressableScale
      scaleTo={0.99}
      haptic
      onPress={() => onChange(!value)}
      style={[
        tr.row,
        { minHeight: tapSize(elder) },
        divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
      ]}
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={sub}
      accessibilityState={{ checked: value }}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={tr.info}>
        <Text variant="subhead" color="textPrimary">{label}</Text>
        <Text variant="footnote" color="textSecondary" style={tr.sub}>{sub}</Text>
      </View>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch value={value} onValueChange={() => undefined} />
      </View>
    </PressableScale>
  );
}

// Layout only, no colour.
const tr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  info: { flex: 1 },
  sub: { marginTop: 2 },
});

// ─── Loading ─────────────────────────────────────────────────────────────────
// Shaped like the form it stands in for (a segmented control, a two-row card, a
// button), not like a list of avatar rows.

function PrivacyLoading() {
  return (
    // One busy element for a screen reader: without it the header is followed by
    // silence until the form appears.
    <View
      style={sk.pad}
      testID="PrivacyLoading-body"
      accessible
      accessibilityLabel="Loading privacy settings"
      accessibilityState={{ busy: true }}
    >
      <SkeletonBlock width="45%" height={13} />
      <SkeletonBlock width="100%" height={52} radius={borderRadius.md} />
      <SkeletonBlock width="80%" height={13} />
      <SkeletonBlock width="100%" height={132} radius={borderRadius.md} style={sk.gap} />
      <SkeletonBlock width="100%" height={50} radius={borderRadius.md} style={sk.gap} />
    </View>
  );
}

const sk = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
  gap: { marginTop: spacing.lg },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PrivacySettingsScreen() {
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const segmentHeight = tapSize(elder);
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  });

  const [visibility, setVisibility] = useState<Visibility>('everyone');
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [fields, setFields] = useState<FieldState>({ income: 'everyone', birthDetails: 'everyone' });

  // What the server currently holds. Absent columns read as the defaults the
  // controls open on.
  const p = profile as ProfileWithPrivacy | undefined;
  const serverVisibility: Visibility = p?.profileVisibility === 'matches_only' ? 'matches_only' : 'everyone';
  const serverOnline = typeof p?.showOnlineStatus === 'boolean' ? p.showOnlineStatus : true;
  const serverLastSeen = typeof p?.showLastSeen === 'boolean' ? p.showLastSeen : true;

  const serverFields: FieldState = {
    income: asLevel(p?.fieldVisibility?.income),
    birthDetails: asLevel(p?.fieldVisibility?.birthDetails),
  };

  const dirty =
    visibility !== serverVisibility || showOnlineStatus !== serverOnline || showLastSeen !== serverLastSeen ||
    fields.income !== serverFields.income || fields.birthDetails !== serverFields.birthDetails;

  // Hydrate from the loaded profile (these columns ride on the profile record).
  // The first load always hydrates; after that a refetch (a background refresh, an
  // invalidation from another screen) must not overwrite toggles the member has
  // changed and not yet saved.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!p) return;
    if (hydratedRef.current && dirty) return;
    hydratedRef.current = true;
    setVisibility(serverVisibility);
    setShowOnlineStatus(serverOnline);
    setShowLastSeen(serverLastSeen);
    setFields(serverFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (settings: PrivacySettings) => updatePrivacy(settings),
    onSuccess: (_data, settings) => {
      // Write the saved values into the cache first so `dirty` clears at once;
      // otherwise Save re-enables until the refetch below lands.
      queryClient.setQueryData<Profile>(queryKeys.me, (old) =>
        old ? ({ ...old, ...settings, fieldVisibility: { ...(old as ProfileWithPrivacy).fieldVisibility, ...settings.fieldVisibility } } as Profile) : old,
      );
      // The profile is cached under two keys (`me` and `myProfile`); Settings and
      // Home read the second, so refreshing only one leaves them on the old values.
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
      showToast.success('Privacy settings saved');
      AccessibilityInfo.announceForAccessibility('Privacy settings saved');
    },
    // The inline note below is the visible message. Android reads its live region;
    // VoiceOver does not read a role="alert" that appears on its own, so say it
    // on iOS only, or Android hears it twice.
    onError: () => {
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility('Could not save. Please try again.');
    },
  });

  // Unsaved-changes guard: back, swipe-back and hardware back would otherwise
  // drop the toggles without a word. The one Alert this screen has is that
  // destructive confirmation (ruling 22). Not while a save is in flight: the
  // save carries on regardless of where the member goes.
  const guardRef = useRef(false);
  useEffect(() => {
    guardRef.current = dirty && !mutation.isPending;
  }, [dirty, mutation.isPending]);
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!guardRef.current) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'You have unsaved privacy changes.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [navigation]);

  // Any edit invalidates a previous "could not save" note.
  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    if (mutation.isError) mutation.reset();
    setter(v);
  };

  const save = () => {
    mutation.mutate({ profileVisibility: visibility, showOnlineStatus, showLastSeen, fieldVisibility: fields });
  };

  if (isLoading) {
    return (
      <Screen edges={['top']} testID="PrivacyLoading">
        <ScreenHeader title="Privacy" />
        <PrivacyLoading />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} testID="PrivacySettingsScreen">
      <ScreenHeader title="Privacy" />

      {!profile ? (
        <View style={styles.errorBody}>
          <EmptyState
            variant="error"
            icon="shield-outline"
            title="Couldn't load privacy settings"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => refetch()}
            testID="PrivacySettingsScreen-error"
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Profile visibility */}
          <Text variant="headline" color="fgStrong" style={styles.sectionTitle} accessibilityRole="header">
            Who can see your profile
          </Text>
          <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="Who can see your profile">
            {VISIBILITY_OPTIONS.map(({ key, label }) => {
              const active = visibility === key;
              return (
                <PressableScale
                  key={key}
                  style={[styles.segmentBtn, { minHeight: segmentHeight }, active && styles.segmentBtnActive]}
                  onPress={() => edit(setVisibility)(key)}
                  haptic
                  testID={`visibility-${key}`}
                  accessibilityLabel={label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text variant="subhead" color={active ? 'primary' : 'textSecondary'}>
                    {label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
          <Text variant="footnote" color="textSecondary" style={styles.hint} accessibilityLiveRegion="polite">
            {visibility === 'everyone'
              ? 'Anyone on TricityMatch can view your full profile.'
              : 'Only people you have matched with can view your full profile.'}
          </Text>

          {/* Details shared: income and birth details each get their own level */}
          {FIELD_GROUPS.map(({ key, label, hint }) => (
            <View key={key} style={styles.fieldBlock}>
              <Text variant="headline" color="fgStrong" style={styles.sectionTitle} accessibilityRole="header">
                {label}
              </Text>
              <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={`Who can see your ${label.toLowerCase()}`}>
                {FIELD_LEVELS.map(({ key: level, label: levelLabel }) => {
                  const active = fields[key] === level;
                  return (
                    <PressableScale
                      key={level}
                      style={[styles.segmentBtn, { minHeight: segmentHeight }, active && styles.segmentBtnActive]}
                      onPress={() => edit((v: FieldLevel) => setFields((f) => ({ ...f, [key]: v })))(level)}
                      haptic
                      testID={`field-${key}-${level}`}
                      accessibilityLabel={levelLabel}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text variant="subhead" color={active ? 'primary' : 'textSecondary'}>{levelLabel}</Text>
                    </PressableScale>
                  );
                })}
              </View>
              <Text variant="footnote" color="textSecondary" style={styles.hint}>{hint}</Text>
            </View>
          ))}

          {/* Toggles */}
          <View style={styles.toggleCard}>
            <ToggleRow
              label="Show online status"
              sub="Let others see when you are active"
              value={showOnlineStatus}
              onChange={edit(setShowOnlineStatus)}
              divider
              testID="toggle-online-status"
            />
            <ToggleRow
              label="Show last seen"
              sub="Display when you were last online"
              value={showLastSeen}
              onChange={edit(setShowLastSeen)}
              testID="toggle-last-seen"
            />
          </View>

          <Button
            title="Save privacy settings"
            onPress={save}
            loading={mutation.isPending}
            disabled={!dirty}
            // The outcome toast carries the haptic; a press haptic too would be two for one commit.
            haptic={false}
            style={styles.saveBtn}
            testID="save-privacy"
            accessibilityLabel="Save privacy settings"
          />

          {mutation.isError && (
            <View style={styles.errorNote} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Ionicons name="alert-circle" size={16} color={c.error} {...HIDE_FROM_A11Y} />
              <Text variant="subhead" color="error" style={styles.errorText}>
                Could not save. Please try again.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  errorBody: { flex: 1, justifyContent: 'center' },
  body: { padding: spacing.lg, paddingTop: spacing.sm },
  sectionTitle: { marginBottom: spacing.sm },
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
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  // Selected = a tint plus an accent rule, never a flat burgundy fill.
  segmentBtnActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
  hint: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  fieldBlock: { marginTop: spacing.xs },
  toggleCard: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
  },
  saveBtn: { marginTop: spacing.xl },
  errorNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  errorText: { flexShrink: 1, textAlign: 'center' },
});
