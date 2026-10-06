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
import type { WalletSummaryDTO, TaskResponseDTO, UserClaimedTaskDTO } from '@horizon/types';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/colors';
import { HorizonButton } from '../components/ui/HorizonButton';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { TaskCard } from '../components/TaskCard';
import { SyncStatusBadge } from '../components/ui/SyncStatusBadge';
import { syncEngine, type SyncEngineState } from '../offline/syncEngine';
import { taskRepo, claimRepo } from '../offline/repositories';

interface HomeScreenProps {
  onNavigate: (tab: 'discover' | 'tasks' | 'wallet') => void;
  onSelectTask?: (task: TaskResponseDTO) => void;
  user?: {
    username: string;
    email: string;
    full_name?: string;
    available_tokens?: number;
    locked_tokens?: number;
    reputation_score?: number;
  } | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onSelectTask,
  user,
}) => {
  const { theme } = useTheme();

  // Initialize wallet from authenticated user payload to avoid blocking render
  const [wallet, setWallet] = useState<WalletSummaryDTO | null>(() => {
    if (user && user.available_tokens !== undefined) {
      const avail = user.available_tokens;
      const locked = user.locked_tokens ?? 0;
      return {
        available_balance: avail,
        available_tokens: avail,
        locked_balance: locked,
        locked_tokens: locked,
        total_tokens: avail + locked,
        reputation_score: user.reputation_score ?? 100,
        transactions: [],
        recent_transactions: [],
      };
    }
    return null;
  });
  const [activeTasks, setActiveTasks] = useState<UserClaimedTaskDTO[]>([]);
  const [nearbyTasks, setNearbyTasks] = useState<TaskResponseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncState, setSyncState] = useState<SyncEngineState>(syncEngine.getState());

  useEffect(() => {
    const unsub = syncEngine.subscribe(setSyncState);
    return unsub;
  }, []);

  // Pre-populate with local cached data immediately on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [cachedClaims, cachedTasks] = await Promise.all([
          claimRepo.getCachedClaims(),
          taskRepo.getAllCachedTasks(),
        ]);
        if (!mounted) return;
        if (cachedClaims.length > 0) {
          setActiveTasks(
            cachedClaims.map((c) => {
              const matched = cachedTasks.find((t) => t.id === c.task_id);
              return {
                claim_id: c.claim_id,
                status: c.status,
                stake_amount: c.stake_amount,
                claimed_at: c.claimed_at,
                task: {
                  id: c.task_id,
                  title: matched?.title || 'Field Task',
                  artifact_type: matched?.artifact_type || 'survey',
                  status: 'published',
                  difficulty: matched?.difficulty || 1.0,
                  scarcity: matched?.scarcity || 1.0,
                  base_reward: matched?.base_reward || 100,
                  commitment_stake: c.stake_amount,
                  created_at: c.claimed_at,
                },
              };
            })
          );
        }
        if (cachedTasks.length > 0) {
          setNearbyTasks(
            cachedTasks.slice(0, 2).map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              artifact_type: t.artifact_type,
              status: t.status,
              difficulty: t.difficulty,
              scarcity: t.scarcity,
              base_reward: t.base_reward,
              commitment_stake: t.commitment_stake,
              estimated_effort_minutes: t.estimated_effort_minutes,
              requirements: t.requirements,
              created_at: t.last_synced_at,
            }))
          );
        }
      } catch {
        // Fallback gracefully
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      const [walletRes, myTasksRes, discoverRes] = await Promise.allSettled([
        apiClient.getWallet(),
        apiClient.getMyTasks(),
        apiClient.discoverTasks({ radius: 10000, page_size: 2 }),
      ]);

      if (walletRes.status === 'fulfilled') {
        setWallet(walletRes.value);
      }
      if (myTasksRes.status === 'fulfilled') {
        setActiveTasks(myTasksRes.value);
        claimRepo.cacheClaims(myTasksRes.value).catch(() => {});
      } else {
        const [cachedClaims, cachedTasks] = await Promise.all([
          claimRepo.getCachedClaims(),
          taskRepo.getAllCachedTasks(),
        ]);
        if (cachedClaims.length > 0) {
          setActiveTasks(
            cachedClaims.map((c) => {
              const matched = cachedTasks.find((t) => t.id === c.task_id);
              return {
                claim_id: c.claim_id,
                status: c.status,
                stake_amount: c.stake_amount,
                claimed_at: c.claimed_at,
                task: {
                  id: c.task_id,
                  title: matched?.title || 'Field Task',
                  artifact_type: matched?.artifact_type || 'survey',
                  status: 'published',
                  difficulty: matched?.difficulty || 1.0,
                  scarcity: matched?.scarcity || 1.0,
                  base_reward: matched?.base_reward || 100,
                  commitment_stake: c.stake_amount,
                  created_at: c.claimed_at,
                },
              };
            })
          );
        }
      }

      if (discoverRes.status === 'fulfilled') {
        setNearbyTasks(discoverRes.value.tasks || []);
        taskRepo.cacheTasks(discoverRes.value.tasks || []).catch(() => {});
      } else {
        const cached = await taskRepo.getAllCachedTasks();
        if (cached.length > 0) {
          setNearbyTasks(
            cached.slice(0, 2).map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              artifact_type: t.artifact_type,
              status: t.status,
              difficulty: t.difficulty,
              scarcity: t.scarcity,
              base_reward: t.base_reward,
              commitment_stake: t.commitment_stake,
              estimated_effort_minutes: t.estimated_effort_minutes,
              requirements: t.requirements,
              created_at: t.last_synced_at,
            }))
          );
        }
      }
    } catch {
      // Fallbacks applied
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const displayName = user?.full_name || user?.username || 'Contributor';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.electricPurple}
        />
      }
    >
      {/* Top Greeting & Contributor Identity */}
      <View style={styles.topSection}>
        <View style={styles.identityRow}>
          <View>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>Welcome back,</Text>
            <Text style={[styles.contributorName, { color: theme.textPrimary }]}>{displayName}</Text>
          </View>
          <SyncStatusBadge
            state={syncState}
            compact
            onSyncNow={() => syncEngine.syncNow()}
          />
        </View>
      </View>

      {/* Global Sync Engine Banner */}
      <SyncStatusBadge
        state={syncState}
        onSyncNow={() => syncEngine.syncNow()}
      />

      {/* Main Wallet Summary Card */}
      <View
        style={[
          styles.walletCard,
          {
            backgroundColor: theme.surfaceCard,
            borderColor: theme.border,
            shadowColor: theme.secondaryPurple,
          },
        ]}
      >
        <View style={styles.walletHeader}>
          <Text style={[styles.walletCardLabel, { color: theme.textPrimary }]}>Contributor Balance</Text>
          <TouchableOpacity onPress={() => onNavigate('wallet')} activeOpacity={0.7}>
            <Text style={[styles.viewLedgerLink, { color: theme.electricPurple }]}>View Ledger →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.balanceSplit}>
          <View style={styles.balanceBlock}>
            <Text style={[styles.balanceSubLabel, { color: theme.textSecondary }]}>Available</Text>
            <View style={styles.tokenNumberRow}>
              <Text style={[styles.availableNumber, { color: theme.textPrimary }]}>
                {wallet ? wallet.available_balance : '100'}
              </Text>
              <Text style={[styles.tokenUnitPurple, { color: theme.electricPurple }]}>TKN</Text>
            </View>
          </View>

          <View style={[styles.balanceDivider, { backgroundColor: theme.divider }]} />

          <View style={styles.balanceBlock}>
            <Text style={[styles.balanceSubLabel, { color: theme.textSecondary }]}>Locked Stake</Text>
            <View style={styles.tokenNumberRow}>
              <Text style={[styles.lockedNumber, { color: '#D97706' }]}>
                {wallet ? wallet.locked_balance : '0'}
              </Text>
              <Text style={styles.tokenUnitAmber}>TKN</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.walletExplanation, { color: theme.textMuted }]}>
          Locked tokens are held in server escrow for active field commitments.
        </Text>

        <HorizonButton
          title="Discover Nearby Tasks"
          onPress={() => onNavigate('discover')}
          size="md"
          variant="primary"
          style={styles.discoverCTA}
        />
      </View>

      {loading ? (
        <LoadingState message="Loading field dashboard..." />
      ) : (
        <>
          {/* Active Commitments Section */}
          <SectionHeader
            title="Active Commitments"
            count={activeTasks.length}
            actionText={activeTasks.length > 0 ? 'View All' : undefined}
            onAction={() => onNavigate('tasks')}
          />
          {activeTasks.length === 0 ? (
            <EmptyState
              title="No Active Commitments"
              description="You have no field commitments reserved. Explore open observation tasks to begin."
              actionText="Explore Tasks"
              onAction={() => onNavigate('discover')}
            />
          ) : (
            activeTasks.map((item) => (
              <TouchableOpacity
                key={item.claim_id}
                style={[
                  styles.commitmentCard,
                  {
                    backgroundColor: theme.surfaceCard,
                    borderColor: theme.border,
                    shadowColor: theme.secondaryPurple,
                  },
                ]}
                onPress={() => onSelectTask && onSelectTask(item.task)}
                activeOpacity={0.75}
              >
                <View style={styles.commitmentTop}>
                  <View
                    style={[
                      styles.commitmentPill,
                      {
                        backgroundColor: theme.purpleMuted,
                        borderColor: theme.borderHighlight,
                      },
                    ]}
                  >
                    <Text style={[styles.commitmentPillText, { color: theme.electricPurple }]}>
                      Escrow Stake
                    </Text>
                  </View>
                  <Text style={[styles.stakeAmountText, { color: theme.textSecondary }]}>
                    {item.stake_amount} TKN
                  </Text>
                </View>
                <Text style={[styles.commitmentTitle, { color: theme.textPrimary }]}>{item.task.title}</Text>
                <View style={styles.commitmentBottom}>
                  <Text style={[styles.phase3HintText, { color: theme.electricPurple }]}>
                    Ready for field collection
                  </Text>
                  <Text style={[styles.rewardPotentialText, { color: theme.textSecondary }]}>
                    Reward: +{item.task.base_reward} TKN
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Nearby Tasks Section */}
          <SectionHeader
            title="Nearby Open Tasks"
            count={nearbyTasks.length}
            actionText="Discover More"
            onAction={() => onNavigate('discover')}
          />
          {nearbyTasks.length === 0 ? (
            <EmptyState
              title="No Tasks in Immediate Area"
              description="No open geospatial observation points found nearby. Expand your radius in Discover."
              actionText="Open Map"
              onAction={() => onNavigate('discover')}
            />
          ) : (
            nearbyTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onPress={(selected) => onSelectTask ? onSelectTask(selected) : onNavigate('discover')}
              />
            ))
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 36,
  },
  topSection: {
    marginBottom: 14,
  },
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 12,
    fontWeight: '500',
  },
  contributorName: {
    fontSize: 20,
    fontWeight: '700',
  },
  walletCard: {
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletCardLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  viewLedgerLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  balanceSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  balanceBlock: {
    flex: 1,
  },
  balanceSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  tokenNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  availableNumber: {
    fontSize: 26,
    fontWeight: '800',
  },
  tokenUnitPurple: {
    fontSize: 11,
    fontWeight: '800',
  },
  lockedNumber: {
    fontSize: 26,
    fontWeight: '800',
  },
  tokenUnitAmber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  balanceDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 14,
  },
  walletExplanation: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  discoverCTA: {
    marginTop: 2,
  },
  commitmentCard: {
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  commitmentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  commitmentPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  commitmentPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stakeAmountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  commitmentTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  commitmentBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phase3HintText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rewardPotentialText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
