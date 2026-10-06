import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/colors';

interface TokenBadgeProps {
  amount: number | string;
  type?: 'available' | 'locked' | 'reward' | 'stake' | 'neutral';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({
  amount,
  type = 'reward',
  label,
  size = 'md',
  style,
}) => {
  const { theme } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    switch (type) {
      case 'available':
        return {
          backgroundColor: theme.purpleMuted,
          borderWidth: 1,
          borderColor: theme.borderHighlight,
        };
      case 'locked':
        return {
          backgroundColor: 'rgba(217, 119, 6, 0.12)',
          borderWidth: 1,
          borderColor: 'rgba(217, 119, 6, 0.3)',
        };
      case 'stake':
        return {
          backgroundColor: theme.surfaceSubtle,
          borderWidth: 1,
          borderColor: theme.border,
        };
      case 'neutral':
        return {
          backgroundColor: theme.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.border,
        };
      case 'reward':
      default:
        return {
          backgroundColor: theme.purpleMuted,
          borderWidth: 1,
          borderColor: theme.borderHighlight,
        };
    }
  };

  const getTextColor = (): string => {
    switch (type) {
      case 'available':
        return theme.electricPurple;
      case 'locked':
        return '#D97706';
      case 'stake':
        return theme.textSecondary;
      case 'neutral':
        return theme.textMuted;
      case 'reward':
      default:
        return theme.electricPurple;
    }
  };

  const formattedAmount =
    typeof amount === 'number'
      ? type === 'reward' && amount > 0
        ? `+${amount}`
        : `${amount}`
      : amount;

  return (
    <View
      style={[
        styles.badge,
        getContainerStyle(),
        size === 'sm' && styles.smBadge,
        size === 'lg' && styles.lgBadge,
        style,
      ]}
    >
      <Text
        style={[
          styles.amountText,
          { color: getTextColor() },
          size === 'sm' && styles.smAmount,
          size === 'lg' && styles.lgAmount,
        ]}
      >
        {formattedAmount}
      </Text>
      <Text
        style={[
          styles.labelText,
          { color: getTextColor() },
          size === 'sm' && styles.smLabel,
          size === 'lg' && styles.lgLabel,
        ]}
      >
        {label || (type === 'stake' ? 'STAKE' : 'TKN')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 4,
  },
  smBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  lgBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  amountText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  smAmount: {
    fontSize: 10,
  },
  lgAmount: {
    fontSize: 14,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  smLabel: {
    fontSize: 8,
  },
  lgLabel: {
    fontSize: 11,
  },
});
