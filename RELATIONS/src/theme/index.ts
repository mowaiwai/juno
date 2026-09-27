export const colors = {
  primary: '#6366F1',
  primaryHover: '#5558E3',
  primaryActive: '#4F46E5',
  secondary: '#8B5CF6',
  accent: '#F59E0B',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#E5E7EB',
  relation: {
    family: '#EC4899',
    friend: '#3B82F6',
    colleague: '#10B981',
    lover: '#F43F5E',
    teacher: '#8B5CF6',
    client: '#F59E0B',
    neighbor: '#6B7280',
    other: '#9CA3AF',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.textSecondary,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: colors.textTertiary,
  },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  button: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
