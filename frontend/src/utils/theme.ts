/**
 * BrainGauge Theme
 * Modern fitness tracker aesthetic with dark mode
 */

export const theme = {
  colors: {
    // Primary palette
    primary: '#6366F1',
    primaryLight: 'rgba(99, 102, 241, 0.15)',
    primaryDark: '#4F46E5',

    // Background colors
    background: '#0F0F1A',
    surface: '#1A1A2E',
    surfaceLight: '#252540',

    // Text colors
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',

    // Status colors
    optimal: '#10B981',
    optimalLight: 'rgba(16, 185, 129, 0.15)',
    moderate: '#F59E0B',
    moderateLight: 'rgba(245, 158, 11, 0.15)',
    elevated: '#F97316',
    elevatedLight: 'rgba(249, 115, 22, 0.15)',
    high: '#EF4444',
    highLight: 'rgba(239, 68, 68, 0.15)',

    // Other colors
    border: '#2D2D44',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',

    // Chart colors
    speechChart: '#8B5CF6',
    cognitiveChart: '#06B6D4',
    visualChart: '#F472B6',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },

  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 24,
      fontWeight: '600' as const,
      letterSpacing: -0.3,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400' as const,
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
    },
    label: {
      fontSize: 11,
      fontWeight: '600' as const,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
    },
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'optimal':
      return theme.colors.optimal;
    case 'moderate':
      return theme.colors.moderate;
    case 'elevated':
      return theme.colors.elevated;
    case 'high':
      return theme.colors.high;
    default:
      return theme.colors.textSecondary;
  }
};

export const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'optimal':
      return 'Optimal';
    case 'moderate':
      return 'Moderate';
    case 'elevated':
      return 'Elevated';
    case 'high':
      return 'High';
    default:
      return 'Unknown';
  }
};

export const getScoreColor = (score: number): string => {
  if (score < 20) return theme.colors.optimal;
  if (score < 40) return theme.colors.moderate;
  if (score < 60) return theme.colors.elevated;
  return theme.colors.high;
};
