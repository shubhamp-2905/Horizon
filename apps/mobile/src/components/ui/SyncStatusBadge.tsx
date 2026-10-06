import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/colors';
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
  const { theme } = useTheme();
  const isOffline = state.networkState === 'OFFLINE';
  const isSyncing = state.isSyncing;
  const hasPending = state.pendingCount > 0;
  const hasError = !!state.lastError;

  if (compact) {
    if (isOffline) {
      return (
        <View style={[styles.compactBadge, styles.badgeOffline]}>
          <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[styles.compactText, { color: '#F59E0B' }]}>Offline</Text>
        </View>
      );
    }
    if (isSyncing) {
      return (
        <View
          style={[
            styles.compactBadge,
            { backgroundColor: theme.purpleMuted, borderColor: theme.borderHighlight },
          ]}
        >
          <ActivityIndicator size="small" color={theme.electricPurple} style={styles.spinner} />
          <Text style={[styles.compactText, { color: theme.electricPurple }]}>Syncing</Text>
        </View>
      );
    }
    if (hasPending) {
      return (
        <TouchableOpacity
          onPress={onSyncNow}
          style={[
            styles.compactBadge,
            { backgroundColor: 'rgba(217, 119, 6, 0.12)', borderColor: 'rgba(217, 119, 6, 0.3)' },
          ]}
          activeOpacity={0.7}
        >
          <Text style={[styles.compactText, { color: '#D97706' }]}>
            {state.pendingCount} Pending
          </Text>
        </TouchableOpacity>
      );
    }
    return (
      <View
        style={[
          styles.compactBadge,
          {
            backgroundColor: theme.statusSuccessMuted,
            borderColor: theme.statusSuccess,
          },
        ]}
      >
        <Text style={[styles.compactText, { color: theme.statusSuccess }]}>✓ Synced</Text>
      </View>
    );
  }

  // Full Banner
  return (
    <View
      style={[
        styles.bannerContainer,
        { backgroundColor: theme.surfaceCard, borderColor: theme.border },
        isOffline && styles.bannerOffline,
        isSyncing && styles.bannerSyncing,
        isSyncing && { borderColor: theme.borderHighlight },
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
                  ? theme.statusError
                  : isSyncing
                  ? theme.electricPurple
                  : theme.statusSuccess,
              },
            ]}
          />
          <Text style={[styles.bannerTitle, { color: theme.textPrimary }]}>
            {isOffline
              ? 'Offline Mode'
              : hasError
              ? 'Sync Attention Required'
              : isSyncing
              ? 'Synchronizing Field Data...'
              : 'All Changes Synced'}
          </Text>
        </View>

        <Text style={[styles.bannerSubtitle, { color: theme.textMuted }]}>
          {isOffline
            ? 'Collected evidence is safely saved in local offline storage.'
            : hasError
            ? state.lastError
            : isSyncing
            ? 'Uploading observations and media to server...'
            : state.lastSyncedAt
            ? `Last synchronized at ${new Date(state.lastSyncedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : 'Working copy matches server state.'}
        </Text>
      </View>

      {!isOffline && onSyncNow && (
        <TouchableOpacity
          onPress={onSyncNow}
          disabled={isSyncing}
          style={[
            styles.syncButton,
            { backgroundColor: theme.primaryPurple },
            isSyncing && { opacity: 0.5 },
          ]}
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
  spinner: {
    marginRight: 4,
    transform: [{ scale: 0.7 }],
  },
  compactText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  bannerOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  bannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  bannerSyncing: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  bannerInfo: {
    flex: 1,
    gap: 2,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  bannerSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  syncButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.xs,
  },
  syncButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
