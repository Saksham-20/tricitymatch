import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import Text from '../../components/ui/Text';
import { blockUser, reportUser, type ReportReason } from '../../api/block';
import { queryKeys } from '../../constants/queryKeys';

const REPORT_CATEGORIES = [
  'Fake profile',
  'Inappropriate photos',
  'Harassment or abuse',
  'Spam or scam',
  'Underage user',
  'Other',
] as const;

type ReportCategory = typeof REPORT_CATEGORIES[number];

// Display labels → the reason enum the backend accepts.
const REASON_BY_LABEL: Record<ReportCategory, ReportReason> = {
  'Fake profile': 'fake_profile',
  'Inappropriate photos': 'inappropriate_content',
  'Harassment or abuse': 'harassment',
  'Spam or scam': 'spam',
  'Underage user': 'underage',
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

export default function BlockReportSheet({ visible, userId, userName, onClose, onBlocked }: Props) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<Sheet>('menu');
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');

  const resetState = () => {
    setSheet('menu');
    setCategory(null);
    setDescription('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const blockMutation = useMutation({
    mutationFn: () => blockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyMatches });
      queryClient.invalidateQueries({ queryKey: queryKeys.search({}  as any) });
      handleClose();
      onBlocked();
    },
    onError: () => Alert.alert('Error', 'Could not block user. Please try again.'),
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      reportUser({ userId, reason: REASON_BY_LABEL[category!], description: description.trim() || undefined }),
    onSuccess: () => {
      handleClose();
      Alert.alert('Report Submitted', 'Thank you. Our team will review this within 24 hours.');
    },
    onError: () => Alert.alert('Error', 'Could not submit report. Please try again.'),
  });

  const handleBlock = () => {
    Alert.alert(
      `Block ${userName}?`,
      'They won\'t be able to see your profile or message you. You can unblock from settings.',
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
    if (!category) {
      Alert.alert('Select a reason', 'Please choose a category for your report.');
      return;
    }
    reportMutation.mutate();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      testID="block-report-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <PressableScale
          style={s.backdrop}
          onPress={handleClose}
          scaleTo={1}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        {sheet === 'menu' ? (
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text variant="title3" color="textPrimary" style={s.heading}>{userName}</Text>

            <PressableScale
              style={s.menuItem}
              onPress={() => setSheet('report')}
              testID="menu-report"
              accessibilityLabel={`Report ${userName}`}
              accessibilityRole="button"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="flag-outline" size={20} color={c.warning} />
              <Text variant="subhead" color="textPrimary" style={s.menuLabel}>Report this profile</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
            </PressableScale>

            <View style={s.divider} />

            <PressableScale
              style={s.menuItem}
              onPress={handleBlock}
              disabled={blockMutation.isPending}
              testID="menu-block"
              accessibilityLabel={`Block ${userName}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: blockMutation.isPending }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {blockMutation.isPending ? (
                <ActivityIndicator size="small" color={c.error} />
              ) : (
                <Ionicons name="ban-outline" size={20} color={c.error} />
              )}
              <Text variant="subhead" color="error" style={s.menuLabel}>Block this user</Text>
            </PressableScale>

            <PressableScale
              style={s.cancelBtn}
              onPress={handleClose}
              testID="menu-cancel"
              accessibilityRole="button"
              hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="subhead" color="textSecondary">Cancel</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.reportHeader}>
              <PressableScale
                onPress={() => setSheet('menu')}
                testID="report-back"
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
              </PressableScale>
              <Text variant="title3" color="textPrimary" style={s.heading}>Report {userName}</Text>
              <View style={{ width: 20 }} />
            </View>

            <Text variant="caption" color="textMuted" style={s.sectionLabel}>What's the issue?</Text>
            <ScrollView style={s.categoriesScroll} showsVerticalScrollIndicator={false}>
              {REPORT_CATEGORIES.map((cat) => (
                <PressableScale
                  key={cat}
                  style={[s.categoryRow, category === cat && s.categoryRowSelected]}
                  onPress={() => setCategory(cat)}
                  testID={`category-${cat}`}
                  accessibilityLabel={cat}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: category === cat }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text
                    variant={category === cat ? 'headline' : 'callout'}
                    color={category === cat ? 'primary' : 'textPrimary'}
                  >
                    {cat}
                  </Text>
                  {category === cat && (
                    <Ionicons name="checkmark-circle" size={18} color={c.primary} />
                  )}
                </PressableScale>
              ))}

              <Text variant="caption" color="textMuted" style={s.sectionLabel}>Additional details (optional)</Text>
              <TextInput
                style={s.descInput}
                placeholder="Describe the issue..."
                placeholderTextColor={c.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={500}
                testID="report-description"
                accessibilityLabel="Report description"
              />
              <Text variant="caption" color="textMuted" style={s.charCount}>{description.length}/500</Text>
            </ScrollView>

            <PressableScale
              style={[s.submitBtn, !category && s.submitBtnDisabled]}
              onPress={handleSubmitReport}
              disabled={!category || reportMutation.isPending}
              testID="report-submit-btn"
              accessibilityLabel="Submit report"
              accessibilityRole="button"
              accessibilityState={{ disabled: !category || reportMutation.isPending }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {reportMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text variant="headline" color="onPrimary">Submit Report</Text>
              )}
            </PressableScale>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  backdrop:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:               { backgroundColor: c.background, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.xl, paddingBottom: spacing['3xl'], maxHeight: '80%' },
  handle:              { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
  heading:             { textAlign: 'center', marginBottom: spacing.lg },
  menuItem:            { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  menuLabel:           { flex: 1 },
  divider:             { height: 1, backgroundColor: c.border, marginVertical: spacing.sm },
  cancelBtn:           { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  reportHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  sectionLabel:        { textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm, marginTop: spacing.md },
  categoriesScroll:    { maxHeight: 320 },
  categoryRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  categoryRowSelected: { backgroundColor: c.primaryLight, marginHorizontal: -spacing.xl, paddingHorizontal: spacing.xl },
  descInput:           { borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.fontSize.sm, color: c.textPrimary, minHeight: 80, textAlignVertical: 'top', fontFamily: typography.fontFamily.regular },
  charCount:           { textAlign: 'right', marginTop: 4, marginBottom: spacing.sm },
  submitBtn:           { backgroundColor: c.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  submitBtnDisabled:   { backgroundColor: c.textMuted },
});
