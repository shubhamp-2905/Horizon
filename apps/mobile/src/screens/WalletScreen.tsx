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
import type { WalletSummaryDTO } from '@horizon/types';
import { useTheme, type ThemeMode } from '../theme/ThemeContext';
import { radius } from '../theme/colors';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';

export const WalletScreen: React.FC = () => {
  const { theme, mode, setMode } = useTheme();
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
      {/* Screen Title */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>CONTRIBUTOR WALLET</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Token Balance & Immutable Audit Ledger
        </Text>
      </View>

      {/* Appearance & Theme Selector Card */}
      <View style={[styles.appearanceCard, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
        <View style={styles.appearanceHeader}>
          <Text style={[styles.appearanceTitle, { color: theme.textPrimary }]}>APPEARANCE</Text>
          <Text style={[styles.appearanceSub, { color: theme.textMuted }]}>
            Current: {mode.toUpperCase()}
          </Text>
        </View>

        <View style={[styles.themePillsRow, { backgroundColor: theme.surfaceSubtle }]}>
          {(['dark', 'light', 'system'] as ThemeMode[]).map((m) => {
            const isActive = mode === m;
            return (
              <TouchableOpacity
                key={m}
                style={[
                  styles.themePill,
                  isActive && styles.activeThemePill,
                  isActive && { backgroundColor: theme.surfaceCard, borderColor: theme.borderHighlight },
                ]}
                onPress={() => setMode(m)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.themePillText,
                    { color: theme.textMuted },
                    isActive && { color: theme.electricPurple, fontWeight: '800' },
                  ]}
                >
                  {m === 'dark' ? '☾ Dark' : m === 'light' ? '☀ Light' : '⚙ System'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <LoadingState message="Retrieving immutable token ledger..." />
      ) : error ? (
        <View style={[styles.errorBox, { backgroundColor: theme.statusErrorMuted, borderColor: theme.statusError }]}>
          <Text style={[styles.errorText, { color: theme.statusError }]}>{error}</Text>
        </View>
      ) : wallet ? (
        <>
          {/* Top Balance Cards: Available, Locked, Total */}
          <View style={styles.balanceGrid}>
            {/* Available */}
            <View
              style={[
                styles.balanceCard,
                {
                  backgroundColor: theme.surfaceCard,
                  borderColor: theme.borderHighlight,
                  shadowColor: theme.secondaryPurple,
                },
              ]}
            >
              <Text style={[styles.balanceCardLabel, { color: theme.textSecondary }]}>AVAILABLE</Text>
              <Text style={[styles.availableNumber, { color: theme.electricPurple }]}>
                {wallet.available_balance}
              </Text>
              <Text style={[styles.balanceUnit, { color: theme.electricPurple }]}>TKN</Text>
              <Text style={[styles.balanceCardDesc, { color: theme.textMuted }]}>
                Ready to stake on open tasks
              </Text>
            </View>

            {/* Locked */}
            <View
              style={[
                styles.balanceCard,
                { backgroundColor: theme.surfaceCard, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.balanceCardLabel, { color: theme.textSecondary }]}>LOCKED</Text>
              <Text style={[styles.lockedNumber, { color: '#D97706' }]}>
                {wallet.locked_balance}
              </Text>
              <Text style={[styles.balanceUnit, { color: '#D97706' }]}>TKN</Text>
              <Text style={[styles.balanceCardDesc, { color: theme.textMuted }]}>
                Held in commitment escrow
              </Text>
            </View>

            {/* Total */}
            <View
              style={[
                styles.balanceCard,
                { backgroundColor: theme.surfaceCard, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.balanceCardLabel, { color: theme.textSecondary }]}>TOTAL</Text>
              <Text style={[styles.totalNumber, { color: theme.textPrimary }]}>
                {wallet.total_tokens}
              </Text>
              <Text style={[styles.balanceUnit, { color: theme.textMuted }]}>TKN</Text>
              <Text style={[styles.balanceCardDesc, { color: theme.textMuted }]}>
                Aggregate contributor balance
              </Text>
            </View>
          </View>

          {/* Authoritative Explanatory Note */}
          <View
            style={[
              styles.explanationNotice,
              { backgroundColor: theme.surfaceCard, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.shieldIcon,
                { backgroundColor: theme.purpleMuted, borderColor: theme.borderHighlight },
              ]}
            >
              <Text style={[styles.shieldText, { color: theme.electricPurple }]}>✓</Text>
            </View>
            <Text style={[styles.explanationText, { color: theme.textMuted }]}>
              Your wallet is managed authoritatively by the Horizon backend. Transactions are recorded in an immutable ledger.
            </Text>
          </View>

          {/* Transaction History Section */}
          <View style={styles.ledgerSection}>
            <View style={styles.ledgerHeaderRow}>
              <Text style={[styles.ledgerTitle, { color: theme.textPrimary }]}>TRANSACTION HISTORY</Text>
              <Text style={[styles.txCount, { color: theme.textMuted }]}>
                {wallet.transactions ? wallet.transactions.length : 0} records
              </Text>
            </View>

            {wallet.transactions && wallet.transactions.length > 0 ? (
              <View style={[styles.txTable, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
                {wallet.transactions.map((tx, idx) => {
                  const isPositive = tx.amount > 0;
                  const isLast = idx === wallet.transactions.length - 1;

                  return (
                    <View
                      key={tx.id || idx}
                      style={[styles.txRow, isLast && styles.txRowLast, { borderBottomColor: theme.divider }]}
                    >
                      <View style={styles.txTypeArea}>
                        <Text style={[styles.txTypeName, { color: theme.textPrimary }]}>
                          {formatTxType(tx.transaction_type || tx.type)}
                        </Text>
                        <Text style={[styles.txDate, { color: theme.textMuted }]}>
                          {formatTxDate(tx.created_at)}
                        </Text>
                        {tx.description && (
                          <Text style={[styles.txDescription, { color: theme.textSecondary }]} numberOfLines={1}>
                            {tx.description}
                          </Text>
                        )}
                      </View>

                      <View style={styles.txAmountArea}>
                        <Text
                          style={[
                            styles.txAmountText,
                            isPositive
                              ? { color: theme.statusSuccess }
                              : { color: theme.statusError },
                          ]}
                        >
                          {isPositive ? `+${tx.amount}` : tx.amount}
                        </Text>
                        <Text style={[styles.txAmountUnit, { color: theme.textMuted }]}>TKN</Text>
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
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  appearanceCard: {
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  appearanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appearanceTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  appearanceSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  themePillsRow: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    padding: 3,
  },
  themePill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: radius.xs,
  },
  activeThemePill: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  themePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorBox: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  balanceCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  balanceCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  availableNumber: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  lockedNumber: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  totalNumber: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  balanceUnit: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  balanceCardDesc: {
    fontSize: 10,
    lineHeight: 13,
  },
  explanationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  shieldIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldText: {
    fontSize: 12,
    fontWeight: '800',
  },
  explanationText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  ledgerSection: {
    gap: 10,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  txCount: {
    fontSize: 11,
  },
  txTable: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  txRowLast: {
    borderBottomWidth: 0,
  },
  txTypeArea: {
    flex: 1,
    gap: 2,
  },
  txTypeName: {
    fontSize: 13,
    fontWeight: '700',
  },
  txDate: {
    fontSize: 11,
  },
  txDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  txAmountArea: {
    alignItems: 'flex-end',
    gap: 2,
  },
  txAmountText: {
    fontSize: 14,
    fontWeight: '800',
  },
  txAmountUnit: {
    fontSize: 9,
    fontWeight: '700',
  },
});
