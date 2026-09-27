import React from 'react';
import {View, StyleSheet, ViewStyle} from 'react-native';
import {colors, borderRadius, shadows, spacing} from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 'md',
}) => {
  const getPadding = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return spacing.sm;
      case 'lg':
        return spacing.lg;
      default:
        return spacing.md;
    }
  };

  return (
    <View style={[styles.card, {padding: getPadding()}, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    ...shadows.card,
  },
});
