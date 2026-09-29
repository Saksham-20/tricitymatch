import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  AccessibilityInfo,
  View,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale, useReduceMotion } from '../../components/motion';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { blockUser, reportUser, type ReportReason } from '../../api/block';
import { describeFailure } from './CompatibilityBreakdownSheet';
import { queryKeys } from '../../constants/queryKeys';
import { haptics } from '../../utils/haptics';
import { showToast } from '../../utils/toast';
import { tapSize } from '../../utils/elderTheme';

const REPORT_CATEGORIES = [
  'Threats or I feel unsafe',
  'Harassment or abuse',
  'Asks for money or a scam',
  'Fake profile',
  "Uses someone else's photos",
  'Underage user',
  'Inappropriate photos',
  'Misleading information',
  'Spam or advertising',
  'Other',
] as const;

type ReportCategory = typeof REPORT_CATEGORIES[number];

// Display labels → the reason enum the backend accepts.
const REASON_BY_LABEL: Record<ReportCategory, ReportReason> = {
  'Threats or I feel unsafe': 'threats',
  'Harassment or abuse': 'harassment',
  'Asks for money or a scam': 'financial_scam',
  'Fake profile': 'fake_profile',
  "Uses someone else's photos": 'stolen_photos',
  'Underage user': 'underage',
  'Inappropriate photos': 'inappropriate_content',
  'Misleading information': 'misleading_info',
  'Spam or advertising': 'spam',
  Other: 'other',
};

interface Props {
  visible: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
  onBlocked: () => void;
}

type Sheet = 'menu' | 'report';

/**
 * What the member is told once a report is in. One constant feeds both the
 * toast and the spoken announcement, so the two can never drift apart.
 */
// No turnaround is promised: nothing in the product measures one yet.
const REPORT_ACK = 'Our team reviews every report. They are not told who reported them.';

/**
 * Error row shown inside the sheet. A toast cannot do this job: an RN `<Modal>`
 * renders in its own native window above the app-root toast host, so a toast
 * fired while the sheet is open is drawn behind it. The failure is announced
 * once, by `fail()`: `accessibilityLiveRegion` is Android-only and would make
 * TalkBack say it twice, so this row is deliberately not a live region.
 */
function InlineError({ message, testID }: { message: string; testID: string }) {
  const { c } = useTheme();
  return (
    <View
      style={[inline.wrap, { backgroundColor: c.errorBg }]}
      accessibilityRole="alert"
      testID={testID}
    >
      <Ionicons
        name="alert-circle"
        size={18}
        color={c.error}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text variant="footnote" color="textPrimary" style={inline.text}>{message}</Text>
    </View>
  );
}

const inline = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  text: { flex: 1 },
});

export default function BlockReportSheet({ visible, userId, userName, onClose, onBlocked }: Props) {
  const { c, elder } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReduceMotion();
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<Sheet>('menu');
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const tap = tapSize(elder);
  // The back arrow is 20pt; hitSlop brings it to the tap target in both axes.
  const backSlop = Math.ceil((tap - 20) / 2);
  const sheetPad = { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md };

  const resetState = () => {
    setSheet('menu');
    setCategory(null);
    setDescription('');
    setBlockError(null);
    setReportError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const fail = (message: string, set: (m: string) => void) => {
    set(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  const blockMutation = useMutation({
    mutationFn: () => blockUser(userId),
    onMutate: () => setBlockError(null),
    onSuccess: () => {
      // Everywhere the blocked member can still be listed: every Matches tab
      // (daily, shortlist, mutual, liked-me, sent), every search, the inbox.
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      // Drop the cached profile so it cannot be re-opened from cache. A profile
      // still on screen is dropped by its own screen once it unmounts: removing
      // it under a mounted observer would flash the loading state through the
      // back transition.
      const profileKey = queryKeys.profile(userId);
      const cached = queryClient.getQueryCache().find({ queryKey: profileKey, exact: true });
      if (cached && cached.getObserversCount() === 0) {
        queryClient.removeQueries({ queryKey: profileKey, exact: true });
      }
      haptics.medium();
      handleClose();
      onBlocked();
    },
    onError: (err) => fail(`Couldn't block ${userName}. ${describeFailure(err)}`, setBlockError),
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      reportUser({ userId, reason: REASON_BY_LABEL[category!], description: description.trim() || undefined }),
    onMutate: () => setReportError(null),
    onSuccess: () => {
      handleClose();
      // The sheet is closing, so the toast host is visible again. showToast.success
      // carries the one haptic for this commit; the toast itself is silent to a
      // screen reader, so the outcome is announced here.
      showToast.success('Report submitted', REPORT_ACK);
      AccessibilityInfo.announceForAccessibility(`Report submitted. ${REPORT_ACK}`);
    },
    onError: (err) => fail(`Couldn't submit your report. ${describeFailure(err)}`, setReportError),
  });

  // Destructive confirmation: the one Alert.alert this sheet is allowed to keep.
  const handleBlock = () => {
    Alert.alert(
      `Block ${userName}?`,
      "They won't be able to see your profile or message you.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => blockMutation.mutate(),
        },
      ],
    );
  };

  const handleSubmitReport = () => {
    // Submit is disabled until a reason is chosen, so this only guards a stale press.
    if (!category) return;
    reportMutation.mutate();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'fade' : 'slide'}
      onRequestClose={handleClose}
      testID="block-report-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <PressableScale
          style={[s.backdrop, { backgroundColor: c.scrim }]}
          onPress={handleClose}
          scaleTo={1}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        {sheet === 'menu' ? (
          <View style={[s.sheet, sheetPad]}>
            <Text variant="title3" color="textPrimary" style={s.heading} accessibilityRole="header">{userName}</Text>

            <PressableScale
              style={[s.menuItem, { minHeight: tap }]}
              onPress={() => setSheet('report')}
              testID="menu-report"
              accessibilityLabel="Report this profile"
              accessibilityHint={`Opens a form to report ${userName}`}
              accessibilityRole="button"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="flag-outline"
                size={20}
                color={c.warning}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Text variant="subhead" color="textPrimary" style={s.menuLabel}>Report this profile</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={c.textMuted}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </PressableScale>

            <View style={s.divider} />

            <PressableScale
              style={[s.menuItem, { minHeight: tap }]}
              onPress={handleBlock}
              disabled={blockMutation.isPending}
              testID="menu-block"
              accessibilityLabel="Block this user"
              accessibilityHint={`Blocks ${userName}. You will be asked to confirm.`}
              accessibilityRole="button"
              accessibilityState={{ disabled: blockMutation.isPending, busy: blockMutation.isPending }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {blockMutation.isPending ? (
                <ActivityIndicator size="small" color={c.error} />
              ) : (
                <Ionicons
                  name="ban-outline"
                  size={20}
                  color={c.error}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              )}
              <Text variant="subhead" color="error" style={s.menuLabel}>Block this user</Text>
            </PressableScale>

            {!!blockError && <InlineError message={blockError} testID="block-error" />}

            <PressableScale
              style={[s.cancelBtn, { minHeight: tap }]}
              onPress={handleClose}
              testID="menu-cancel"
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="subhead" color="textSecondary">Cancel</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={[s.sheet, sheetPad]}>
            <View style={s.reportHeader}>
              <PressableScale
                onPress={() => setSheet('menu')}
                testID="report-back-tap44-hitslop"
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={{ top: backSlop, bottom: backSlop, left: backSlop, right: backSlop }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
              </PressableScale>
              <Text variant="title3" color="textPrimary" style={s.reportHeading} numberOfLines={2} accessibilityRole="header">
                Report {userName}
              </Text>
              <View style={{ width: 20 }} />
            </View>

            <Text variant="subhead" color="textSecondary" style={s.sectionLabel}>What's the issue?</Text>
            <ScrollView
              style={s.categoriesScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View accessibilityRole="radiogroup" accessibilityLabel="Reason for report">
                {REPORT_CATEGORIES.map((cat) => (
                  <PressableScale
                    key={cat}
                    style={[s.categoryRow, { minHeight: tap }, category === cat && s.categoryRowSelected]}
                    onPress={() => setCategory(cat)}
                    testID={`category-${cat}`}
                    accessibilityLabel={cat}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: category === cat, checked: category === cat }}
                    pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text
                      variant={category === cat ? 'headline' : 'callout'}
                      color={category === cat ? 'primary' : 'textPrimary'}
                      style={s.categoryLabel}
                    >
                      {cat}
                    </Text>
                    {category === cat && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={c.primary}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      />
                    )}
                  </PressableScale>
                ))}
              </View>

              <Input
                label="Additional details (optional)"
                placeholder="Describe the issue"
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={500}
                style={s.descInputField}
                testID="report-description"
                accessibilityLabel="Report description"
              />
              <Text variant="caption" color="textMuted" style={s.charCount}>{description.length}/500</Text>
            </ScrollView>

            {!!reportError && <InlineError message={reportError} testID="report-error" />}
            {!category && (
              <Text variant="footnote" color="textSecondary" style={s.submitHint}>Choose a reason to submit.</Text>
            )}
            <Button
              title="Submit report"
              onPress={handleSubmitReport}
              loading={reportMutation.isPending}
              disabled={!category}
              haptic={false}
              style={s.submitBtn}
              testID="report-submit-btn"
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  backdrop:            { flex: 1 },
  sheet:               { backgroundColor: c.sheetBg, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, maxHeight: '80%' },
  heading:             { textAlign: 'center', marginBottom: spacing.lg },
  // Sits in a row between the back arrow and a spacer: it takes the room left
  // (so a long name wraps instead of pushing the row wide) and carries no
  // margin, which would drag the arrow off the title's centre line.
  reportHeading:       { flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  menuItem:            { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  menuLabel:           { flex: 1 },
  divider:             { height: 1, backgroundColor: c.border, marginVertical: spacing.sm },
  cancelBtn:           { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  reportHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  sectionLabel:        { marginBottom: spacing.sm, marginTop: spacing.md },
  categoriesScroll:    { maxHeight: 320 },
  categoryRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  // Beside a trailing checkmark: shrink and wrap rather than push the row wide.
  categoryLabel:       { flexShrink: 1 },
  categoryRowSelected: { backgroundColor: c.accentSoft, marginHorizontal: -spacing.xl, paddingHorizontal: spacing.xl },
  descInputField:      { minHeight: 80, textAlignVertical: 'top' },
  charCount:           { textAlign: 'right', marginTop: 4, marginBottom: spacing.sm },
  submitHint:          { textAlign: 'center', marginTop: spacing.md },
  submitBtn:           { marginTop: spacing.md },
});
