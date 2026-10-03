import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme/colors';

interface StatusBadgeProps {
  status: string;
  label?: string;
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, style }) => {
  const norm = status.toLowerCase();

  const getStatusColor = () => {
    switch (norm) {
      case 'published':
      case 'active':
      case 'verified':
        return colors.statusActive;
      case 'draft':
      case 'pending':
        return colors.statusPending;
      case 'claimed':
      case 'submitted':
        return colors.statusClaimed;
      case 'completed':
        return colors.statusCompleted;
      case 'rejected':
      case 'expired':
        return colors.statusError;
      default:
        return colors.textMuted;
    }
  };

  const statusColor = getStatusColor();

  return (
    <View style={[styles.badge, { borderColor: `${statusColor}40`, backgroundColor: `${statusColor}18` }, style]}>
      <View style={[styles.dot, { backgroundColor: statusColor }]} />
      <Text style={[styles.text, { color: statusColor }]}>
        {label || status.replace('_', ' ').toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 5,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
