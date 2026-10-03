import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { TaskResponseDTO } from '@horizon/types';
import { colors, radius } from '../theme/colors';
import { TokenBadge } from './ui/TokenBadge';

interface TaskCardProps {
  task: TaskResponseDTO;
  onPress: (task: TaskResponseDTO) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onPress }) => {
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
      style={styles.card}
      onPress={() => onPress(task)}
      activeOpacity={0.75}
      accessibilityLabel={`Task: ${task.title}`}
    >
      {/* Top Meta Line: Type & Geospatial Proximity */}
      <View style={styles.topRow}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{formattedType}</Text>
        </View>
        <View style={styles.locationContainer}>
          <View style={styles.locationDot} />
          <Text style={styles.distanceText}>
            {formatDistance(task.distance_meters)} · ~{effortMinutes} min
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {task.title}
      </Text>

      {/* Description */}
      {task.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {task.description}
        </Text>
      ) : null}

      {/* Economics & Difficulty Footer */}
      <View style={styles.footer}>
        <View style={styles.economicsGroup}>
          <TokenBadge amount={task.base_reward} type="reward" size="sm" />
          <TokenBadge
            amount={`${task.commitment_stake}`}
            label="STAKE"
            type="stake"
            size="sm"
          />
        </View>

        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyLabel}>{difficultyText}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
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
    backgroundColor: colors.accentGreen,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  economicsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  difficultyBadge: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  difficultyLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
