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
import { colors, radius } from '../theme/colors';
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
  user?: { username: string; email: string; full_name?: string } | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onSelectTask,
  user,
}) => {
  const [wallet, setWallet] = useState<WalletSummaryDTO | null>(null);
  const [activeTasks, setActiveTasks] = useState<UserClaimedTaskDTO[]>([]);
  const [nearbyTasks, setNearbyTasks] = useState<TaskResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncState, setSyncState] = useState<SyncEngineState>(syncEngine.getState());

  useEffect(() => {
    const unsub = syncEngine.subscribe(setSyncState);
    return unsub;
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
        const cachedClaims = await claimRepo.getCachedClaims();
        if (cachedClaims.length > 0) {
          setActiveTasks(
            cachedClaims.map((c) => ({
              claim_id: c.claim_id,
              status: c.status,
              stake_amount: c.stake_amount,
              claimed_at: c.claimed_at,
              task: {
                id: c.task_id,
                title: 'Cached Task',
                artifact_type: 'offline_task',
                status: 'published',
                difficulty: 1.0,
                scarcity: 1.0,
                base_reward: 50,
                commitment_stake: c.stake_amount,
                created_at: c.claimed_at,
              },
            }))
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
      {/* Top Greeting & Contributor Identity */}
      <View style={styles.topSection}>
        <View style={styles.identityRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.contributorName}>{displayName}</Text>
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
      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <Text style={styles.walletCardLabel}>Contributor Wallet</Text>
          <TouchableOpacity onPress={() => onNavigate('wallet')} activeOpacity={0.7}>
            <Text style={styles.viewLedgerLink}>View Ledger →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.balanceSplit}>
          <View style={styles.balanceBlock}>
            <Text style={styles.balanceSubLabel}>Available</Text>
            <View style={styles.tokenNumberRow}>
              <Text style={styles.availableNumber}>
                {wallet ? wallet.available_balance : '100'}
              </Text>
              <Text style={styles.tokenUnitGreen}>HZN</Text>
            </View>
          </View>

          <View style={styles.balanceDivider} />

          <View style={styles.balanceBlock}>
            <Text style={styles.balanceSubLabel}>Locked Stake</Text>
            <View style={styles.tokenNumberRow}>
              <Text style={styles.lockedNumber}>
                {wallet ? wallet.locked_balance : '0'}
              </Text>
              <Text style={styles.tokenUnitAmber}>HZN</Text>
            </View>
          </View>
        </View>

        <Text style={styles.walletExplanation}>
          Locked tokens are held in server escrow for active field commitments.
        </Text>

        <HorizonButton
          title="Discover Nearby Tasks"
          onPress={() => onNavigate('discover')}
          size="md"
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
                style={styles.commitmentCard}
                onPress={() => onSelectTask && onSelectTask(item.task)}
                activeOpacity={0.75}
              >
                <View style={styles.commitmentTop}>
                  <View style={styles.commitmentPill}>
                    <Text style={styles.commitmentPillText}>Escrow Stake</Text>
                  </View>
                  <Text style={styles.stakeAmountText}>{item.stake_amount} HZN</Text>
                </View>
                <Text style={styles.commitmentTitle}>{item.task.title}</Text>
                <View style={styles.commitmentBottom}>
                  <Text style={styles.phase3HintText}>Ready for field collection</Text>
                  <Text style={styles.rewardPotentialText}>
                    Reward: +{item.task.base_reward} HZN
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

          {/* Recent Ledger Activity */}
          <SectionHeader
            title="Recent Ledger Activity"
            actionText="Full History"
            onAction={() => onNavigate('wallet')}
          />
          {(!wallet || !wallet.transactions || wallet.transactions.length === 0) ? (
            <EmptyState
              title="No Transactions Recorded"
              description="Transactions recorded in the server ledger will appear here."
            />
          ) : (
            <View style={styles.txListCard}>
              {wallet.transactions.slice(0, 3).map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={styles.txLeft}>
                      <Text style={styles.txType}>
                        {(tx.transaction_type || tx.type || '').replace(/_/g, ' ')}
                      </Text>
                      <Text style={styles.txDate}>
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'Recent'}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, isPositive ? styles.txPos : styles.txNeg]}>
                      {isPositive ? `+${tx.amount}` : tx.amount} HZN
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 16,
    paddingTop: 44,
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
    color: colors.textSecondary,
    fontWeight: '500',
  },
  contributorName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  viewLedgerLink: {
    fontSize: 12,
    color: colors.accentGreen,
    fontWeight: '600',
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
    color: colors.textSecondary,
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
    color: colors.textPrimary,
  },
  tokenUnitGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentGreen,
  },
  lockedNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.tokenGold,
  },
  tokenUnitAmber: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tokenGold,
  },
  balanceDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.borderLight,
    marginHorizontal: 14,
  },
  walletExplanation: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 14,
  },
  discoverCTA: {
    marginTop: 2,
  },
  commitmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  commitmentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  commitmentPill: {
    backgroundColor: colors.tokenGoldMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.2)',
  },
  commitmentPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.tokenGoldDark,
  },
  stakeAmountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  commitmentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  commitmentBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phase3HintText: {
    fontSize: 11,
    color: colors.accentGreen,
    fontWeight: '600',
  },
  rewardPotentialText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  txListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  txLeft: {
    gap: 2,
  },
  txType: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  txDate: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  txPos: {
    color: colors.accentGreen,
  },
  txNeg: {
    color: colors.tokenGold,
  },
});
