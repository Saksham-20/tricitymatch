import React, { useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { PressableScale } from '../../components/motion';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/types';
import { useUIStore } from '../../stores/uiStore';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import Logo from '../../components/common/Logo';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const VALUE_PROPS: {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  titleFallback: string;
  subtitleKey: string;
  subtitleFallback: string;
}[] = [
  {
    icon: 'shield-checkmark-outline',
    titleKey: 'welcome.verified.title',
    titleFallback: 'Verified Profiles',
    subtitleKey: 'welcome.verified.subtitle',
    subtitleFallback: 'Every profile is manually reviewed and verified for authenticity.',
  },
  {
    icon: 'lock-closed-outline',
    titleKey: 'welcome.private.title',
    titleFallback: 'Private & Safe',
    subtitleKey: 'welcome.private.subtitle',
    subtitleFallback: 'Your photos and contact are protected. Share only when you choose.',
  },
  {
    icon: 'heart-outline',
    titleKey: 'welcome.match.title',
    titleFallback: 'Find Your Match',
    subtitleKey: 'welcome.match.subtitle',
    subtitleFallback: 'Hyperlocal matching for Chandigarh, Mohali & Panchkula families.',
  },
];

const LANGUAGES: { code: 'en' | 'hi' | 'pa'; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
  { code: 'pa', label: 'ਪੰ' },
];

export default function WelcomeScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const { t, i18n } = useTranslation();
  const { language, setLanguage } = useUIStore();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 64));
    setActiveIndex(Math.max(0, Math.min(VALUE_PROPS.length - 1, idx)));
  };

  const handleLanguageChange = (code: 'en' | 'hi' | 'pa') => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  return (
    <Screen edges={['top']} style={styles.container} testID="WelcomeScreen">
      {/* Language selector */}
      <View style={[styles.langRow, { paddingTop: spacing.lg }]} testID="WelcomeScreen-langSelector">
        {LANGUAGES.map((lang) => (
          <PressableScale
            key={lang.code}
            style={[styles.langBtn, language === lang.code && styles.langBtnActive]}
            onPress={() => handleLanguageChange(lang.code)}
            accessibilityLabel={`Switch to ${lang.code} language`}
            accessibilityRole="button"
            accessibilityState={{ selected: language === lang.code }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID={`WelcomeScreen-lang-${lang.code}`}
          >
            <Text variant="subhead" color="textSecondary" style={language === lang.code ? { color: '#FFFFFF' } : undefined}>
              {lang.label}
            </Text>
          </PressableScale>
        ))}
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Logo variant="stacked" size="lg" />
        <Text variant="footnote" color="textSecondary" style={styles.heroSubtitle}>Chandigarh · Mohali · Panchkula</Text>
      </View>

      {/* Value prop cards — horizontal scroll */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.cardsScroll}
        contentContainerStyle={styles.cardsContent}
        testID="WelcomeScreen-valuePropScroll"
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH - 64}
        snapToAlignment="start"
      >
        {VALUE_PROPS.map((card, i) => (
          <View
            key={i}
            style={styles.card}
            testID={`WelcomeScreen-card-${i}`}
          >
            <View style={styles.cardIconWrap}>
              <Ionicons name={card.icon} size={26} color={c.primary} />
            </View>
            <Text variant="title3" color="textPrimary" style={styles.cardTitle}>{t(card.titleKey, card.titleFallback)}</Text>
            <Text variant="callout" color="textSecondary" style={styles.cardSubtitle}>{t(card.subtitleKey, card.subtitleFallback)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View style={styles.dots} testID="WelcomeScreen-dots">
        {VALUE_PROPS.map((_, i) => (
          <View key={i} style={[styles.dot, activeIndex === i && styles.dotActive]} />
        ))}
      </View>

      {/* CTA buttons */}
      <View style={styles.ctaContainer} testID="WelcomeScreen-ctas">
        <PressableScale
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Signup')}
          accessibilityLabel={t('welcome.getStarted', 'Get Started')}
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="WelcomeScreen-getStarted"
        >
          <Text variant="headline" style={{ color: '#FFFFFF' }}>{t('welcome.getStarted', 'Get Started')}</Text>
        </PressableScale>
        <PressableScale
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Login')}
          accessibilityLabel={t('welcome.signIn', 'Already a member? Sign In')}
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="WelcomeScreen-signIn"
        >
          <Text variant="subhead" color="primary">{t('welcome.signIn', 'Already a member? Sign In')}</Text>
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
  langRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: c.border,
  },
  langBtnActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
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
    paddingHorizontal: 32,
  },
  card: {
    width: SCREEN_WIDTH - 64,
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
    gap: 8,
    marginTop: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.border,
  },
  dotActive: {
    backgroundColor: c.primary,
    width: 20,
  },
  ctaContainer: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['4xl'],
    marginTop: 'auto',
    gap: spacing.md,
  },
  primaryBtn: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
});
