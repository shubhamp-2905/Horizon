import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { apiClient } from '../services/api';
import type { WalletSummaryDTO } from '@horizon/types';

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>CONTRIBUTOR WALLET</Text>
        <Text style={styles.subtitle}>Server-Authoritative Ledger & Escrow Balances</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Fetching token ledger from backend...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : wallet ? (
        <>
          {/* Main Balance Hero Card */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>AVAILABLE TOKENS</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceBig}>{wallet.available_balance}</Text>
              <Text style={styles.currencyBadge}>TOKENS</Text>
            </View>
            <Text style={styles.heroHint}>
              Free balance ready to commit as stake on new geospatial tasks.
            </Text>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownBox}>
                <Text style={styles.subLabel}>LOCKED IN ESCROW</Text>
                <Text style={styles.lockedVal}>{wallet.locked_balance} TOKENS</Text>
              </View>
              <View style={styles.breakdownBox}>
                <Text style={styles.subLabel}>TOTAL REPUTATION WEIGHT</Text>
                <Text style={styles.totalVal}>{wallet.total_tokens} TOKENS</Text>
              </View>
            </View>
          </View>

          {/* Ledger History */}
          <View style={styles.ledgerSection}>
            <Text style={styles.sectionHeader}>TRANSACTION AUDIT LEDGER</Text>
            {wallet.transactions && wallet.transactions.length > 0 ? (
              wallet.transactions.map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={styles.txLeft}>
                      <Text style={styles.txType}>
                        {(tx.transaction_type || tx.type || '').toUpperCase()}
                      </Text>
                      <Text style={styles.txDate}>
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'Recent'}
                      </Text>
                      {tx.description && <Text style={styles.txNote}>{tx.description}</Text>}
                    </View>
                    <View style={styles.txRight}>
                      <Text style={[styles.txAmount, isPositive ? styles.positive : styles.negative]}>
                        {isPositive ? `+${tx.amount}` : tx.amount}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyLedger}>No ledger transactions recorded yet.</Text>
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
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 8,
    gap: 8,
  },
  balanceBig: {
    fontSize: 44,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  currencyBadge: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38BDF8',
  },
  heroHint: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  breakdownBox: {
    flex: 1,
  },
  subLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  lockedVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
  },
  totalVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  ledgerSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 14,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  txLeft: {
    flex: 1,
  },
  txType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  txDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  txNote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  positive: {
    color: '#10B981',
  },
  negative: {
    color: '#F59E0B',
  },
  emptyLedger: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 20,
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
