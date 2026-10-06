import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { TaskResponseDTO } from '@horizon/types';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/colors';
import { TokenBadge } from './ui/TokenBadge';

interface TaskCardProps {
  task: TaskResponseDTO;
  onPress: (task: TaskResponseDTO) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onPress }) => {
  const { theme } = useTheme();

  const formatDistance = (meters?: number) => {
    if (meters === null || meters === undefined) return 'Nearby';
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  const getDifficultyLabel = (diff: number) => {
    if (diff <= 1.5) return 'Easy';
    if (diff <= 2.5) return 'Moderate';
    return 'Complex';
  };

  const formattedType = task.artifact_type.replace(/_/g, ' ');
  const effortMinutes = task.estimated_effort_minutes || 25;
  const difficultyText = getDifficultyLabel(task.difficulty);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceCard,
          borderColor: theme.border,
          shadowColor: theme.secondaryPurple,
        },
      ]}
      onPress={() => onPress(task)}
      activeOpacity={0.75}
      accessibilityLabel={`Task: ${task.title}`}
    >
      {/* Top Meta Line: Type & Geospatial Proximity */}
      <View style={styles.topRow}>
        <View
          style={[
            styles.typeBadge,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight },
          ]}
        >
          <Text style={[styles.typeText, { color: theme.textSecondary }]}>{formattedType}</Text>
        </View>
        <View style={styles.locationContainer}>
          <View style={[styles.locationDot, { backgroundColor: theme.electricPurple }]} />
          <Text style={[styles.distanceText, { color: theme.textSecondary }]}>
            {formatDistance(task.distance_meters)} · ~{effortMinutes} min
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={2}>
        {task.title}
      </Text>

      {/* Description */}
      {task.description ? (
        <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
          {task.description}
        </Text>
      ) : null}

      {/* Bottom Economics Row: Reward & Difficulty */}
      <View style={[styles.footer, { borderTopColor: theme.divider }]}>
        <View style={styles.economicsGroup}>
          <TokenBadge amount={task.base_reward} type="reward" size="sm" />
          <TokenBadge amount={task.commitment_stake} type="stake" size="sm" />
        </View>

        <View
          style={[
            styles.difficultyBadge,
            { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.difficultyLabel, { color: theme.textMuted }]}>{difficultyText}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  economicsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  difficultyLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
