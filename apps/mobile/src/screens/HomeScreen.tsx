import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { APP_NAME, STARTER_TOKEN_GRANT } from '@horizon/config';
import { formatTokenAmount } from '@horizon/utils';

export const HomeScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.appName}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>Geospatial Community Contribution</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contributor Wallet</Text>
        <Text style={styles.balanceText}>
          {formatTokenAmount(STARTER_TOKEN_GRANT)} <Text style={styles.tokenLabel}>TOKENS</Text>
        </Text>
        <Text style={styles.cardHint}>Initial starter tokens allocated for task commitments.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>System Readiness</Text>
        <Text style={styles.statusItem}>[OK] Offline-first SQLite storage initialized</Text>
        <Text style={styles.statusItem}>[OK] Resilient sync queue standing by</Text>
        <Text style={styles.statusItem}>[OK] PostGIS coordinate telemetry ready</Text>
        <Text style={styles.statusItem}>[OK] Authoritative FastAPI backend connected</Text>
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
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#38BDF8',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  balanceText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginVertical: 4,
  },
  tokenLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#38BDF8',
  },
  cardHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  statusItem: {
    fontSize: 13,
    color: '#10B981',
    marginVertical: 3,
    fontFamily: 'monospace',
  },
});
