import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { apiClient } from '../services/api';
import type { WalletSummaryDTO } from '@horizon/types';
import { colors, radius } from '../theme/colors';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';

export const WalletScreen: React.FC = () => {
  const [wallet, setWallet] = useState<WalletSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.getWallet();
      setWallet(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve authoritative wallet balances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWallet();
  };

  const formatTxType = (type?: string) => {
    if (!type) return 'TRANSACTION';
    switch (type.toLowerCase()) {
      case 'starter_grant':
        return 'Starter Grant';
      case 'task_stake_lock':
      case 'stake_lock':
        return 'Task Stake';
      case 'task_stake_unlock':
      case 'stake_unlock':
        return 'Stake Return';
      case 'reward_payout':
        return 'Task Reward';
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const formatTxDate = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

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
      {/* Screen Title */}
      <View style={styles.header}>
        <Text style={styles.title}>CONTRIBUTOR WALLET</Text>
        <Text style={styles.subtitle}>Token Balance & Immutable Audit Ledger</Text>
      </View>

      {loading ? (
        <LoadingState message="Retrieving immutable token ledger..." />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : wallet ? (
        <>
          {/* Top Balance Cards: Available, Locked, Total */}
          <View style={styles.balanceGrid}>
            {/* Available */}
            <View style={[styles.balanceCard, styles.availableCard]}>
              <Text style={styles.balanceCardLabel}>AVAILABLE</Text>
              <Text style={styles.availableNumber}>{wallet.available_balance}</Text>
              <Text style={styles.balanceUnitGreen}>TOKENS</Text>
              <Text style={styles.balanceCardDesc}>Ready to stake on open tasks</Text>
            </View>

            {/* Locked */}
            <View style={[styles.balanceCard, styles.lockedCard]}>
              <Text style={styles.balanceCardLabel}>LOCKED</Text>
              <Text style={styles.lockedNumber}>{wallet.locked_balance}</Text>
              <Text style={styles.balanceUnitAmber}>TOKENS</Text>
              <Text style={styles.balanceCardDesc}>Held in commitment escrow</Text>
            </View>

            {/* Total */}
            <View style={[styles.balanceCard, styles.totalCard]}>
              <Text style={styles.balanceCardLabel}>TOTAL</Text>
              <Text style={styles.totalNumber}>{wallet.total_tokens}</Text>
              <Text style={styles.balanceUnitMuted}>TOKENS</Text>
              <Text style={styles.balanceCardDesc}>Aggregate contributor balance</Text>
            </View>
          </View>

          {/* Authoritative Explanatory Note */}
          <View style={styles.explanationNotice}>
            <View style={styles.shieldIcon}>
              <Text style={styles.shieldText}>✓</Text>
            </View>
            <Text style={styles.explanationText}>
              Your wallet is controlled by the Horizon server. Transactions are recorded in an immutable ledger.
            </Text>
          </View>

          {/* Transaction History Section */}
          <View style={styles.ledgerSection}>
            <View style={styles.ledgerHeaderRow}>
              <Text style={styles.ledgerTitle}>TRANSACTION HISTORY</Text>
              <Text style={styles.txCount}>
                {wallet.transactions ? wallet.transactions.length : 0} records
              </Text>
            </View>

            {wallet.transactions && wallet.transactions.length > 0 ? (
              <View style={styles.txTable}>
                {wallet.transactions.map((tx, idx) => {
                  const isPositive = tx.amount > 0;
                  const isLast = idx === wallet.transactions.length - 1;

                  return (
                    <View
                      key={tx.id || idx}
                      style={[styles.txRow, isLast && styles.txRowLast]}
                    >
                      <View style={styles.txTypeArea}>
                        <Text style={styles.txTypeName}>
                          {formatTxType(tx.transaction_type || tx.type)}
                        </Text>
                        <Text style={styles.txDate}>{formatTxDate(tx.created_at)}</Text>
                        {tx.description && (
                          <Text style={styles.txDescription} numberOfLines={1}>
                            {tx.description}
                          </Text>
                        )}
                      </View>

                      <View style={styles.txAmountArea}>
                        <Text
                          style={[
                            styles.txAmountText,
                            isPositive ? styles.amountPositive : styles.amountNegative,
                          ]}
                        >
                          {isPositive ? `+${tx.amount}` : tx.amount}
                        </Text>
                        <Text style={styles.txAmountUnit}>TOKENS</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                title="No Transactions"
                description="No ledger entries have been recorded for this wallet yet."
              />
            )}
          </View>
        </>
      ) : null}
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
    marginBottom: 20,
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
    marginTop: 3,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  availableCard: {
    borderColor: colors.borderHighlight,
  },
  lockedCard: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  totalCard: {
    borderColor: colors.borderLight,
  },
  balanceCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  availableNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  balanceUnitGreen: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accentGreen,
    marginTop: 1,
  },
  lockedNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.tokenGold,
  },
  balanceUnitAmber: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.tokenGold,
    marginTop: 1,
  },
  totalNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textSecondary,
  },
  balanceUnitMuted: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: 1,
  },
  balanceCardDesc: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 12,
  },
  explanationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    gap: 10,
  },
  shieldIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentGreenMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accentGreen,
  },
  shieldText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.accentGreen,
  },
  explanationText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  ledgerSection: {
    marginBottom: 16,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ledgerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  txCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  txTable: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txRowLast: {
    borderBottomWidth: 0,
  },
  txTypeArea: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  txTypeName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  txDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  txDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  txAmountArea: {
    alignItems: 'flex-end',
    gap: 2,
  },
  txAmountText: {
    fontSize: 16,
    fontWeight: '900',
  },
  amountPositive: {
    color: colors.accentGreen,
  },
  amountNegative: {
    color: colors.tokenGold,
  },
  txAmountUnit: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  errorBox: {
    backgroundColor: colors.statusErrorMuted,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    color: colors.statusError,
  },
});
