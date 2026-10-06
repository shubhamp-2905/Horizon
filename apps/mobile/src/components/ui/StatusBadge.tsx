import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/colors';

interface StatusBadgeProps {
  status: string;
  label?: string;
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, style }) => {
  const { theme } = useTheme();
  const norm = status.toLowerCase();

  const getStatusColor = () => {
    switch (norm) {
      case 'published':
      case 'active':
        return theme.primaryPurple;
      case 'verified':
      case 'completed':
        return theme.statusSuccess;
      case 'draft':
      case 'pending':
        return theme.statusPending;
      case 'claimed':
      case 'submitted':
        return theme.secondaryPurple;
      case 'rejected':
      case 'expired':
        return theme.statusError;
      default:
        return theme.textMuted;
    }
  };

  const statusColor = getStatusColor();

  return (
    <View
      style={[
        styles.badge,
        { borderColor: `${statusColor}40`, backgroundColor: `${statusColor}18` },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: statusColor }]} />
      <Text style={[styles.text, { color: statusColor }]}>
        {label || status.replace(/_/g, ' ').toUpperCase()}
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
