/**
 * Pre-permission priming sheet (mounted once in MainNavigator). Fires when
 * notifPrime.requestNotifPrime() is called after the first like. Accept flips
 * the stored state and mounts push registration (which triggers the real OS
 * prompt); "Not now" stores a decline and never asks again.
 */
import React, { useEffect, useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import Text from './ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { type ThemeColours, spacing, borderRadius } from '@shared/constants/theme';
import { PressableScale } from './motion';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { onNotifPrimeRequest, setNotifPrimeState } from '../utils/notifPrime';

interface Props {
  /** Called on accept — the parent flips push registration on. */
  onAccepted: () => void;
}

export default function NotificationPrimingSheet({ onAccepted }: Props) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const [visible, setVisible] = useState(false);

  useEffect(() => onNotifPrimeRequest(() => setVisible(true)), []);

  const accept = () => {
    setNotifPrimeState('accepted');
    setVisible(false);
    onAccepted();
  };
  const decline = () => {
    setNotifPrimeState('declined');
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={decline}>
      <View style={styles.scrim}>
        <View style={styles.sheet} testID="notif-priming-sheet">
          <View style={styles.iconWrap}>
            <Ionicons name="heart" size={26} color={c.accent} />
          </View>
          <Text variant="title2" color="fgStrong" style={styles.title}>{t('notifPrime.title', 'Know the moment they like you back')}</Text>
          <Text variant="footnote" color="textMuted" style={styles.sub}>
            {t('notifPrime.sub', "We'll only notify you about the things that matter — mutual likes, new messages and interest in your profile. No noise.")}
          </Text>
          <PressableScale haptic style={styles.cta} onPress={accept} accessibilityRole="button" testID="notif-accept">
            <Text variant="headline" color="onPrimary">{t('notifPrime.cta', 'Turn on notifications')}</Text>
          </PressableScale>
          <PressableScale style={styles.later} onPress={decline} accessibilityRole="button" testID="notif-decline">
            <Text variant="subhead" color="textMuted">{t('notifPrime.later', 'Not now')}</Text>
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
    alignItems: 'center',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: c.accentSoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: c.primary,
    borderRadius: borderRadius.pill,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  later: { marginTop: spacing.md, minHeight: 44, justifyContent: 'center' },
});
