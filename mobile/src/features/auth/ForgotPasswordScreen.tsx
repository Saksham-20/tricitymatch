import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { forgotPassword } from '../../api/auth';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr?.response?.status === 429) {
        setError('Too many requests. Please try again later.');
      } else {
        // Don't reveal whether email exists — show generic success to prevent enumeration
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.successContainer} testID="ForgotPasswordScreen-success">
        <View style={styles.successIcon}>
          <Ionicons name="mail-outline" size={30} color={c.primary} />
        </View>
        <Text variant="title3" color="textPrimary" style={styles.successTitle}>{t('auth.forgotPassword.success')}</Text>
        <Text variant="callout" color="textSecondary" style={styles.successSubtitle}>
          If an account exists for {email}, a reset link has been sent. Check your inbox.
        </Text>
        <PressableScale
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Login')}
          testID="ForgotPasswordScreen-backToLogin"
          accessibilityRole="button"
          accessibilityLabel={t('auth.forgotPassword.backToLogin')}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="headline" style={{ color: '#FFFFFF' }}>{t('auth.forgotPassword.backToLogin')}</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="ForgotPasswordScreen"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing['2xl'] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          testID="ForgotPasswordScreen-back"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={18} color={c.textSecondary} />
          <Text variant="subhead" color="textSecondary">{t('common.back')}</Text>
        </PressableScale>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="key-outline" size={28} color={c.primary} />
          </View>
          <Text variant="title1" color="textPrimary" style={styles.title}>{t('auth.forgotPassword.title')}</Text>
          <Text variant="callout" color="textSecondary">{t('auth.forgotPassword.subtitle')}</Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBanner} testID="ForgotPasswordScreen-error" accessibilityLiveRegion="polite">
            <Text variant="subhead" color="error">{error}</Text>
          </View>
        ) : null}

        {/* Email input */}
        <Input
          label={t('auth.forgotPassword.email')}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
          autoFocus
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
          accessibilityLabel={t('auth.forgotPassword.email')}
          testID="ForgotPasswordScreen-email"
        />

        {/* Submit */}
        <PressableScale
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={t('auth.forgotPassword.sendLink')}
          accessibilityState={{ disabled: loading }}
          testID="ForgotPasswordScreen-submit"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" testID="ForgotPasswordScreen-loader" />
          ) : (
            <Text variant="headline" style={{ color: '#FFFFFF' }}>{t('auth.forgotPassword.sendLink')}</Text>
          )}
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  scroll: { flex: 1 },
  content: { padding: spacing['2xl'] },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.lg, minHeight: 40, alignSelf: 'flex-start' },
  header: { marginBottom: spacing['2xl'], alignItems: 'flex-start' },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.sm,
  },
  errorBanner: {
    backgroundColor: c.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: c.error,
  },
  primaryBtn: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  successEmoji: { fontSize: 36 },
  successTitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  successSubtitle: {
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
});
