// ============================================================================
// TricityShadi — native mobile design tokens
// Ported from the native handoff `ts-mobile.css`. Brand palette is LOCKED:
//   burgundy = accent only (borders/ticks/active/CTA — never flat-fill large areas)
//   gold     = premium signal only (VIP, locks, "Most Popular", boost)
// Legacy keys (primary/surfaceCard/textPrimary/…) are preserved for back-compat;
// new keys (ramps p50…p900 / g50…g700 / n50…n900, semantic surface2/fgStrong/
// accentSoft/hairline/scrim, gold helpers) come from the handoff.
// ============================================================================

export const colours = {
  // ── Burgundy ramp (primary accent) ─────────────────────────────────────────
  p50:  '#FDF2F5', p100: '#F8E8EC', p200: '#F0CDD7', p300: '#E5A3B8', p400: '#D66E8E',
  p500: '#8B2346', p600: '#6B1D3A', p700: '#55172E', p800: '#401123', p900: '#2A0B17',

  // ── Gold ramp (premium signal only) ────────────────────────────────────────
  g50:  '#FEFCF3', g100: '#FDF6E3', g200: '#F9EABC', g300: '#F2D88A', g400: '#E8C34A',
  g500: '#C9A227', g600: '#B8941F', g700: '#96781A',

  // ── Neutral ramp ───────────────────────────────────────────────────────────
  n50:  '#FAFAFA', n100: '#F5F5F5', n200: '#E8E8E8', n300: '#D4D4D4', n400: '#A3A3A3',
  n500: '#8B8B8B', n600: '#5A5A5A', n700: '#404040', n800: '#2D2D2D', n900: '#1A1A1A',

  // ── Legacy brand aliases (kept for existing call sites) ─────────────────────
  primary:       '#8B2346',
  primaryDark:   '#6B1D3A',
  primaryLight:  '#FDF2F5',
  secondary:     '#C9A227',
  secondaryLight:'#FEFCE8',

  // ── Semantic — LIGHT ───────────────────────────────────────────────────────
  background:    '#FAFAFA',
  surfaceCard:   '#FFFFFF',
  surface2:      '#F5F5F5',
  surface3:      '#FBFBFB',
  border:        '#E8E8E8',
  hairline:      'rgba(0,0,0,0.08)',
  textPrimary:   '#2D2D2D',
  fgStrong:      '#1A1A1A',
  textSecondary: '#5A5A5A',
  textMuted:     '#8B8B8B',
  muted:         '#8B8B8B',

  accent:        '#8B2346',
  accentSoft:    '#FDF2F5',
  accentSoft2:   '#F8E8EC',
  goldSoft:      '#FDF6E3',
  goldText:      '#3D2914', // legible foreground on gold fills

  sheetBg:       '#FFFFFF',
  scrim:         'rgba(20,8,14,0.42)',

  // ── Status ─────────────────────────────────────────────────────────────────
  success:       '#2E7D32',
  warning:       '#F57C00',
  error:         '#C62828',
  info:          '#1565C0',
  successBg:     '#E8F5E9',
  warningBg:     '#FFF3E0',
  errorBg:       '#FFEBEE',
  infoBg:        '#E3F2FD',

  // ── Verification badge colours ──────────────────────────────────────────────
  badgeMobile:    '#2E7D32',
  badgeID:        '#1565C0',
  badgeEducation: '#6A1B9A',
  badgeIncome:    '#F57C00',

  // ── Plan tier colours — burgundy ramp + gold VIP ───────────────────────────
  planFree:    '#6B4C57',
  planPlus:    '#8B2346',
  planPremium: '#6B1D3A',
  planElite:   '#C9A227',

  onPrimary:   '#FFFFFF',
} as const;

// ── Named type scale (RN points; lineHeight is absolute, RN has no unitless) ──
// fontFamily uses the six faces loaded via expo-font.
export const type = {
  display:  { fontFamily: 'PlayfairDisplay-Bold',    fontSize: 34, lineHeight: 40 },
  title1:   { fontFamily: 'PlayfairDisplay-Bold',    fontSize: 28, lineHeight: 34 },
  title2:   { fontFamily: 'PlayfairDisplay-Bold',    fontSize: 22, lineHeight: 28 },
  title3:   { fontFamily: 'Inter-SemiBold',          fontSize: 20, lineHeight: 25 },
  headline: { fontFamily: 'Inter-SemiBold',          fontSize: 17, lineHeight: 22 },
  body:     { fontFamily: 'Inter-Regular',           fontSize: 17, lineHeight: 23 },
  callout:  { fontFamily: 'Inter-Regular',           fontSize: 16, lineHeight: 21 },
  subhead:  { fontFamily: 'Inter-Medium',            fontSize: 15, lineHeight: 20 },
  footnote: { fontFamily: 'Inter-Regular',           fontSize: 13, lineHeight: 18 },
  caption:  { fontFamily: 'Inter-SemiBold',          fontSize: 12, lineHeight: 16 },
  micro:    { fontFamily: 'Inter-SemiBold',          fontSize: 11, lineHeight: 13 },
} as const;

export const typography = {
  fontFamily: {
    regular:        'Inter-Regular',
    medium:         'Inter-Medium',
    semiBold:       'Inter-SemiBold',
    bold:           'Inter-Bold',
    display:        'PlayfairDisplay-Bold',
    displayRegular: 'PlayfairDisplay-Regular',
  },
  fontSize: {
    xs:   12,
    sm:   14,
    base: 16,
    lg:   18,
    xl:   20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    tight:   1.25,
    normal:  1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    eyebrow: 1.2,
  },
} as const;

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  gutter: 18, // handoff screen gutter
} as const;

// Handoff radii: sm 10 · md 14 · lg 20 · xl 28 · pill 999
export const borderRadius = {
  sm:   10,
  md:   14,
  lg:   20,
  xl:   28,
  pill: 9999,
  full: 9999,
} as const;

export const tapTarget = {
  default: 48,
  elder:   60,
} as const;

// Burgundy-tinted elevation ramp (e1…e4) + gold. iOS shadow* / Android elevation.
export const shadows = {
  e1: { shadowColor: '#8B2346', shadowOpacity: 0.06, shadowRadius: 2,  shadowOffset: { width: 0, height: 1 },  elevation: 1 },
  e2: { shadowColor: '#8B2346', shadowOpacity: 0.08, shadowRadius: 8,  shadowOffset: { width: 0, height: 2 },  elevation: 3 },
  e3: { shadowColor: '#8B2346', shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },  elevation: 6 },
  e4: { shadowColor: '#8B2346', shadowOpacity: 0.16, shadowRadius: 40, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  gold:{ shadowColor: '#C9A227', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  // legacy aliases
  sm: { shadowColor: '#8B2346', shadowOpacity: 0.08, shadowRadius: 4,  shadowOffset: { width: 0, height: 1 },  elevation: 2 },
  md: { shadowColor: '#8B2346', shadowOpacity: 0.12, shadowRadius: 8,  shadowOffset: { width: 0, height: 2 },  elevation: 4 },
  lg: { shadowColor: '#8B2346', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },  elevation: 8 },
} as const;

// Dark-mode shadows are black-based (burgundy tint disappears on navy).
export const darkShadows = {
  e1: { shadowColor: '#000', shadowOpacity: 0.40, shadowRadius: 2,  shadowOffset: { width: 0, height: 1 },  elevation: 1 },
  e2: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 8,  shadowOffset: { width: 0, height: 2 },  elevation: 3 },
  e3: { shadowColor: '#000', shadowOpacity: 0.50, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },  elevation: 6 },
  e4: { shadowColor: '#000', shadowOpacity: 0.60, shadowRadius: 40, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  gold:{ shadowColor: '#C9A227', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
} as const;

export const cream = {
  50:  '#FDFBF7',
  100: '#FDF8F2',
  200: '#F5EDE0',
  300: '#E8D5C0',
} as const;

// ── Dark (navy) mode ──────────────────────────────────────────────────────────
export const darkColours = {
  // ramps remapped for dark surfaces
  p50:  '#20131A', p100: '#3A1626', p200: '#4A1C30', p300: '#E5A3B8', p400: '#D66E8E',
  p500: '#8B2346', p600: '#6B1D3A', p700: '#55172E', p800: '#401123', p900: '#2A0B17',

  g50:  '#221C0D', g100: '#221C0D', g200: '#F9EABC', g300: '#F2D88A', g400: '#E8C34A',
  g500: '#C9A227', g600: '#B8941F', g700: '#96781A',

  n50:  '#0F1117', n100: '#1A1F2E', n200: '#303748', n300: '#3A4257', n400: '#5A6478',
  n500: '#94A3B8', n600: '#B0B8C8', n700: '#C5CFDB', n800: '#E2E8F0', n900: '#F1F5F9',

  primary:       '#C75D7E', // dark accent (handoff --accent)
  primaryDark:   '#8B2346',
  primaryLight:  '#2A1020',
  secondary:     '#D4AF37',
  secondaryLight:'#1C1500',

  background:    '#0F1117',
  surfaceCard:   '#1A1F2E',
  surface2:      '#252B3B',
  surface3:      '#161B27',
  border:        '#303748',
  hairline:      'rgba(255,255,255,0.08)',
  textPrimary:   '#E2E8F0',
  fgStrong:      '#F1F5F9',
  textSecondary: '#B0B8C8',
  textMuted:     '#94A3B8',
  muted:         '#94A3B8',

  accent:        '#C75D7E',
  accentSoft:    '#2A1020',
  accentSoft2:   '#3A1626',
  goldSoft:      '#221C0D',
  goldText:      '#3D2914',

  sheetBg:       '#1A1F2E',
  scrim:         'rgba(0,0,0,0.55)',

  success:       '#2E7D32',
  warning:       '#F57C00',
  error:         '#EF5350',
  info:          '#42A5F5',
  successBg:     '#13251A',
  warningBg:     '#2A1D0C',
  errorBg:       '#2A1113',
  infoBg:        '#0E2236',

  badgeMobile:    '#2E7D32',
  badgeID:        '#42A5F5',
  badgeEducation: '#AB47BC',
  badgeIncome:    '#F57C00',

  planFree:    '#9C8089',
  planPlus:    '#E5A3B8',
  planPremium: '#C77B92',
  planElite:   '#D4AF37',

  onPrimary:   '#FFFFFF',
} as const;

export type Palette = typeof colours;
