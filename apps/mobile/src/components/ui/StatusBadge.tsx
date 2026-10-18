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
      case 'approved':
        return theme.statusSuccess;
      case 'draft':
      case 'queued_for_sync':
      case 'queued_sync':
        return theme.statusPending;
      case 'under_review':
      case 'pending_admin_review':
      case 'pending':
      case 'submitted':
      case 'syncing':
        return theme.secondaryPurple;
      case 'flagged':
      case 'verification_failed':
      case 'rejected':
      case 'expired':
        return theme.statusError;
      case 'disputed':
      case 'verification_unavailable':
        return theme.statusPending;
      case 'claimed':
        return theme.primaryPurple;
      default:
        return theme.textMuted;
    }
  };

  const getStatusLabel = () => {
    if (label) return label;
    switch (norm) {
      case 'under_review':
      case 'pending_admin_review':
        return 'AWAITING ADMIN REVIEW';
      case 'queued_for_sync':
      case 'queued_sync':
        return 'QUEUED FOR SYNC';
      case 'syncing':
        return 'SYNCING';
      case 'flagged':
      case 'verification_failed':
        return 'VERIFICATION ISSUE';
      case 'verification_unavailable':
        return 'VERIFICATION UNAVAILABLE';
      case 'disputed':
        return 'UNDER INVESTIGATION';
      case 'submitted':
      case 'pending':
        return 'AWAITING REVIEW';
      case 'approved':
        return 'APPROVED';
      case 'rejected':
        return 'REJECTED';
      case 'claimed':
        return 'CLAIMED';
      default:
        return status.replace(/_/g, ' ').toUpperCase();
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
        {getStatusLabel()}
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
