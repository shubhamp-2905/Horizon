import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme/colors';

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
  const getContainerStyle = () => {
    switch (type) {
      case 'available':
        return styles.availableContainer;
      case 'locked':
        return styles.lockedContainer;
      case 'stake':
        return styles.stakeContainer;
      case 'neutral':
        return styles.neutralContainer;
      case 'reward':
      default:
        return styles.rewardContainer;
    }
  };

  const getTextStyle = () => {
    switch (type) {
      case 'available':
        return styles.availableText;
      case 'locked':
        return styles.lockedText;
      case 'stake':
        return styles.stakeText;
      case 'neutral':
        return styles.neutralText;
      case 'reward':
      default:
        return styles.rewardText;
    }
  };

  const formattedAmount =
    typeof amount === 'number'
      ? type === 'reward' && amount > 0
        ? `+${amount}`
        : `${amount}`
      : amount;

  return (
    <View style={[styles.badge, getContainerStyle(), size === 'sm' && styles.smBadge, size === 'lg' && styles.lgBadge, style]}>
      <Text style={[styles.amountText, getTextStyle(), size === 'sm' && styles.smAmount, size === 'lg' && styles.lgAmount]}>
        {formattedAmount}
      </Text>
      <Text style={[styles.labelText, getTextStyle(), size === 'sm' && styles.smLabel, size === 'lg' && styles.lgLabel]}>
        {label || (type === 'stake' ? 'STAKE' : 'TOKENS')}
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
  rewardContainer: {
    backgroundColor: colors.tokenGoldMuted,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  availableContainer: {
    backgroundColor: colors.accentGreenMuted,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
  },
  lockedContainer: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  stakeContainer: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  neutralContainer: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
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
  rewardText: {
    color: colors.tokenGold,
  },
  availableText: {
    color: colors.accentGreen,
  },
  lockedText: {
    color: colors.tokenGoldDark,
  },
  stakeText: {
    color: colors.textSecondary,
  },
  neutralText: {
    color: colors.textMuted,
  },
});
