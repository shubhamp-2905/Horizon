import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { apiClient } from '../services/api';
import type { UserClaimedTaskDTO } from '@horizon/types';

interface MyTasksScreenProps {
  onSelectClaimedTask?: (task: any) => void;
  onExploreMore: () => void;
}

export const MyTasksScreen: React.FC<MyTasksScreenProps> = ({
  onSelectClaimedTask,
  onExploreMore,
}) => {
  const [claims, setClaims] = useState<UserClaimedTaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyTasks = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.getMyTasks();
      setClaims(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load your claimed tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMyTasks();
  }, [fetchMyTasks]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyTasks();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>MY COMMITTED TASKS</Text>
        <Text style={styles.subtitle}>
          Active data gaps you have staked tokens to investigate and document.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Loading your active commitments...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : claims.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Active Tasks Committed</Text>
          <Text style={styles.emptySubtitle}>
            Browse open tasks in Discover to stake tokens and secure exclusive collection rights.
          </Text>
          <TouchableOpacity style={styles.exploreButton} onPress={onExploreMore}>
            <Text style={styles.exploreText}>Explore Open Tasks</Text>
          </TouchableOpacity>
        </View>
      ) : (
        claims.map((item) => (
          <TouchableOpacity
            key={item.claim_id}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => onSelectClaimedTask && onSelectClaimedTask(item.task)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.stakeBadge}>🔒 {item.stake_amount} TOKENS STAKED</Text>
            </View>

            <Text style={styles.taskTitle}>{item.task.title}</Text>
            {item.task.description ? (
              <Text style={styles.taskDesc} numberOfLines={2}>
                {item.task.description}
              </Text>
            ) : null}

            <View style={styles.cardFooter}>
              <Text style={styles.rewardText}>Reward: +{item.task.base_reward} TOKENS</Text>
              <Text style={styles.dateText}>
                Claimed: {item.claimed_at ? new Date(item.claimed_at).toLocaleDateString() : 'Active'}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  content: {
    padding: 20,
    paddingTop: 50,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  stakeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  taskDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#0F172A',
    paddingTop: 10,
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24',
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
    marginBottom: 20,
  },
  exploreButton: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  exploreText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  centerContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 10,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
  },
});
