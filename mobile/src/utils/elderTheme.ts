import { typography, tapTarget } from '@shared/constants/theme';

const ELDER_FONT_BUMP = 4;

export const elderFontSize = {
  xs:    typography.fontSize.xs   + ELDER_FONT_BUMP,
  sm:    typography.fontSize.sm   + ELDER_FONT_BUMP,
  base:  typography.fontSize.base + ELDER_FONT_BUMP,
  lg:    typography.fontSize.lg   + ELDER_FONT_BUMP,
  xl:    typography.fontSize.xl   + ELDER_FONT_BUMP,
  '2xl': typography.fontSize['2xl'] + ELDER_FONT_BUMP,
  '3xl': typography.fontSize['3xl'] + ELDER_FONT_BUMP,
  '4xl': typography.fontSize['4xl'] + ELDER_FONT_BUMP,
} as const;

export function fontSize(elder: boolean, key: keyof typeof typography.fontSize): number {
  return elder ? elderFontSize[key] : typography.fontSize[key];
}

export function tapSize(elder: boolean): number {
  return elder ? tapTarget.elder : tapTarget.default;
}
