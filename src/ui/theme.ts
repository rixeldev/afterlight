import { useSettings } from '../state/settingsStore';

/**
 * AFTERLIGHT visual language: dusk forest, warm afterglow, calm glass surfaces.
 * Colors are deliberately desaturated so amber interactions always read as
 * "the thing you can touch".
 */
export const C = {
  ink: '#060E0C',
  bg: '#08130F',
  bgAlt: '#0C1A16',
  surface: '#10201B',
  surfaceRaised: '#162A23',
  glass: 'rgba(233,240,226,0.055)',
  glassStrong: 'rgba(233,240,226,0.1)',
  border: 'rgba(233,240,226,0.13)',
  borderStrong: 'rgba(233,240,226,0.24)',
  text: '#F2EEE2',
  textSecondary: '#C3CDBD',
  textMuted: '#8E9E90',
  accent: '#E8C98F',
  accentBright: '#F6DCA9',
  accentDim: 'rgba(232,201,143,0.16)',
  accentLine: 'rgba(232,201,143,0.4)',
  sage: '#9DB79B',
  moss: '#5F7A5E',
  forest: '#2C4437',
  danger: '#D98170',
  dangerDim: 'rgba(217,129,112,0.16)',
  warning: '#E0B875',
  success: '#93C08C',
  water: '#7FA9B6',
  health: '#D98170',
  hunger: '#D6B26E',
  thirst: '#7FA9B6',
  stamina: '#9DB79B',
  shadow: 'rgba(0,0,0,0.45)',
  scrim: 'rgba(3,8,7,0.72)',
  scrimStrong: 'rgba(3,8,7,0.9)',
  outline: '#2A3B33',
} as const;

export const FONT = {
  display: 'Sora_700Bold',
  displayMedium: 'Sora_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export const R = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

export const SP = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'micro';

export function useTextScale(): number {
  return useSettings((s) => (s.settings.largeText ? 1.14 : 1));
}

export function textStyle(variant: TextVariant, scale = 1) {
  const s = (v: number) => Math.round(v * scale);
  switch (variant) {
    case 'display':
      return { fontFamily: FONT.display, fontSize: s(34), lineHeight: s(40), letterSpacing: 0.4 };
    case 'title':
      return { fontFamily: FONT.display, fontSize: s(26), lineHeight: s(32), letterSpacing: 0.2 };
    case 'heading':
      return { fontFamily: FONT.displayMedium, fontSize: s(19), lineHeight: s(26) };
    case 'body':
      return { fontFamily: FONT.body, fontSize: s(15), lineHeight: s(22) };
    case 'label':
      return { fontFamily: FONT.semibold, fontSize: s(13), lineHeight: s(18), letterSpacing: 0.3 };
    case 'caption':
      return { fontFamily: FONT.medium, fontSize: s(12), lineHeight: s(16), letterSpacing: 0.2 };
    case 'micro':
      return { fontFamily: FONT.semibold, fontSize: s(10), lineHeight: s(13), letterSpacing: 1.1 };
  }
}

export const QUALITY_LABEL: Record<string, string> = {
  low: 'settings.graphics.low',
  medium: 'settings.graphics.medium',
  high: 'settings.graphics.high',
};
