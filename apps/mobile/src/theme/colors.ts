/**
 * @file Horizon Mobile Theme Tokens — Billion-Dollar Green & White Luxury Design System
 * Clean white surfaces, subtle sage/off-white canvas, rich forest green accents,
 * fresh emerald status indicators, and financial-grade typography without glowing neon effects.
 */

export interface ThemeTokens {
  mode: 'dark' | 'light';

  // Surface & Background Tokens
  background: string;
  surface: string;
  surfaceCard: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  card: string;
  input: string;
  inputBackground: string;
  navigation: string;
  navigationBorder: string;
  modal: string;
  divider: string;

  // Borders
  border: string;
  borderLight: string;
  borderSubtle: string;
  borderHighlight: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Green Brand Palette & Compatibility Aliases
  primary: string;
  primaryLight: string;
  primaryMuted: string;
  primaryPurple: string;
  secondaryPurple: string;
  electricPurple: string;
  deepViolet: string;
  softLavender: string;
  purpleGlow: string;
  purpleMuted: string;

  // Brand Accents
  accentBrand: string;
  accentBrandDark: string;
  accentBrandMuted: string;
  accentBrandGlow: string;

  // Functional Accents
  accentOrange: string;
  accentOrangeDark: string;
  accentOrangeMuted: string;
  accentOrangeGlow: string;
  accentGreen: string;
  accentGreenDark: string;
  accentGreenMuted: string;
  accentTeal: string;
  accentSky: string;
  accentSkyMuted: string;

  // Token & Economics
  tokenGold: string;
  tokenGoldDark: string;
  tokenGoldMuted: string;

  // Status & Feedback
  error: string;
  errorMuted: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  statusActive: string;
  statusDraft: string;
  statusPending: string;
  statusClaimed: string;
  statusCompleted: string;
  statusVerified: string;
  statusSuccess: string;
  statusSuccessMuted: string;
  statusError: string;
  statusErrorMuted: string;
}

export const lightTheme: ThemeTokens = {
  mode: 'light',
  background: '#F4F7F5',
  surface: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  surfaceElevated: '#EEF3F0',
  surfaceSubtle: '#F0F5F2',
  card: '#FFFFFF',
  input: '#FFFFFF',
  inputBackground: '#F7FAF8',
  navigation: '#FFFFFF',
  navigationBorder: '#E1E8E3',
  modal: '#FFFFFF',
  divider: '#E8EFEA',

  border: '#E1E8E3',
  borderLight: '#E8EFEA',
  borderSubtle: '#F1F6F3',
  borderHighlight: '#15803D',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  primary: '#0E3B27',
  primaryLight: '#15803D',
  primaryMuted: '#E8F5EE',
  primaryPurple: '#0E3B27',
  secondaryPurple: '#15803D',
  electricPurple: '#15803D',
  deepViolet: '#062617',
  softLavender: '#E8F5EE',
  purpleGlow: 'rgba(22, 163, 74, 0.10)',
  purpleMuted: '#E8F5EE',

  accentBrand: '#0E3B27',
  accentBrandDark: '#062617',
  accentBrandMuted: '#E8F5EE',
  accentBrandGlow: 'rgba(22, 163, 74, 0.10)',

  accentOrange: '#D97706',
  accentOrangeDark: '#92400E',
  accentOrangeMuted: '#FFFBEB',
  accentOrangeGlow: 'rgba(217, 119, 6, 0.10)',
  accentGreen: '#15803D',
  accentGreenDark: '#0E3B27',
  accentGreenMuted: '#ECFDF5',
  accentTeal: '#0D9488',
  accentSky: '#0284C7',
  accentSkyMuted: '#F0F9FF',
  tokenGold: '#15803D',
  tokenGoldDark: '#0E3B27',
  tokenGoldMuted: '#E8F5EE',

  error: '#DC2626',
  errorMuted: '#FEF2F2',
  success: '#15803D',
  successMuted: '#ECFDF5',
  warning: '#D97706',
  warningMuted: '#FFFBEB',
  statusActive: '#15803D',
  statusDraft: '#94A3B8',
  statusPending: '#D97706',
  statusClaimed: '#0E3B27',
  statusCompleted: '#15803D',
  statusVerified: '#15803D',
  statusSuccess: '#15803D',
  statusSuccessMuted: '#ECFDF5',
  statusError: '#DC2626',
  statusErrorMuted: '#FEF2F2',
};

export const darkTheme: ThemeTokens = {
  mode: 'dark',
  background: '#05140D',
  surface: '#081C12',
  surfaceCard: '#0D2B1C',
  surfaceElevated: '#174831',
  surfaceSubtle: '#0B2619',
  card: '#0D2B1C',
  input: '#071A11',
  inputBackground: '#071A11',
  navigation: '#04120B',
  navigationBorder: 'rgba(74, 222, 128, 0.18)',
  modal: '#0D2B1C',
  divider: 'rgba(255, 255, 255, 0.08)',

  border: 'rgba(74, 222, 128, 0.18)',
  borderLight: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.05)',
  borderHighlight: '#22C55E',

  textPrimary: '#F4FBF7',
  textSecondary: '#A3C9B6',
  textMuted: '#6B9480',
  textInverse: '#05140D',

  primary: '#15803D',
  primaryLight: '#22C55E',
  primaryMuted: 'rgba(34, 197, 94, 0.18)',
  primaryPurple: '#15803D',
  secondaryPurple: '#22C55E',
  electricPurple: '#4ADE80',
  deepViolet: '#0E3B27',
  softLavender: '#BBF7D0',
  purpleGlow: 'rgba(34, 197, 94, 0.20)',
  purpleMuted: 'rgba(34, 197, 94, 0.15)',

  accentBrand: '#22C55E',
  accentBrandDark: '#15803D',
  accentBrandMuted: 'rgba(34, 197, 94, 0.15)',
  accentBrandGlow: 'rgba(34, 197, 94, 0.25)',

  accentOrange: '#F59E0B',
  accentOrangeDark: '#D97706',
  accentOrangeMuted: 'rgba(245, 158, 11, 0.15)',
  accentOrangeGlow: 'rgba(245, 158, 11, 0.25)',
  accentGreen: '#22C55E',
  accentGreenDark: '#15803D',
  accentGreenMuted: 'rgba(34, 197, 94, 0.15)',
  accentTeal: '#14B8A6',
  accentSky: '#38BDF8',
  accentSkyMuted: 'rgba(56, 189, 248, 0.15)',
  tokenGold: '#4ADE80',
  tokenGoldDark: '#166534',
  tokenGoldMuted: 'rgba(34, 197, 94, 0.15)',

  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.15)',
  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.15)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  statusActive: '#22C55E',
  statusDraft: '#6B9480',
  statusPending: '#F59E0B',
  statusClaimed: '#15803D',
  statusCompleted: '#22C55E',
  statusVerified: '#22C55E',
  statusSuccess: '#22C55E',
  statusSuccessMuted: 'rgba(34, 197, 94, 0.15)',
  statusError: '#EF4444',
  statusErrorMuted: 'rgba(239, 68, 68, 0.15)',
};

// Default export is lightTheme to ensure Complete Light Theme everywhere
export const colors: ThemeTokens = lightTheme;

export const typography = {
  fontMono: 'monospace',
};

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  full: 9999,
};
