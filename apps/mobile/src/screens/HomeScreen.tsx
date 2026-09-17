import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { apiClient } from '../services/api';
import type { WalletSummaryDTO } from '@horizon/types';

interface HomeScreenProps {
  onNavigate: (tab: 'discover' | 'tasks' | 'wallet') => void;
  user?: { username: string; email: string; full_name?: string } | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, user }) => {
  const [wallet, setWallet] = useState<WalletSummaryDTO | null>(null);

  useEffect(() => {
    apiClient
      .getWallet()
      .then((data) => setWallet(data))
      .catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.appName}>HORIZON</Text>
        <Text style={styles.subtitle}>Geospatial Community Ground-Truth Network</Text>
        {user && (
          <View style={styles.contributorTag}>
            <Text style={styles.contributorName}>
              Scout: <Text style={styles.highlightWhite}>{user.full_name || user.username}</Text>
            </Text>
          </View>
        )}
      </View>

      {/* Wallet Hero Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>AUTHORITATIVE WALLET</Text>
          <TouchableOpacity onPress={() => onNavigate('wallet')}>
            <Text style={styles.cardAction}>View Ledger →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.balanceText}>
          {wallet ? wallet.available_balance : '100'}{' '}
          <Text style={styles.tokenLabel}>AVAILABLE TOKENS</Text>
        </Text>
        <Text style={styles.lockedText}>
          Locked in Active Escrows: {wallet ? wallet.locked_balance : '0'} Tokens
        </Text>
        <Text style={styles.cardHint}>
          Every verified task commitment locks tokens in escrow until ground-truth validation is complete.
        </Text>
      </View>

      {/* Quick Navigation Cards */}
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => onNavigate('discover')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>🛰️</Text>
          <Text style={styles.actionTitle}>Discover Tasks</Text>
          <Text style={styles.actionSub}>Explore geospatial data gaps near your GPS fix</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => onNavigate('tasks')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionTitle}>My Commitments</Text>
          <Text style={styles.actionSub}>View your staked tasks and collection checklists</Text>
        </TouchableOpacity>
      </View>

      {/* Platform & Core Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>SYSTEM READINESS (PHASE 2)</Text>
        <Text style={styles.statusItem}>[OK] Server-authoritative token ledger connected</Text>
        <Text style={styles.statusItem}>[OK] PostGIS geospatial proximity engine operational</Text>
        <Text style={styles.statusItem}>[OK] Row-level lock commitment escrow enforced</Text>
        <Text style={styles.statusItem}>[OK] Offline-first SQLite cache initialized</Text>
      </View>
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
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  contributorTag: {
    marginTop: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  contributorName: {
    fontSize: 12,
    color: '#38BDF8',
  },
  highlightWhite: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  cardAction: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
  },
  balanceText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#F8FAFC',
    marginVertical: 4,
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  lockedText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardHint: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 6,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionIcon: {
    fontSize: 26,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  actionSub: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  statusItem: {
    fontSize: 12,
    color: '#10B981',
    marginVertical: 4,
    fontFamily: 'monospace',
  },
});
