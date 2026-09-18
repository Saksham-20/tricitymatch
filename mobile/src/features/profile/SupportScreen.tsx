import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Text from '../../components/ui/Text';
import { PressableScale } from '../../components/motion';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { CONFIG } from '../../constants/config';

// Support channels come from config — an unconfigured channel is HIDDEN rather
// than rendered as a dead button. (This screen used to hardcode a placeholder
// WhatsApp number, so "WhatsApp Support" opened a chat with nobody.)
const WHATSAPP_NUMBER = CONFIG.SUPPORT_WHATSAPP;
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=Hi+TricityMatch+Support%2C+I+need+help+with`;

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How do I get verified?',
    a: 'Go to Profile → Verification and take a live selfie. Our team matches it against your profile photos and awards your verified badge — usually within 24–48 hours. We never ask for government ID.',
  },
  {
    q: 'Why can\'t I see phone numbers?',
    a: 'Contact details are unlocked with a Premium plan. Each unlock uses one of your monthly unlock credits. Upgrade under Profile → Subscription.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Settings → Account → Delete Account. Your data is permanently removed within 7 days as per our privacy policy.',
  },
  {
    q: 'My photos are blurred for others — why?',
    a: 'Photos are blurred until both parties mutually like each other. Once it\'s a mutual match, photos become visible.',
  },
  {
    q: 'How does the compatibility score work?',
    a: 'Score is calculated from shared religion, caste preferences, location, lifestyle, diet, and partner preferences. Higher = more compatible.',
  },
  {
    q: 'Can I use the app without internet?',
    a: 'Your shortlisted profiles are cached for offline viewing. Other features require an internet connection.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);
  };

  return (
    <PressableScale
      style={s.faqItem}
      onPress={toggle}
      testID="faq-item"
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={s.faqRow}>
        <Text variant="subhead" color="textPrimary" style={s.faqQ}>{q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={c.textSecondary}
        />
      </View>
      {open && <Text variant="footnote" color="textSecondary" style={s.faqA}>{a}</Text>}
    </PressableScale>
  );
}

function ContactRow({
  icon,
  label,
  sub,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub: string;
  onPress: () => void;
  testID?: string;
}) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <PressableScale
      style={s.contactRow}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={s.contactIcon}>
        <Ionicons name={icon} size={22} color={c.primary} />
      </View>
      <View style={s.contactText}>
        <Text variant="subhead" color="textPrimary">{label}</Text>
        <Text variant="footnote" color="textSecondary">{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
    </PressableScale>
  );
}

export default function SupportScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const nav = useNavigation();

  const openWhatsApp = () => {
    Linking.openURL(WHATSAPP_URL).catch(() => {
      Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`);
    });
  };

  const openEmail = () => {
    Linking.openURL(`mailto:${CONFIG.SUPPORT_EMAIL}?subject=Support+Request`);
  };

  return (
    <SafeAreaView style={s.safe} testID="SupportScreen">
      <View style={s.header}>
        <PressableScale
          onPress={() => nav.goBack()}
          style={s.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <Text variant="headline" color="textPrimary" style={s.title}>Help & Support</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text variant="caption" color="textSecondary" style={s.sectionTitle}>Contact Us</Text>
        <View style={s.contactCard}>
          {CONFIG.IS_WHATSAPP_CONFIGURED && (
            <>
              <ContactRow
                icon="logo-whatsapp"
                label="WhatsApp Support"
                sub="Chat with our team"
                onPress={openWhatsApp}
                testID="whatsapp-btn"
              />
              <View style={s.divider} />
            </>
          )}
          <ContactRow
            icon="mail-outline"
            label="Email Support"
            sub={CONFIG.SUPPORT_EMAIL}
            onPress={openEmail}
            testID="email-btn"
          />
        </View>

        <Text variant="caption" color="textSecondary" style={s.sectionTitle}>Frequently Asked Questions</Text>
        <View style={s.faqCard}>
          {FAQ.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={s.divider} />}
              <FaqItem q={item.q} a={item.a} />
            </React.Fragment>
          ))}
        </View>

        <View style={s.footerNote}>
          <Ionicons name="information-circle-outline" size={16} color={c.textMuted} />
          <Text variant="footnote" color="textMuted">TricityMatch — Chandigarh, Mohali, Panchkula</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  title: {
    flex: 1,
  },
  scroll: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  contactCard: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: { flex: 1 },
  faqCard: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  faqItem: { padding: spacing.md },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  faqQ: {
    flex: 1,
  },
  faqA: {
    marginTop: spacing.sm,
  },
  divider: { height: 1, backgroundColor: c.border },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
