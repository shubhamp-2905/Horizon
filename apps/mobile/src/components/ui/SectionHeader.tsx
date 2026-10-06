import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface SectionHeaderProps {
  title: string;
  actionText?: string;
  onAction?: () => void;
  count?: number;
  style?: ViewStyle;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionText,
  onAction,
  count,
  style,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.textSecondary }]}>{title}</Text>
        {count !== undefined && (
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.countText, { color: theme.textMuted }]}>{count}</Text>
          </View>
        )}
      </View>
      {actionText && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7} style={styles.actionBtn}>
          <Text style={[styles.actionText, { color: theme.electricPurple }]}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
