import { Platform } from 'react-native';

export const colors = {
  // Primary brand color - dark red
  primary: '#f44a33',
  // Accent - coral/orange
  accent: '#f44a33',
  accentLight: '#FFE8E3',
  // Surfaces
  surface: '#FFFFFF',
  surfaceLight: '#F7F7F7',
  // Backgrounds
  background: '#F8F4EF',
  darkBeige: '#F1E7DD',
  beige: '#FAF0E6',
  // Text
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textLight: '#AAAAAA',
  // Borders
  border: '#E8E8E8',
  divider: '#F0F0F0',
  // Semantic
  error: '#f44a33',
  success: '#43A047',
  warning: '#FB8C00',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 40,
};

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
  },
  captionBold: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  small: {
    fontSize: 11,
    fontWeight: '400' as const,
  },
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  full: 999,
};

export const shadows = {
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
    android: { elevation: 4 },
    default: {},
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12 },
    android: { elevation: 8 },
    default: {},
  }),
};

export const storeInfo: Record<string, { name: string; color: string }> = {
  metro: { name: 'Metro', color: '#0066CC' },
  iga: { name: 'IGA', color: '#CC0000' },
  superc: { name: 'Super C', color: '#FF6600' },
  maxi: { name: 'Maxi', color: '#8B2FC9' },
  walmart: { name: 'Walmart', color: '#0071CE' },
  loblaws: { name: 'Loblaws', color: '#D4302F' },
  avril: { name: 'Avril', color: '#6B9E3A' },
  rachelle: { name: 'Rachelle Béry', color: '#1A6B3C' },
};
