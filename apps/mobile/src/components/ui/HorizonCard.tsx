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
    backgroundColor: colors.surfaceCard,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  defaultCard: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.border,
  },
  elevatedCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 5,
  },
  subtleCard: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderLight,
  },
  highlightCard: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.accentOrange,
    shadowColor: colors.accentOrange,
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
});
