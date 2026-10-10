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
import { radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { SyncStatusBadge } from '../components/ui/SyncStatusBadge';
import { syncEngine, type SyncEngineState } from '../offline/syncEngine';
import { claimRepo, taskRepo } from '../offline/repositories';

interface MyTasksScreenProps {
  onSelectClaimedTask?: (task: any) => void;
  onExploreMore: () => void;
}

type TabType = 'active' | 'completed' | 'history';

export const MyTasksScreen: React.FC<MyTasksScreenProps> = ({
  onSelectClaimedTask,
  onExploreMore,
}) => {
  const { theme, isDark } = useTheme();
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
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>MY FIELD TASKS</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Committed data collection scopes with locked token escrows.
        </Text>
      </View>

      {/* Sync Engine Status Banner */}
      <SyncStatusBadge
        state={syncState}
        onSyncNow={() => syncEngine.syncNow()}
      />

      {/* Tabs: ACTIVE | COMPLETED | HISTORY */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.surfaceElevated,
            borderColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'active' && styles.activeTab,
            activeTab === 'active' && {
              backgroundColor: theme.card,
              borderColor: theme.primary,
              shadowColor: '#000000',
            },
          ]}
          onPress={() => setActiveTab('active')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'active' ? theme.primaryLight : theme.textSecondary },
              activeTab === 'active' && { fontWeight: '700' },
            ]}
          >
            ACTIVE ({activeClaims.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'completed' && styles.activeTab,
            activeTab === 'completed' && {
              backgroundColor: theme.card,
              borderColor: theme.primary,
              shadowColor: '#000000',
            },
          ]}
          onPress={() => setActiveTab('completed')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'completed' ? theme.primaryLight : theme.textSecondary },
              activeTab === 'completed' && { fontWeight: '700' },
            ]}
          >
            COMPLETED ({completedClaims.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'history' && styles.activeTab,
            activeTab === 'history' && {
              backgroundColor: theme.card,
              borderColor: theme.primary,
              shadowColor: '#000000',
            },
          ]}
          onPress={() => setActiveTab('history')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'history' ? theme.primaryLight : theme.textSecondary },
              activeTab === 'history' && { fontWeight: '700' },
            ]}
          >
            HISTORY ({historyClaims.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingState message="Loading your committed task list..." />
      ) : error ? (
        <View
          style={[
            styles.errorBox,
            {
              backgroundColor: theme.errorMuted,
              borderColor: theme.error,
            },
          ]}
        >
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
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
                style={[
                  styles.taskCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    shadowColor: '#000000',
                  },
                ]}
                activeOpacity={0.75}
                onPress={() => onSelectClaimedTask && onSelectClaimedTask(t)}
              >
                {/* Header: Type and Status */}
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor: theme.primaryMuted,
                        borderColor: theme.borderLight,
                      },
                    ]}
                  >
                    <Text style={[styles.typeText, { color: theme.primaryLight }]}>
                      {t.artifact_type.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                {/* Title */}
                <Text style={[styles.taskTitle, { color: theme.textPrimary }]}>{t.title}</Text>

                {/* Location */}
                <View style={styles.locationRow}>
                  <View style={[styles.locDot, { backgroundColor: theme.primary }]} />
                  <Text style={[styles.locationText, { color: theme.textSecondary }]}>
                    {t.latitude !== undefined && t.longitude !== undefined
                      ? `${t.latitude.toFixed(4)}°N, ${t.longitude.toFixed(4)}°E (SRID 4326)`
                      : 'Geographic Target Ready'}
                  </Text>
                </View>

                {/* Economics Summary */}
                <View
                  style={[
                    styles.economicsRow,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.stakeBox}>
                    <Text style={[styles.ecoLabel, { color: theme.textMuted }]}>STAKE LOCKED</Text>
                    <Text style={[styles.stakeVal, { color: theme.tokenGold }]}>
                      {item.stake_amount} TKN
                    </Text>
                  </View>

                  <View style={styles.rewardBox}>
                    <Text style={[styles.ecoLabel, { color: theme.textMuted }]}>POTENTIAL REWARD</Text>
                    <Text style={[styles.rewardVal, { color: theme.primaryLight }]}>
                      +{t.base_reward} TKN
                    </Text>
                  </View>
                </View>

                {/* Phase 3 Progress State */}
                <View
                  style={[
                    styles.progressFooter,
                    { borderTopColor: theme.border },
                  ]}
                >
                  <View style={styles.progressStateBox}>
                    <View style={[styles.progressPulse, { backgroundColor: theme.primary }]} />
                    <Text style={[styles.progressStatusText, { color: theme.primaryLight }]}>
                      Ready for field collection
                    </Text>
                  </View>
                  <Text style={[styles.detailsChevron, { color: theme.primaryLight }]}>
                    Inspect →
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )
      ) : activeTab === 'completed' ? (
        completedClaims.length === 0 ? (
          <EmptyState
            title="No Completed Submissions"
            description="Completed field collections and verified ground-truth submissions will appear here following verification."
            actionText="Explore Tasks"
            onAction={onExploreMore}
          />
        ) : (
          completedClaims.map((item) => (
            <View
              key={item.claim_id}
              style={[
                styles.taskCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: '#000000',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.taskTitle, { color: theme.textPrimary }]}>{item.task.title}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={[styles.completedSubText, { color: theme.textSecondary }]}>
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
            <View
              key={item.claim_id}
              style={[
                styles.taskCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: '#000000',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.taskTitle, { color: theme.textPrimary }]}>{item.task.title}</Text>
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
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  activeTab: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
  },
  taskCard: {
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
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
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
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
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  economicsRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
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
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  stakeVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  rewardVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
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
  },
  progressStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsChevron: {
    fontSize: 12,
    fontWeight: '500',
  },
  completedSubText: {
    fontSize: 12,
    marginTop: 4,
  },
  errorBox: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
  },
});
