import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { radius } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

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
  const { theme, isDark } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
          shadowOpacity: isDark ? 0.5 : 0.1,
          shadowRadius: 12,
          elevation: 5,
        };
      case 'subtle':
        return {
          backgroundColor: theme.surfaceSubtle,
          borderColor: theme.borderLight,
        };
      case 'highlight':
        return {
          backgroundColor: theme.card,
          borderColor: theme.primary,
          shadowColor: theme.primary,
          shadowOpacity: isDark ? 0.35 : 0.15,
          shadowRadius: 10,
        };
      case 'default':
      default:
        return {
          backgroundColor: theme.card,
          borderColor: theme.border,
        };
    }
  };

  return (
    <View
      style={[
        styles.baseCard,
        {
          borderColor: theme.border,
          shadowColor: '#000000',
          shadowOpacity: isDark ? 0.3 : 0.04,
        },
        getVariantStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  baseCard: {
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
});
