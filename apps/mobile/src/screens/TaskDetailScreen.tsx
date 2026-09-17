import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { apiClient } from '../services/api';
import type { TaskResponseDTO } from '@horizon/types';

interface TaskDetailScreenProps {
  task: TaskResponseDTO;
  availableTokens: number;
  onBack: () => void;
  onClaimSuccess: () => void;
}

export const TaskDetailScreen: React.FC<TaskDetailScreenProps> = ({
  task,
  availableTokens,
  onBack,
  onClaimSuccess,
}) => {
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);

  const canAffordStake = availableTokens >= task.commitment_stake;

  const handleClaim = async () => {
    if (!canAffordStake) {
      setClaimError(
        `Insufficient available tokens. Required: ${task.commitment_stake}, Available: ${availableTokens}`
      );
      return;
    }

    setClaiming(true);
    setClaimError(null);
    try {
      await apiClient.claimTask(task.id);
      setClaimSuccessMsg(
        `Success! ${task.commitment_stake} tokens locked in commitment escrow. Task is now assigned to you.`
      );
      setTimeout(() => {
        onClaimSuccess();
      }, 1200);
    } catch (err: any) {
      setClaimError(err.message || 'Failed to commit to task');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>← Back to Discovery</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.artifactBadge}>
            <Text style={styles.artifactText}>{task.artifact_type.replace('_', ' ').toUpperCase()}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{task.status.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.title}>{task.title}</Text>
        {task.distance_meters !== null && task.distance_meters !== undefined && (
          <Text style={styles.distanceText}>
            📍 {task.distance_meters >= 1000
              ? `${(task.distance_meters / 1000).toFixed(2)} km away`
              : `${Math.round(task.distance_meters)} meters away`}
          </Text>
        )}
      </View>

      {/* Economics Grid */}
      <View style={styles.economicsCard}>
        <Text style={styles.sectionTitle}>TASK REWARD & COMMITMENT ECONOMICS</Text>
        <View style={styles.ecoRow}>
          <View style={styles.ecoBox}>
            <Text style={styles.ecoLabel}>BASE REWARD</Text>
            <Text style={styles.rewardVal}>+{task.base_reward}</Text>
            <Text style={styles.ecoSub}>Awarded on verification</Text>
          </View>

          <View style={styles.ecoDivider} />

          <View style={styles.ecoBox}>
            <Text style={styles.ecoLabel}>COMMITMENT STAKE</Text>
            <Text style={styles.stakeVal}>{task.commitment_stake}</Text>
            <Text style={styles.ecoSub}>Locked in escrow</Text>
          </View>
        </View>

        <View style={styles.walletStatusBox}>
          <Text style={styles.walletStatusText}>
            Your Balance: <Text style={styles.boldWhite}>{availableTokens} Available</Text>
            {canAffordStake ? (
              <Text style={styles.textGreen}> (Sufficient for stake)</Text>
            ) : (
              <Text style={styles.textRed}> (Insufficient balance!)</Text>
            )}
          </Text>
        </View>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DESCRIPTION & SCOPE</Text>
        <Text style={styles.description}>
          {task.description || 'No detailed instructions provided for this collection gap.'}
        </Text>
      </View>

      {/* Requirements */}
      {task.requirements && task.requirements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COLLECTION REQUIREMENTS</Text>
          {task.requirements.map((req, idx) => (
            <View key={idx} style={styles.reqItem}>
              <Text style={styles.reqCheck}>✓</Text>
              <Text style={styles.reqText}>{req}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Location Parameters */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TARGET COORDINATES</Text>
        <View style={styles.geoBox}>
          <Text style={styles.geoText}>
            Latitude: {task.latitude !== null && task.latitude !== undefined ? task.latitude.toFixed(6) : 'N/A'}
          </Text>
          <Text style={styles.geoText}>
            Longitude: {task.longitude !== null && task.longitude !== undefined ? task.longitude.toFixed(6) : 'N/A'}
          </Text>
          <Text style={styles.geoSub}>PostGIS WGS84 Spatial Reference (SRID 4326)</Text>
        </View>
      </View>

      {/* Messages */}
      {claimError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {claimError}</Text>
        </View>
      )}

      {claimSuccessMsg && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>🎉 {claimSuccessMsg}</Text>
        </View>
      )}

      {/* Action CTA */}
      <TouchableOpacity
        style={[
          styles.claimButton,
          (!canAffordStake || claiming || !!claimSuccessMsg) && styles.disabledButton,
        ]}
        onPress={handleClaim}
        disabled={!canAffordStake || claiming || !!claimSuccessMsg}
      >
        {claiming ? (
          <ActivityIndicator color="#0F172A" />
        ) : (
          <Text style={styles.claimButtonText}>
            {canAffordStake
              ? `Commit to Task (Lock ${task.commitment_stake} Tokens)`
              : `Insufficient Tokens (Requires ${task.commitment_stake})`}
          </Text>
        )}
      </TouchableOpacity>
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
    paddingTop: 40,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '600',
  },
  header: {
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  artifactBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  artifactText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    lineHeight: 28,
  },
  distanceText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 6,
  },
  economicsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 12,
  },
  ecoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ecoBox: {
    flex: 1,
    alignItems: 'center',
  },
  ecoDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#334155',
  },
  ecoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
  },
  rewardVal: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FBBF24',
  },
  stakeVal: {
    fontSize: 24,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  ecoSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  walletStatusBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    alignItems: 'center',
  },
  walletStatusText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  boldWhite: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  textGreen: {
    color: '#10B981',
    fontWeight: '600',
  },
  textRed: {
    color: '#EF4444',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 22,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reqCheck: {
    color: '#38BDF8',
    fontWeight: '800',
    marginRight: 8,
    fontSize: 14,
  },
  reqText: {
    fontSize: 13,
    color: '#E2E8F0',
    flex: 1,
    lineHeight: 18,
  },
  geoBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
  },
  geoText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#38BDF8',
    marginBottom: 4,
  },
  geoSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '600',
  },
  claimButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  claimButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
});
