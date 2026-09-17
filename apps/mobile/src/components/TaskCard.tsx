import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { TaskResponseDTO } from '@horizon/types';

interface TaskCardProps {
  task: TaskResponseDTO;
  onPress: (task: TaskResponseDTO) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(task)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Task: ${task.title}`}
    >
      <View style={styles.header}>
        <View style={styles.artifactBadge}>
          <Text style={styles.artifactText}>{task.artifact_type.replace('_', ' ').toUpperCase()}</Text>
        </View>
        {task.distance_meters !== null && task.distance_meters !== undefined ? (
          <Text style={styles.distanceText}>
            {task.distance_meters >= 1000
              ? `${(task.distance_meters / 1000).toFixed(1)} km`
              : `${Math.round(task.distance_meters)} m`}
          </Text>
        ) : (
          <Text style={styles.distanceText}>Proximity ready</Text>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {task.title}
      </Text>

      {task.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {task.description}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.tokenPill}>
          <Text style={styles.rewardText}>+{task.base_reward} TOKENS</Text>
        </View>

        <View style={styles.stakePill}>
          <Text style={styles.stakeText}>Stake: {task.commitment_stake}</Text>
        </View>

        <View style={styles.metaPill}>
          <Text style={styles.metaText}>{task.estimated_effort_minutes || 30}m</Text>
        </View>

        <View style={styles.metaPill}>
          <Text style={styles.metaText}>D{task.difficulty.toFixed(1)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  artifactBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  artifactText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tokenPill: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FBBF24',
  },
  stakePill: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stakeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  metaPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
});
