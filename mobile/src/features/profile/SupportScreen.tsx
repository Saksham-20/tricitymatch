import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Text from '../../components/ui/Text';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Screen from '../../components/layout/Screen';
import { PressableScale } from '../../components/motion';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { CONFIG } from '../../constants/config';
import { showToast } from '../../utils/toast';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// Decorative glyphs sit beside a text label; the screen reader reads the label.
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

// Support channels come from config — an unconfigured channel is HIDDEN rather
// than rendered as a dead button. (This screen used to hardcode a placeholder
// WhatsApp number, so "WhatsApp Support" opened a chat with nobody.)
const WHATSAPP_NUMBER = CONFIG.SUPPORT_WHATSAPP;
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=Hi+TricityMatch+Support%2C+I+need+help+with`;

// Every answer here must match shipped behaviour and the website's Help Centre
// (frontend/src/pages/Help.jsx). Three of these used to state things that were
// not true: "monthly unlock credits" (unlocks belong to the plan and last until
// it expires), "photos are blurred until a mutual match" (blur is a member's
// own opt-in, not the default), and "horoscope is never folded into the score"
// (backend/utils/compatibility.js gives horoscope 20 of its points). Change
// these and the web copy together.
const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How do I get verified?',
    a: 'Go to Settings, then Verification, and take a live selfie. Our team compares it by hand against your profile photos and awards the verified badge, usually within 24–48 hours. We never accept an uploaded photo and never ask for a government ID.',
  },
  {
    q: 'Why can\'t I see phone numbers?',
    a: 'Each contact unlock reveals one member\'s phone number and email. Unlocks come with your plan and stay valid until it expires. You can see your plan under Settings, then Subscription.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Settings, then Account actions, then Delete account. You confirm with your password. Your profile, photos, verification selfie, messages, matches and guardian links are erased immediately and cannot be recovered. We keep payment records as long as tax law requires, and a moderation record if you were reported, as described in our Privacy Policy.',
  },
  {
    q: 'Who can see my photos?',
    a: 'You choose under Settings, then Privacy Controls. You can be visible to everyone or only to your matches, and hide your online status and last-seen time.',
  },
  {
    q: 'How does the compatibility score work?',
    a: 'The score is out of 100. It combines age, city, height, religion, education, lifestyle (diet, smoking and drinking), horoscope (Ashtakoot and Manglik, when both of you have entered them), shared interests and your stated partner preferences. Tap the score on any profile for the breakdown.',
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

  return (
    <View>
      {/* The question is the control; the answer is a sibling so a screen reader
          can reach it (an accessible parent would swallow it). */}
      <PressableScale
        style={s.faqHead}
        onPress={() => setOpen((o) => !o)}
        testID="faq-item"
        accessibilityRole="button"
        accessibilityLabel={q}
        accessibilityState={{ expanded: open }}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text variant="subhead" color="textPrimary" style={s.faqQ}>{q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={c.textSecondary}
          {...HIDE_FROM_A11Y}
        />
      </PressableScale>
      {open ? (
        // Opacity only, on the UI thread, from the motion tokens; kept under Reduce Motion.
        <Animated.View
          entering={FadeIn.duration(duration.accordion).easing(Easing.bezier(...EASE_OUT).factory())}
          style={s.faqAWrap}
        >
          <Text variant="footnote" color="textSecondary">{a}</Text>
        </Animated.View>
      ) : null}
    </View>
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
      accessibilityLabel={`${label}, ${sub}`}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={s.contactIcon} {...HIDE_FROM_A11Y}>
        <Ionicons name={icon} size={22} color={c.primary} />
      </View>
      <View style={s.contactText}>
        <Text variant="subhead" color="textPrimary">{label}</Text>
        <Text variant="footnote" color="textSecondary">{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textMuted} {...HIDE_FROM_A11Y} />
    </PressableScale>
  );
}

export default function SupportScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const navigation = useNavigation<Nav>();

  const openWhatsApp = () => {
    Linking.openURL(WHATSAPP_URL).catch(() =>
      Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`).catch(() =>
        showToast.error('Could not open WhatsApp', 'Try email instead.'),
      ),
    );
  };

  // A device with no mail app rejects mailto:. Say where to write instead of
  // failing silently.
  const openEmail = () => {
    Linking.openURL(`mailto:${CONFIG.SUPPORT_EMAIL}?subject=Support+Request`).catch(() =>
      showToast.info('No email app found', `Write to ${CONFIG.SUPPORT_EMAIL}`),
    );
  };

  return (
    <Screen edges={['top', 'bottom']} style={s.safe} testID="SupportScreen">
      <ScreenHeader title="Help & Support" testID="support-header" />

      <ScrollView contentContainerStyle={s.scroll}>
        <Text variant="caption" color="textSecondary" style={s.sectionTitle} accessibilityRole="header">Contact us</Text>
        <View style={s.contactCard}>
          {CONFIG.IS_WHATSAPP_CONFIGURED && (
            <>
              <ContactRow
                icon="logo-whatsapp"
                label="WhatsApp support"
                sub="Chat with our team"
                onPress={openWhatsApp}
                testID="whatsapp-btn"
              />
              <View style={s.divider} />
            </>
          )}
          <ContactRow
            icon="mail-outline"
            label="Email support"
            sub={CONFIG.SUPPORT_EMAIL}
            onPress={openEmail}
            testID="email-btn"
          />
          <View style={s.divider} />
          <ContactRow
            icon="chatbubble-ellipses-outline"
            label="Send a message"
            sub="Use the contact form"
            onPress={() => navigation.navigate('Contact')}
            testID="contact-form-btn"
          />
        </View>

        <Text variant="caption" color="textSecondary" style={s.sectionTitle} accessibilityRole="header">Frequently asked questions</Text>
        <View style={s.faqCard}>
          {FAQ.map((item, i) => (
            <React.Fragment key={item.q}>
              {i > 0 && <View style={s.divider} />}
              <FaqItem q={item.q} a={item.a} />
            </React.Fragment>
          ))}
        </View>

        <View style={s.footerNote}>
          <Ionicons name="information-circle-outline" size={16} color={c.textMuted} {...HIDE_FROM_A11Y} />
          <Text variant="footnote" color="textSecondary">TricityMatch · Chandigarh, Mohali, Panchkula</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  safe: { backgroundColor: c.background },
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
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    padding: spacing.md,
  },
  faqQ: {
    flex: 1,
  },
  faqAWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
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
