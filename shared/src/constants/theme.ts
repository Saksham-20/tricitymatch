export const colours = {
  // Primary — Burgundy Rose (matches web #8B2346)
  primary:       '#8B2346',
  primaryDark:   '#6B1D3A',
  primaryLight:  '#FDF2F5',

  // Secondary — Royal Gold (matches web #C9A227)
  secondary:     '#C9A227',
  secondaryLight:'#FEFCE8',

  // Neutrals — cream-based to match web
  background:    '#FDF8F2',  // cream base
  surfaceCard:   '#F5EDE0',  // cream 2
  border:        '#E8D5C0',  // warm cream border
  textPrimary:   '#1A0A0F',  // near-black with warm tint
  textSecondary: '#6B4C57',  // warm dark muted
  textMuted:     '#7A5560',  // decorative/caption only — #9C8089 fails WCAG AA on cream

  // Status
  success:       '#2E7D32',
  warning:       '#F57C00',
  error:         '#C62828',
  info:          '#1565C0',

  // Verification badge colours
  badgeMobile:    '#2E7D32',
  badgeID:        '#1565C0',
  badgeEducation: '#6A1B9A',
  badgeIncome:    '#F57C00',

  // Plan tier colours
  planFree:    '#6B4C57',
  planPlus:    '#1565C0',
  planPremium: '#6A1B9A',
  planElite:   '#C9A227',
} as const;

export const typography = {
  fontFamily: {
    regular:        'Inter-Regular',
    medium:         'Inter-Medium',
    semiBold:       'Inter-SemiBold',
    bold:           'Inter-Bold',
    display:        'PlayfairDisplay-Bold',    // headings — matches web Playfair Display
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
} as const;

export const borderRadius = {
  sm:   6,
  md:   12,
  lg:   16,
  xl:   24,
  full: 9999,
} as const;

export const tapTarget = {
  default: 48,
  elder:   60,
} as const;

// Burgundy-tinted shadows — iOS uses shadowColor/Opacity/Radius, Android uses elevation
export const shadows = {
  sm: {
    shadowColor:  '#8B2346',
    shadowOpacity: 0.08,
    shadowRadius:  4,
    shadowOffset:  { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor:  '#8B2346',
    shadowOpacity: 0.12,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 2 },
    elevation: 4,
  },
  lg: {
    shadowColor:  '#8B2346',
    shadowOpacity: 0.18,
    shadowRadius:  16,
    shadowOffset:  { width: 0, height: 4 },
    elevation: 8,
  },
} as const;

// Cream palette — for backgrounds and surfaces
export const cream = {
  50:  '#FDFBF7',
  100: '#FDF8F2',
  200: '#F5EDE0',
  300: '#E8D5C0',
} as const;

// Dark mode colour overrides
export const darkColours = {
  primary:       '#E5A3B8', // softer burgundy on dark
  primaryDark:   '#8B2346',
  primaryLight:  '#2A0B17',

  secondary:     '#D4AF37',
  secondaryLight:'#1C1500',

  background:    '#0F0F0F',
  surfaceCard:   '#1A1A1A',
  border:        '#2D2D2D',
  textPrimary:   '#F9FAFB',
  textSecondary: '#D1C5C9',
  textMuted:     '#7A5560',

  success:       '#2E7D32',
  warning:       '#F57C00',
  error:         '#EF5350',
  info:          '#42A5F5',

  badgeMobile:    '#2E7D32',
  badgeID:        '#42A5F5',
  badgeEducation: '#AB47BC',
  badgeIncome:    '#F57C00',

  planFree:    '#9C8089',
  planPlus:    '#42A5F5',
  planPremium: '#AB47BC',
  planElite:   '#D4AF37',
} as const;
