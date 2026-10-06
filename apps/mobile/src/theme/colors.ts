/**
 * @file Horizon Mobile Theme Tokens — Premium Violet & Indigo Design System
 * Deep violet obsidian void, crisp surfaces, royal & electric purple accents, and financial-grade typography.
 * Supports complete Dark Mode and Light Mode with centralized design tokens.
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

  // Purple / Violet / Indigo Brand Palette
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

  // Aliases for Existing Callers (mapped to cohesive purple identity)
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

export const darkTheme: ThemeTokens = {
  mode: 'dark',
  background: '#07060B',
  surface: '#0F0D17',
  surfaceCard: '#151320',
  surfaceElevated: '#1D1A2C',
  surfaceSubtle: '#12101B',
  card: '#151320',
  input: '#100E19',
  inputBackground: '#100E19',
  navigation: '#0B0913',
  navigationBorder: 'rgba(168, 85, 247, 0.15)',
  modal: '#151320',
  divider: 'rgba(255, 255, 255, 0.08)',

  border: 'rgba(168, 85, 247, 0.18)',
  borderLight: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.05)',
  borderHighlight: 'rgba(168, 85, 247, 0.45)',

  textPrimary: '#F8F7FC',
  textSecondary: '#A39EBC',
  textMuted: '#6E6887',
  textInverse: '#07060B',

  primary: '#7C3AED',
  primaryLight: '#A855F7',
  primaryMuted: 'rgba(124, 58, 237, 0.18)',
  primaryPurple: '#7C3AED',
  secondaryPurple: '#9333EA',
  electricPurple: '#A855F7',
  deepViolet: '#5B21B6',
  softLavender: '#DDD6FE',
  purpleGlow: 'rgba(147, 51, 234, 0.28)',
  purpleMuted: 'rgba(124, 58, 237, 0.15)',

  accentBrand: '#7C3AED',
  accentBrandDark: '#5B21B6',
  accentBrandMuted: 'rgba(124, 58, 237, 0.15)',
  accentBrandGlow: 'rgba(168, 85, 247, 0.28)',

  accentOrange: '#7C3AED',
  accentOrangeDark: '#5B21B6',
  accentOrangeMuted: 'rgba(124, 58, 237, 0.15)',
  accentOrangeGlow: 'rgba(147, 51, 234, 0.28)',
  accentGreen: '#10B981',
  accentGreenDark: '#059669',
  accentGreenMuted: 'rgba(16, 185, 129, 0.15)',
  accentTeal: '#14B8A6',
  accentSky: '#38BDF8',
  accentSkyMuted: 'rgba(56, 189, 248, 0.15)',
  tokenGold: '#A855F7',
  tokenGoldDark: '#7C3AED',
  tokenGoldMuted: 'rgba(168, 85, 247, 0.15)',

  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.15)',
  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  statusActive: '#7C3AED',
  statusDraft: '#6B7280',
  statusPending: '#F59E0B',
  statusClaimed: '#9333EA',
  statusCompleted: '#10B981',
  statusVerified: '#10B981',
  statusSuccess: '#10B981',
  statusSuccessMuted: 'rgba(16, 185, 129, 0.15)',
  statusError: '#EF4444',
  statusErrorMuted: 'rgba(239, 68, 68, 0.15)',
};

export const lightTheme: ThemeTokens = {
  mode: 'light',
  background: '#F7F6FC',
  surface: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  surfaceElevated: '#F2F0FA',
  surfaceSubtle: '#ECEAF6',
  card: '#FFFFFF',
  input: '#F4F2FA',
  inputBackground: '#F4F2FA',
  navigation: '#FFFFFF',
  navigationBorder: 'rgba(124, 58, 237, 0.12)',
  modal: '#FFFFFF',
  divider: 'rgba(0, 0, 0, 0.07)',

  border: 'rgba(124, 58, 237, 0.15)',
  borderLight: 'rgba(0, 0, 0, 0.07)',
  borderSubtle: 'rgba(0, 0, 0, 0.04)',
  borderHighlight: 'rgba(124, 58, 237, 0.40)',

  textPrimary: '#17112B',
  textSecondary: '#5C5474',
  textMuted: '#8C84A6',
  textInverse: '#FFFFFF',

  primary: '#6D28D9',
  primaryLight: '#7C3AED',
  primaryMuted: 'rgba(109, 40, 217, 0.10)',
  primaryPurple: '#6D28D9',
  secondaryPurple: '#7C3AED',
  electricPurple: '#8B5CF6',
  deepViolet: '#4C1D95',
  softLavender: '#EDE9FE',
  purpleGlow: 'rgba(109, 40, 217, 0.16)',
  purpleMuted: 'rgba(109, 40, 217, 0.09)',

  accentBrand: '#6D28D9',
  accentBrandDark: '#4C1D95',
  accentBrandMuted: 'rgba(109, 40, 217, 0.09)',
  accentBrandGlow: 'rgba(109, 40, 217, 0.16)',

  accentOrange: '#6D28D9',
  accentOrangeDark: '#4C1D95',
  accentOrangeMuted: 'rgba(109, 40, 217, 0.09)',
  accentOrangeGlow: 'rgba(109, 40, 217, 0.16)',
  accentGreen: '#059669',
  accentGreenDark: '#047857',
  accentGreenMuted: 'rgba(5, 150, 105, 0.10)',
  accentTeal: '#0D9488',
  accentSky: '#0284C7',
  accentSkyMuted: 'rgba(2, 132, 199, 0.10)',
  tokenGold: '#7C3AED',
  tokenGoldDark: '#5B21B6',
  tokenGoldMuted: 'rgba(124, 58, 237, 0.10)',

  error: '#DC2626',
  errorMuted: 'rgba(220, 38, 38, 0.10)',
  success: '#059669',
  successMuted: 'rgba(5, 150, 105, 0.10)',
  warning: '#D97706',
  warningMuted: 'rgba(217, 119, 6, 0.10)',
  statusActive: '#6D28D9',
  statusDraft: '#9CA3AF',
  statusPending: '#D97706',
  statusClaimed: '#7C3AED',
  statusCompleted: '#059669',
  statusVerified: '#059669',
  statusSuccess: '#059669',
  statusSuccessMuted: 'rgba(5, 150, 105, 0.10)',
  statusError: '#DC2626',
  statusErrorMuted: 'rgba(220, 38, 38, 0.10)',
};

// Default export maintains compatibility with static callers
export const colors: ThemeTokens = darkTheme;

export const typography = {
  fontMono: 'monospace',
};

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};
