import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme/colors';

interface HorizonCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'subtle' | 'highlight';
}

export const HorizonCard: React.FC<HorizonCardProps> = ({
  children,
  style,
  variant = 'default',
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'elevated':
        return styles.elevatedCard;
      case 'subtle':
        return styles.subtleCard;
      case 'highlight':
        return styles.highlightCard;
      case 'default':
      default:
        return styles.defaultCard;
    }
  };

  return <View style={[styles.baseCard, getVariantStyle(), style]}>{children}</View>;
};

const styles = StyleSheet.create({
  baseCard: {
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  defaultCard: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.borderLight,
  },
  elevatedCard: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  subtleCard: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  highlightCard: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.accentGreen,
  },
});
