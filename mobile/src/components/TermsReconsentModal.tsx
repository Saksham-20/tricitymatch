/**
 * Shown over the whole app when the Terms have changed since the version this
 * member accepted (`user.requiresReconsent`, set by the server). The server also
 * refuses every other request until they accept, so this and signing out are the
 * only ways forward. Mounted once in RootNavigator.
 */
import React, { useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { type ThemeColours, spacing, borderRadius } from '@shared/constants/theme';
import Text from './ui/Text';
import { PressableScale } from './motion';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../stores/authStore';
import { acceptTerms } from '../api/auth';
import { showToast } from '../utils/toast';

export default function TermsReconsentModal() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const { user, isAuthenticated, setUser, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const visible = Boolean(isAuthenticated && user?.requiresReconsent);
  if (!visible || !user) return null;

  const accept = async () => {
    if (!agreed || busy || !user.currentTermsVersion) return;
    setBusy(true);
    try {
      await acceptTerms(user.currentTermsVersion);
      setUser({ ...user, requiresReconsent: false });
      // Whatever screens fetched while blocked came back 403; refetch cleanly.
      queryClient.invalidateQueries();
    } catch {
      showToast.error(t('reconsent.failed', 'Could not save your choice'), t('reconsent.tryAgain', 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.scrim}>
        <View style={styles.sheet} testID="terms-reconsent">
          <Text variant="title2" color="fgStrong" style={styles.title} accessibilityRole="header">
            {t('reconsent.title', 'We have updated our Terms')}
          </Text>
          <Text variant="footnote" color="textMuted" style={styles.sub}>
            {t('reconsent.body', 'Please read the updated Terms and Privacy Policy and accept them to keep using TricityMatch. Your profile and matches are unchanged.')}
          </Text>
          <PressableScale
            haptic
            style={styles.row}
            onPress={() => setAgreed((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel={t('reconsent.agree', 'I agree to the updated Terms and Privacy Policy')}
            testID="reconsent-checkbox"
          >
            <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={22} color={agreed ? c.primary : c.textMuted} />
            <Text variant="footnote" color="textSecondary" style={styles.rowText}>
              {t('reconsent.agree', 'I agree to the updated Terms and Privacy Policy')}
            </Text>
          </PressableScale>
          <PressableScale
            haptic
            style={[styles.cta, (!agreed || busy) && styles.ctaOff]}
            onPress={accept}
            disabled={!agreed || busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: !agreed || busy }}
            testID="reconsent-accept"
          >
            <Text variant="headline" color="onPrimary">{t('reconsent.accept', 'Accept and continue')}</Text>
          </PressableScale>
          <PressableScale style={styles.later} onPress={() => logout()} accessibilityRole="button">
            <Text variant="subhead" color="textMuted">{t('reconsent.signOut', 'Sign out')}</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.sheetBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, marginBottom: spacing.lg },
  rowText: { flex: 1 },
  cta: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.pill,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOff: { opacity: 0.5 },
  later: { marginTop: spacing.md, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
