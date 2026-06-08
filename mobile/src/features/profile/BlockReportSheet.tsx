import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { blockUser, reportUser } from '../../api/block';
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

interface Props {
  visible: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
  onBlocked: () => void;
}

type Sheet = 'menu' | 'report';

export default function BlockReportSheet({ visible, userId, userName, onClose, onBlocked }: Props) {
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
      reportUser({ userId, category: category!, description: description.trim() || undefined }),
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
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />

        {sheet === 'menu' ? (
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.heading}>{userName}</Text>

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => setSheet('report')}
              testID="menu-report"
              accessibilityLabel={`Report ${userName}`}
            >
              <Ionicons name="flag-outline" size={20} color={colours.warning} />
              <Text style={s.menuLabel}>Report this profile</Text>
              <Ionicons name="chevron-forward" size={16} color={colours.textMuted} />
            </TouchableOpacity>

            <View style={s.divider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={handleBlock}
              disabled={blockMutation.isPending}
              testID="menu-block"
              accessibilityLabel={`Block ${userName}`}
            >
              {blockMutation.isPending ? (
                <ActivityIndicator size="small" color={colours.error} />
              ) : (
                <Ionicons name="ban-outline" size={20} color={colours.error} />
              )}
              <Text style={[s.menuLabel, { color: colours.error }]}>Block this user</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={handleClose} testID="menu-cancel">
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.reportHeader}>
              <TouchableOpacity onPress={() => setSheet('menu')} testID="report-back">
                <Ionicons name="arrow-back" size={20} color={colours.textPrimary} />
              </TouchableOpacity>
              <Text style={s.heading}>Report {userName}</Text>
              <View style={{ width: 20 }} />
            </View>

            <Text style={s.sectionLabel}>What's the issue?</Text>
            <ScrollView style={s.categoriesScroll} showsVerticalScrollIndicator={false}>
              {REPORT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[s.categoryRow, category === cat && s.categoryRowSelected]}
                  onPress={() => setCategory(cat)}
                  testID={`category-${cat}`}
                  accessibilityLabel={cat}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: category === cat }}
                >
                  <Text style={[s.categoryText, category === cat && s.categoryTextSelected]}>
                    {cat}
                  </Text>
                  {category === cat && (
                    <Ionicons name="checkmark-circle" size={18} color={colours.primary} />
                  )}
                </TouchableOpacity>
              ))}

              <Text style={s.sectionLabel}>Additional details (optional)</Text>
              <TextInput
                style={s.descInput}
                placeholder="Describe the issue..."
                placeholderTextColor={colours.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={500}
                testID="report-description"
                accessibilityLabel="Report description"
              />
              <Text style={s.charCount}>{description.length}/500</Text>
            </ScrollView>

            <TouchableOpacity
              style={[s.submitBtn, !category && s.submitBtnDisabled]}
              onPress={handleSubmitReport}
              disabled={!category || reportMutation.isPending}
              testID="report-submit-btn"
              accessibilityLabel="Submit report"
            >
              {reportMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:               { backgroundColor: colours.background, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.xl, paddingBottom: spacing['3xl'], maxHeight: '80%' },
  handle:              { width: 40, height: 4, borderRadius: 2, backgroundColor: colours.border, alignSelf: 'center', marginBottom: spacing.lg },
  heading:             { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary, textAlign: 'center', marginBottom: spacing.lg },
  menuItem:            { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  menuLabel:           { flex: 1, fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.medium, color: colours.textPrimary },
  divider:             { height: 1, backgroundColor: colours.border, marginVertical: spacing.sm },
  cancelBtn:           { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText:          { fontSize: typography.fontSize.base, color: colours.textSecondary, fontFamily: typography.fontFamily.medium },
  reportHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  sectionLabel:        { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold, color: colours.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm, marginTop: spacing.md },
  categoriesScroll:    { maxHeight: 320 },
  categoryRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colours.border },
  categoryRowSelected: { backgroundColor: colours.primaryLight, marginHorizontal: -spacing.xl, paddingHorizontal: spacing.xl },
  categoryText:        { fontSize: typography.fontSize.base, color: colours.textPrimary, fontFamily: typography.fontFamily.regular },
  categoryTextSelected:{ fontFamily: typography.fontFamily.semiBold, color: colours.primary },
  descInput:           { borderWidth: 1, borderColor: colours.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.fontSize.sm, color: colours.textPrimary, minHeight: 80, textAlignVertical: 'top', fontFamily: typography.fontFamily.regular },
  charCount:           { fontSize: typography.fontSize.xs, color: colours.textMuted, textAlign: 'right', marginTop: 4, marginBottom: spacing.sm },
  submitBtn:           { backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  submitBtnDisabled:   { backgroundColor: colours.textMuted },
  submitText:          { color: '#fff', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.bold },
});
