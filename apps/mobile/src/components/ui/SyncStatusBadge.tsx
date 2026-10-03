import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, radius } from '../../theme/colors';
import type { SyncEngineState } from '../../offline/syncEngine';

interface SyncStatusBadgeProps {
  state: SyncEngineState;
  onSyncNow?: () => void;
  compact?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  state,
  onSyncNow,
  compact = false,
}) => {
  const isOffline = state.networkState === 'OFFLINE';
  const isSyncing = state.isSyncing;
  const hasPending = state.pendingCount > 0;
  const hasError = !!state.lastError;

  if (compact) {
    if (isOffline) {
      return (
        <View style={[styles.compactBadge, styles.badgeOffline]}>
          <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.compactText}>Offline</Text>
        </View>
      );
    }
    if (isSyncing) {
      return (
        <View style={[styles.compactBadge, styles.badgeSyncing]}>
          <ActivityIndicator size="small" color="#0284C7" style={styles.spinner} />
          <Text style={styles.compactText}>Syncing</Text>
        </View>
      );
    }
    if (hasPending) {
      return (
        <TouchableOpacity
          onPress={onSyncNow}
          style={[styles.compactBadge, styles.badgePending]}
          activeOpacity={0.7}
        >
          <Text style={[styles.compactText, { color: '#D97706' }]}>
            {state.pendingCount} Pending
          </Text>
        </TouchableOpacity>
      );
    }
    return (
      <View style={[styles.compactBadge, styles.badgeSynced]}>
        <Text style={[styles.compactText, { color: '#059669' }]}>✓ Synced</Text>
      </View>
    );
  }

  // Full Banner
  return (
    <View
      style={[
        styles.bannerContainer,
        isOffline && styles.bannerOffline,
        hasError && styles.bannerError,
        isSyncing && styles.bannerSyncing,
      ]}
    >
      <View style={styles.bannerInfo}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isOffline
                  ? '#F59E0B'
                  : hasError
                  ? '#EF4444'
                  : isSyncing
                  ? '#38BDF8'
                  : '#10B981',
              },
            ]}
          />
          <Text style={styles.bannerTitle}>
            {isOffline
              ? 'Offline Mode'
              : hasError
              ? 'Sync Attention Required'
              : isSyncing
              ? 'Synchronizing Field Data...'
              : 'All Changes Synced'}
          </Text>
        </View>

        <Text style={styles.bannerSubtitle}>
          {isOffline
            ? 'Collected evidence is safely saved in local SQLite storage.'
            : hasError
            ? state.lastError
            : isSyncing
            ? 'Uploading observations and media to server...'
            : state.lastSyncedAt
            ? `Last synchronized at ${new Date(state.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Working copy matches server state.'}
        </Text>
      </View>

      {!isOffline && onSyncNow && (
        <TouchableOpacity
          onPress={onSyncNow}
          disabled={isSyncing}
          style={[styles.syncButton, isSyncing && { opacity: 0.5 }]}
          activeOpacity={0.8}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.syncButtonText}>Sync Now</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  badgeSyncing: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  badgeSynced: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  compactText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  spinner: {
    marginRight: 4,
  },
  bannerContainer: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  bannerOffline: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  bannerError: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  bannerSyncing: {
    borderColor: 'rgba(14, 165, 233, 0.4)',
    backgroundColor: 'rgba(14, 165, 233, 0.05)',
  },
  bannerInfo: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bannerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  syncButton: {
    backgroundColor: colors.accentGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },

  syncButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
});
