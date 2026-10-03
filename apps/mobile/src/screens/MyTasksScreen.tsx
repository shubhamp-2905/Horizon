import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { apiClient } from '../services/api';
import type { UserClaimedTaskDTO } from '@horizon/types';
import { colors, radius } from '../theme/colors';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { SyncStatusBadge } from '../components/ui/SyncStatusBadge';
import { syncEngine, type SyncEngineState } from '../offline/syncEngine';
import { claimRepo, taskRepo, submissionRepo } from '../offline/repositories';

interface MyTasksScreenProps {
  onSelectClaimedTask?: (task: any) => void;
  onExploreMore: () => void;
}

type TabType = 'active' | 'completed' | 'history';

export const MyTasksScreen: React.FC<MyTasksScreenProps> = ({
  onSelectClaimedTask,
  onExploreMore,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [claims, setClaims] = useState<UserClaimedTaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncEngineState>(syncEngine.getState());

  useEffect(() => {
    const unsub = syncEngine.subscribe(setSyncState);
    return unsub;
  }, []);

  const fetchMyTasks = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.getMyTasks();
      setClaims(data || []);
      claimRepo.cacheClaims(data || []).catch(() => {});
    } catch (err: any) {
      // Offline fallback: load cached claims and tasks
      const cachedClaims = await claimRepo.getCachedClaims();
      const cachedTasks = await taskRepo.getAllCachedTasks();
      const taskMap = new Map(cachedTasks.map((t) => [t.id, t]));

      if (cachedClaims.length > 0) {
        setClaims(
          cachedClaims.map((c) => {
            const task = taskMap.get(c.task_id);
            return {
              claim_id: c.claim_id,
              status: c.status,
              stake_amount: c.stake_amount,
              claimed_at: c.claimed_at,
              task: {
                id: c.task_id,
                title: task?.title || 'Cached Field Task',
                description: task?.description || '',
                artifact_type: task?.artifact_type || 'offline_task',
                status: task?.status || 'published',
                difficulty: task?.difficulty || 1.5,
                scarcity: task?.scarcity || 1.0,
                base_reward: task?.base_reward || 100,
                commitment_stake: c.stake_amount,
                created_at: c.claimed_at,
              },
            };
          })
        );
      } else {
        setError(err.message || 'Offline: No cached tasks available');
      }
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

  const activeClaims = claims.filter((c) => c.status === 'claimed');
  const completedClaims = claims.filter((c) => c.status === 'completed' || c.status === 'submitted');
  const historyClaims = claims.filter((c) => c.status === 'expired' || c.status === 'abandoned' || c.status === 'completed');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accentGreen}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MY FIELD TASKS</Text>
        <Text style={styles.subtitle}>
          Committed data collection scopes with locked token escrows.
        </Text>
      </View>

      {/* Sync Engine Status Banner */}
      <SyncStatusBadge
        state={syncState}
        onSyncNow={() => syncEngine.syncNow()}
      />

      {/* Tabs: ACTIVE | COMPLETED | HISTORY */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            ACTIVE ({activeClaims.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            COMPLETED ({completedClaims.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            HISTORY ({historyClaims.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingState message="Loading your committed task list..." />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : activeTab === 'active' ? (
        activeClaims.length === 0 ? (
          <EmptyState
            title="No Active Tasks Committed"
            description="You have no tasks currently locked in escrow. Explore open geospatial gaps to commit stake."
            actionText="Discover Open Tasks"
            onAction={onExploreMore}
          />
        ) : (
          activeClaims.map((item) => {
            const t = item.task;
            return (
              <TouchableOpacity
                key={item.claim_id}
                style={styles.taskCard}
                activeOpacity={0.75}
                onPress={() => onSelectClaimedTask && onSelectClaimedTask(t)}
              >
                {/* Header: Type and Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>
                      {t.artifact_type.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                {/* Title */}
                <Text style={styles.taskTitle}>{t.title}</Text>

                {/* Location */}
                <View style={styles.locationRow}>
                  <View style={styles.locDot} />
                  <Text style={styles.locationText}>
                    {t.latitude !== undefined && t.longitude !== undefined
                      ? `${t.latitude.toFixed(4)}°N, ${t.longitude.toFixed(4)}°E (SRID 4326)`
                      : 'Geographic Target Ready'}
                  </Text>
                </View>

                {/* Economics Summary */}
                <View style={styles.economicsRow}>
                  <View style={styles.stakeBox}>
                    <Text style={styles.ecoLabel}>STAKE LOCKED</Text>
                    <Text style={styles.stakeVal}>{item.stake_amount} TOKENS</Text>
                  </View>

                  <View style={styles.rewardBox}>
                    <Text style={styles.ecoLabel}>POTENTIAL REWARD</Text>
                    <Text style={styles.rewardVal}>+{t.base_reward} TOKENS</Text>
                  </View>
                </View>

                {/* Phase 3 Progress State */}
                <View style={styles.progressFooter}>
                  <View style={styles.progressStateBox}>
                    <View style={styles.progressPulse} />
                    <Text style={styles.progressStatusText}>Ready for field collection</Text>
                  </View>
                  <Text style={styles.detailsChevron}>Inspect →</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )
      ) : activeTab === 'completed' ? (
        completedClaims.length === 0 ? (
          <EmptyState
            title="No Completed Submissions"
            description="Completed field collections and verified ground-truth submissions will appear here following Phase 3 verification."
            actionText="Explore Tasks"
            onAction={onExploreMore}
          />
        ) : (
          completedClaims.map((item) => (
            <View key={item.claim_id} style={styles.taskCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.taskTitle}>{item.task.title}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.completedSubText}>
                Reward settled to token balance.
              </Text>
            </View>
          ))
        )
      ) : (
        historyClaims.length === 0 ? (
          <EmptyState
            title="No Past Task History"
            description="Expired or completed task lifecycles will be archived here for your records."
          />
        ) : (
          historyClaims.map((item) => (
            <View key={item.claim_id} style={styles.taskCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.taskTitle}>{item.task.title}</Text>
                <StatusBadge status={item.status} />
              </View>
            </View>
          ))
        )
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    paddingTop: 44,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: radius.md,
    padding: 3,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
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
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  locDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentGreen,
  },
  locationText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  economicsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 12,
  },
  stakeBox: {
    flex: 1,
  },
  rewardBox: {
    flex: 1,
    alignItems: 'flex-end',
  },
  ecoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  stakeVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.tokenGoldDark,
  },
  rewardVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accentGreen,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  progressStateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentGreen,
  },
  progressStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentGreen,
  },
  detailsChevron: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  completedSubText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: colors.statusErrorMuted,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: colors.statusError,
  },
});
