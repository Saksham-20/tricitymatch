import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  SafeAreaView,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

const WHATSAPP_NUMBER = '919876543210';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=Hi+TricityShadi+Support%2C+I+need+help+with`;

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How do I get verified?',
    a: 'Go to Profile → Verification. Upload your Aadhaar or PAN for ID verification. Education and income tiers need degree/ITR documents. Admin reviews within 24–48 hours.',
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
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);
  };

  return (
    <TouchableOpacity style={s.faqItem} onPress={toggle} activeOpacity={0.7} testID="faq-item">
      <View style={s.faqRow}>
        <Text style={s.faqQ}>{q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colours.textSecondary}
        />
      </View>
      {open && <Text style={s.faqA}>{a}</Text>}
    </TouchableOpacity>
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
  return (
    <TouchableOpacity style={s.contactRow} onPress={onPress} testID={testID} accessibilityRole="button">
      <View style={s.contactIcon}>
        <Ionicons name={icon} size={22} color={colours.primary} />
      </View>
      <View style={s.contactText}>
        <Text style={s.contactLabel}>{label}</Text>
        <Text style={s.contactSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colours.textMuted} />
    </TouchableOpacity>
  );
}

export default function SupportScreen() {
  const nav = useNavigation();

  const openWhatsApp = () => {
    Linking.openURL(WHATSAPP_URL).catch(() => {
      Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`);
    });
  };

  const openEmail = () => {
    Linking.openURL('mailto:support@tricityshadi.com?subject=Support+Request');
  };

  return (
    <SafeAreaView style={s.safe} testID="SupportScreen">
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Help & Support</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.sectionTitle}>Contact Us</Text>
        <View style={s.contactCard}>
          <ContactRow
            icon="logo-whatsapp"
            label="WhatsApp Support"
            sub="Fastest — typically responds within 1 hour"
            onPress={openWhatsApp}
            testID="whatsapp-btn"
          />
          <View style={s.divider} />
          <ContactRow
            icon="mail-outline"
            label="Email Support"
            sub="support@tricityshadi.com"
            onPress={openEmail}
            testID="email-btn"
          />
        </View>

        <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
        <View style={s.faqCard}>
          {FAQ.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={s.divider} />}
              <FaqItem q={item.q} a={item.a} />
            </React.Fragment>
          ))}
        </View>

        <View style={s.footerNote}>
          <Ionicons name="information-circle-outline" size={16} color={colours.textMuted} />
          <Text style={s.footerText}>TricityShadi — Chandigarh, Mohali, Panchkula</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  title: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  scroll: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  contactCard: {
    backgroundColor: colours.surfaceCard,
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
    backgroundColor: colours.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: { flex: 1 },
  contactLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  contactSub: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
  },
  faqCard: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  faqItem: { padding: spacing.md },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  faqQ: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  faqA: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  divider: { height: 1, backgroundColor: colours.border },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  footerText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textMuted,
  },
});
