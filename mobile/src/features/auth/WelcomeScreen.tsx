import React, { useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Screen from '../../components/layout/Screen';
import { PressableScale, useReduceMotion } from '../../components/motion';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { useUIStore } from '../../stores/uiStore';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { tapSize } from '../../utils/elderTheme';
import Logo from '../../components/common/Logo';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

// Horizontal inset of the value-prop rail; a card is the window minus both sides.
const RAIL_INSET = 32;

// Every line here is a claim a stranger reads before they trust us with a
// phone number, so each one is something the product does today: the badge is
// earned through a human-reviewed selfie (not a promise that every profile is
// pre-checked), and privacy is described as the controls in Settings > Privacy
// (profile visible to everyone or matches only, online status), not as a default.
const VALUE_PROPS: {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  titleFallback: string;
  subtitleKey: string;
  subtitleFallback: string;
}[] = [
  {
    icon: 'shield-checkmark-outline',
    titleKey: 'welcome.cards.badges.title',
    titleFallback: 'Verified badges are earned',
    subtitleKey: 'welcome.cards.badges.subtitle',
    subtitleFallback: 'A person reviews every verification selfie before a profile gets the badge.',
  },
  {
    icon: 'lock-closed-outline',
    titleKey: 'welcome.cards.privacy.title',
    titleFallback: 'Privacy you control',
    subtitleKey: 'welcome.cards.privacy.subtitle',
    subtitleFallback: 'Show your profile to everyone or to matches only, and choose whether your online status is visible.',
  },
  {
    icon: 'heart-outline',
    titleKey: 'welcome.cards.match.title',
    titleFallback: 'Find your match',
    subtitleKey: 'welcome.cards.match.subtitle',
    subtitleFallback: 'Hyperlocal matching for Chandigarh, Mohali & Panchkula families.',
  },
];

// `name` is the screen-reader label: the on-screen glyphs are EN / हि / ਪੰ,
// which a voice would read as "en" and as two letters, not as a language.
const LANGUAGES: { code: 'en' | 'hi' | 'pa'; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hi', label: 'हि', name: 'Hindi' },
  { code: 'pa', label: 'ਪੰ', name: 'Punjabi' },
];

export default function WelcomeScreen() {
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const { t, i18n } = useTranslation();
  const { language, setLanguage } = useUIStore();
  const reduced = useReduceMotion();
  // Live window width, not a module-scope constant: rotation, split-screen and
  // tablet windows all resize the rail.
  const { width } = useWindowDimensions();
  const cardWidth = width - RAIL_INSET * 2;
  const hit = tapSize(elder);
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Commit the page once the swipe settles. A per-frame onScroll + setState
  // re-renders the screen on the JS thread mid-gesture (doctrine §10.4).
  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    setActiveIndex(Math.max(0, Math.min(VALUE_PROPS.length - 1, idx)));
  };

  // Visible tap fallback for the swipe: the page dots are buttons.
  const goToCard = (i: number) => {
    setActiveIndex(i);
    scrollRef.current?.scrollTo({ x: i * cardWidth, animated: !reduced });
  };

  const handleLanguageChange = (code: 'en' | 'hi' | 'pa') => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  return (
    <Screen
      edges={['top']}
      scroll
      contentContainerStyle={styles.scrollContent}
      style={styles.container}
      testID="WelcomeScreen"
    >
      {/* Language selector */}
      <View style={styles.langRow} testID="WelcomeScreen-langSelector">
        {LANGUAGES.map((lang) => {
          const selected = language === lang.code;
          return (
            <PressableScale
              key={lang.code}
              haptic
              style={[
                styles.langBtn,
                selected && styles.langBtnActive,
                // A real target in both directions, not slop: the हि and ਪੰ glyphs are
                // narrow, and a hitSlop below the pill is lost to the hero it sits against.
                { minWidth: hit, minHeight: hit },
              ]}
              onPress={() => handleLanguageChange(lang.code)}
              accessibilityLabel={t('welcome.switchLanguage', { defaultValue: 'Switch to {{language}}', language: lang.name })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID={`WelcomeScreen-lang-${lang.code}`}
            >
              <Text variant="subhead" color={selected ? 'textPrimary' : 'textSecondary'}>
                {lang.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Logo variant="stacked" size="lg" />
        <Text variant="footnote" color="textSecondary" style={styles.heroSubtitle}>{t('welcome.region', 'Chandigarh · Mohali · Panchkula')}</Text>
      </View>

      {/* Value prop cards — horizontal scroll */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.cardsScroll}
        contentContainerStyle={styles.cardsContent}
        testID="WelcomeScreen-valuePropScroll"
        decelerationRate="fast"
        // The only snapping mechanism: RN documents snapToInterval as overriding
        // pagingEnabled, and the page width would be the window, not a card.
        snapToInterval={cardWidth}
        snapToAlignment="start"
      >
        {VALUE_PROPS.map((card, i) => {
          const title = t(card.titleKey, card.titleFallback);
          const subtitle = t(card.subtitleKey, card.subtitleFallback);
          return (
            <View
              key={i}
              style={[styles.card, { width: cardWidth }]}
              testID={`WelcomeScreen-card-${i}`}
              accessible
              accessibilityLabel={`${title}. ${subtitle}`}
            >
              <View style={styles.cardIconWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ionicons name={card.icon} size={26} color={c.primary} />
              </View>
              <Text variant="title3" color="textPrimary" style={styles.cardTitle}>{title}</Text>
              <Text variant="callout" color="textSecondary" style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Page dots: each one is a real 44pt target that jumps to its card */}
      <View style={styles.dots} testID="WelcomeScreen-dots">
        {VALUE_PROPS.map((card, i) => {
          const active = activeIndex === i;
          return (
            <PressableScale
              key={i}
              onPress={() => goToCard(i)}
              style={[styles.dotHit, { minWidth: hit, minHeight: hit }]}
              accessibilityRole="button"
              accessibilityLabel={t('welcome.showHighlight', {
                defaultValue: 'Show highlight {{n}} of {{total}}',
                n: i + 1,
                total: VALUE_PROPS.length,
              })}
              accessibilityState={{ selected: active }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID={`WelcomeScreen-dot-${i}`}
            >
              <View style={[styles.dot, active && styles.dotActive]} />
            </PressableScale>
          );
        })}
      </View>

      {/* CTA buttons */}
      <View style={styles.ctaContainer} testID="WelcomeScreen-ctas">
        {/* Navigation, not a commit: no haptic. */}
        <Button
          title={t('welcome.start', 'Get started')}
          onPress={() => navigation.navigate('Signup')}
          haptic={false}
          testID="WelcomeScreen-getStarted"
        />
        <PressableScale
          style={[styles.secondaryBtn, { minHeight: Math.max(48, hit) }]}
          onPress={() => navigation.navigate('Login')}
          accessibilityLabel={t('welcome.haveAccount', 'Already a member? Sign in')}
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="WelcomeScreen-signIn"
        >
          <Text variant="subhead" color="primary" style={styles.secondaryText}>{t('welcome.haveAccount', 'Already a member? Sign in')}</Text>
        </PressableScale>
      </View>
    </Screen>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  // flexGrow (not flex): at large OS text the content is taller than the window
  // and must scroll rather than clip the CTAs; at normal size it still fills the
  // window so the CTAs sit at the bottom.
  scrollContent: { flexGrow: 1 },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  langBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: c.border,
  },
  // Selected = accent-tinted, like the Chip primitive. A flat burgundy fill with
  // white text is only 4:1 on the dark-mode accent, and burgundy text on the
  // tint is 4.4:1 in dark mode, so the label stays neutral and the border and
  // fill carry the selection.
  langBtnActive: {
    backgroundColor: c.accentSoft,
    borderColor: c.accent,
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.lg,
    gap: 8,
  },
  heroSubtitle: {
    marginTop: 4,
  },
  cardsScroll: {
    flexGrow: 0,
    marginTop: spacing.lg,
  },
  cardsContent: {
    paddingHorizontal: RAIL_INSET,
  },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing['2xl'],
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
    marginRight: 0,
    backgroundColor: c.surfaceCard,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  cardSubtitle: {
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  // 44pt (60 in elder) hit box around an 8pt dot.
  dotHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // textMuted, not border: an inactive page dot is a button and its mark must
  // clear 3:1 on the canvas (c.border on c.background is ~1.2:1).
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.textMuted,
  },
  dotActive: {
    backgroundColor: c.primary,
    width: 20,
  },
  ctaContainer: {
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.lg,
    paddingBottom: spacing['4xl'],
    marginTop: 'auto',
    gap: spacing.md,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    justifyContent: 'center',
  },
  secondaryText: { textAlign: 'center' },
});
